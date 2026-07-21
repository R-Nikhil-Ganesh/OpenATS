import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Upload, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";
import { jobsApi, applicationsApi } from "@/lib/api";
import { useSSE, forceConnectSSE } from "@/hooks/useSSE";
import { ensureAuthenticated } from "@/lib/auth";

type Stage = "QUEUED" | "EXTRACTING" | "EMBEDDING" | "SCORING" | "REVIEWABLE" | "FAILED";
type Tier = "A" | "B" | "C";

const STAGES: Stage[] = ["QUEUED", "EXTRACTING", "EMBEDDING", "SCORING", "REVIEWABLE"];

interface ResumeItem {
  id: string; // application UUID
  filename: string;
  stage: Stage;
  startedAt: number;
  stageTimestamps: Partial<Record<Stage, string>>;
  displayedScore: number;
  scoreResolved: boolean;
  candidateName?: string;
  candidate?: {
    name: string;
    score: number;
    tier: Tier;
    skills: string[];
    rec: string;
  };
}

function fmtTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function UploadPipeline() {
  const [items, setItems] = useState<ResumeItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback: if Root auto-auth didn't run (or SSE got stuck),
  // explicitly ensure both auth + SSE are connected on this page.
  useEffect(() => {
    void (async () => {
      const token = await ensureAuthenticated();
      if (token) forceConnectSSE();
    })();
  }, []);

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.list,
  });

  // Set default selected job
  useEffect(() => {
    if (jobs && jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const activeJobs = jobs || [];

  // Listen to real-time updates via SSE
  useSSE((msg) => {
    setItems((prev) => {
      const match = prev.find((it) => it.id === msg.applicationId);
      if (!match) return prev;

      return prev.map((it) => {
        if (it.id !== msg.applicationId) return it;

        let nextStage = it.stage;
        if (msg.type === "progress") {
          const prog = msg.progress || 0;
          // Map the raw progress value to a pipeline stage.
          // BullMQ fires an initial progress=0 event when it picks up a job;
          // we deliberately skip that (candidateStage stays QUEUED) and then
          // take the *maximum* of the current and candidate stage so the UI
          // can never regress backward through the pipeline.
          let candidateStage: Stage;
          if (prog === 0) candidateStage = "QUEUED";
          else if (prog < 30) candidateStage = "EXTRACTING";
          else if (prog < 60) candidateStage = "EMBEDDING";
          else candidateStage = "SCORING";

          // Only advance, never regress.
          const currentIdx = STAGES.indexOf(it.stage);
          const candidateIdx = STAGES.indexOf(candidateStage);
          nextStage = candidateIdx > currentIdx ? candidateStage : it.stage;
        } else if (msg.type === "completed") {
          nextStage = "REVIEWABLE";
        } else if (msg.type === "failed") {
          nextStage = "FAILED";
        }

        const stageTimestamps = { ...it.stageTimestamps };
        if (nextStage !== it.stage) {
          stageTimestamps[nextStage] = fmtTime(Date.now());
        }

        // Fetch candidate details on completed
        if (msg.type === "completed" && it.stage !== "REVIEWABLE") {
          void applicationsApi.get(msg.applicationId).then((appDetail) => {
            setItems((current) =>
              current.map((item) => {
                if (item.id !== msg.applicationId) return item;
                return {
                  ...item,
                  candidateName: appDetail.candidate.full_name,
                  candidate: {
                    name: appDetail.candidate.full_name,
                    score: appDetail.latest_evaluation?.score || msg.score || 0,
                    tier: appDetail.latest_evaluation?.tier || (msg.tier as any) || "C",
                    skills: appDetail.latest_evaluation?.matched_skills?.map((s) => s.skill) || [],
                    rec: appDetail.latest_evaluation?.recommendation || "",
                  },
                };
              })
            );
          });
        }

        return {
          ...it,
          stage: nextStage,
          stageTimestamps,
        };
      });
    });
  });

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!selectedJobId) {
        alert("Please select a job role first.");
        return;
      }
      const now = Date.now();

      // Ensure we have a valid token before uploading (upload route requires Authorization).
      const token = await ensureAuthenticated();
      if (!token) {
        alert("Not authenticated. Please refresh and try again.");
        return;
      }

      try {
        // Trigger upload
        const results = await jobsApi.uploadResumes(selectedJobId, files);

        // Add pending items
        const newItems: ResumeItem[] = results.map((res: any) => ({
          id: res.applicationId,
          filename: res.filename,
          stage: "QUEUED",
          startedAt: now,
          stageTimestamps: { QUEUED: fmtTime(now) },
          displayedScore: 0,
          scoreResolved: false,
        }));

        setItems((prev) => [...newItems, ...prev]);
      } catch (err: any) {
        alert(
          "Failed to upload resumes: " +
          (err.response?.data?.error?.message || err.message)
        );
      }
    },
    [selectedJobId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) uploadFiles(files);
    },
    [uploadFiles]
  );

  const onBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) uploadFiles(files);
      e.target.value = "";
    },
    [uploadFiles]
  );

  const counters = useMemo(() => {
    let queued = 0, processing = 0, reviewable = 0;
    for (const it of items) {
      if (it.stage === "QUEUED") queued++;
      else if (it.stage === "REVIEWABLE") reviewable++;
      else if (it.stage !== "FAILED") processing++;
    }
    return { queued, processing, reviewable };
  }, [items]);

  if (loadingJobs) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="text-charcoal-earth">
      <HeroPanel
        jobs={activeJobs}
        selectedId={selectedJobId}
        onSelect={setSelectedJobId}
      />
      <div className="mt-6">
        <DropZone
          dragging={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={onBrowse}
        />
      </div>
      <FeedSection items={items} setItems={setItems} />
      <SummaryBar counters={counters} />
    </div>
  );
}

function HeroPanel({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: any[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <GlassPanel className="mt-8 px-8 py-10 md:px-12 md:py-14">
      <div className="relative z-10">
        <div className="font-mono-caps text-warm-taupe">new_intake_session</div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="text-4xl font-semibold leading-[1.05] md:text-5xl text-charcoal-earth">
            Uploading for:
          </h1>
          {jobs.length > 0 ? (
            <select
              className="input-glass font-display text-2xl md:text-3xl font-semibold italic text-sunlit-clay bg-transparent border-none outline-none cursor-pointer p-0"
              value={selectedId}
              onChange={(e) => onSelect(e.target.value)}
              style={{ paddingRight: "2rem" }}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id} className="text-base font-sans font-normal text-charcoal-earth">
                  {job.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xl italic text-warm-taupe">No active roles</span>
          )}
        </div>
        <p className="mt-4 max-w-xl text-warm-taupe">
          Drop resumes and watch each one travel the pipeline — extraction,
          embedding, scoring, and tiered ranking, all live.
        </p>
      </div>
    </GlassPanel>
  );
}

interface DropZoneProps {
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

function DropZone({ dragging, onDragOver, onDragLeave, onDrop, onClick }: DropZoneProps) {
  return (
    <GlassPanel
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      interactive
      className={cn(
        "px-8 py-14 text-center transition-all",
        dragging && "!bg-lime-cream/60 scale-[1.005]",
      )}
      style={{
        outline: `2px dashed ${dragging ? "var(--ov-clay-med)" : "var(--ov-clay-soft)"}`,
        outlineOffset: "-14px",
      }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <div
          className={cn(
            "glass glass-gold glass-sheen flex h-16 w-16 items-center justify-center rounded-full text-charcoal-earth",
            dragging && "glass-breathe",
          )}
        >
          <Upload className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold md:text-3xl">Drop resumes here</h2>
        <p className="mt-1 text-warm-taupe">
          or <span className="text-sunlit-clay underline underline-offset-4">click to browse</span>
        </p>
        <div className="font-mono-caps mt-4 flex flex-wrap items-center justify-center gap-2 text-warm-taupe">
          <span>accepts: pdf only</span>
          <span className="opacity-40">/</span>
          <span>max 20mb / file</span>
        </div>
      </div>
    </GlassPanel>
  );
}

function FeedSection({
  items,
  setItems,
}: {
  items: ResumeItem[];
  setItems: React.Dispatch<React.SetStateAction<ResumeItem[]>>;
}) {
  if (items.length === 0) {
    return (
      <GlassPanel className="mt-8 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="font-mono-caps text-warm-taupe">feed_empty</div>
        <p className="mt-2 text-warm-taupe">
          Uploaded resumes will stream through here as they process.
        </p>
      </GlassPanel>
    );
  }
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between px-1">
        <h2 className="text-2xl font-semibold">Live processing feed</h2>
        <span className="font-mono-caps text-warm-taupe">{items.length} in_pipeline</span>
      </div>
      <div className="space-y-4">
        {items.map((it) => (
          <ResumeCard key={it.id} item={it} setItems={setItems} />
        ))}
      </div>
    </section>
  );
}

function ResumeCard({
  item,
  setItems,
}: {
  item: ResumeItem;
  setItems: React.Dispatch<React.SetStateAction<ResumeItem[]>>;
}) {
  const stageIndex = STAGES.indexOf(item.stage);
  const hasName = stageIndex >= STAGES.indexOf("EXTRACTING") && item.candidateName;
  const scoring = item.stage === "SCORING";
  const done = item.stage === "REVIEWABLE";

  useEffect(() => {
    if (!scoring && !done) return;
    const target = item.candidate?.score || 0;
    if (item.displayedScore >= target) return;
    const iv = setInterval(() => {
      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? {
              ...p,
              displayedScore: Math.min(
                target,
                p.displayedScore + Math.max(1, Math.round(target / 40)),
              ),
              scoreResolved: p.displayedScore + Math.max(1, Math.round(target / 40)) >= target,
            }
            : p,
        )
      );
    }, 60);
    return () => clearInterval(iv);
  }, [scoring, done, item.id, item.candidate?.score, item.displayedScore, setItems]);

  return (
    <GlassPanel className="panel-in overflow-hidden">
      <div className="relative z-10 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-center gap-4">
          <div className="glass glass-mint glass-sheen flex h-12 w-12 items-center justify-center rounded-2xl">
            <FileText className="h-5 w-5 text-charcoal-earth" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">
              {hasName ? (
                item.candidateName
              ) : (
                <span className="text-warm-taupe">{item.filename}</span>
              )}
            </div>
            <div className="font-mono-caps mt-1 flex flex-wrap items-center gap-2 text-warm-taupe">
              <span>{item.filename}</span>
              <span className="opacity-40">·</span>
              <span>started {item.stageTimestamps.QUEUED}</span>
            </div>
          </div>
        </div>
        <TierArea item={item} />
      </div>
      <div className="relative z-10 border-t border-white/40 px-5 py-6 md:px-6">
        <PipelineTracker item={item} />
      </div>
      {done && item.candidate && (
        <div className="panel-in relative z-10 border-t border-white/40 px-5 py-4 md:px-6">
          <div className="flex flex-wrap gap-2">
            {item.candidate.skills.map((s) => (
              <span
                key={s}
                className="font-mono-caps glass-thin px-2.5 py-1 text-charcoal-earth"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-charcoal-earth/80">
            <span className="font-mono-caps text-warm-taupe">ai_note ·</span>{" "}
            {item.candidate.rec}
          </p>
        </div>
      )}
    </GlassPanel>
  );
}

function TierArea({ item }: { item: ResumeItem }) {
  const scoring = item.stage === "SCORING";
  const done = item.stage === "REVIEWABLE";
  const failed = item.stage === "FAILED";

  if (failed) {
    return <div className="font-mono-caps text-[var(--muted-terracotta)]">FAILED</div>;
  }

  if (!scoring && !done) {
    return (
      <div className="font-mono-caps text-warm-taupe">
        {item.stage.toLowerCase()}
        <span className="ml-1.5 inline-flex gap-0.5">
          <span className="dot-1 inline-block h-1 w-1 rounded-full bg-sunlit-clay" />
          <span className="dot-2 inline-block h-1 w-1 rounded-full bg-sunlit-clay" />
          <span className="dot-3 inline-block h-1 w-1 rounded-full bg-sunlit-clay" />
        </span>
      </div>
    );
  }
  if (scoring && item.displayedScore < (item.candidate?.score || 0)) {
    return (
      <div className="flex items-center gap-3">
        <div className="glass-thin glass-sweep h-8 w-24" />
        <div className="font-mono text-xl font-semibold tabular-nums">
          {item.displayedScore}
          <span className="text-warm-taupe text-sm">/100</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-3", item.scoreResolved && "panel-in")}>
      {item.candidate && <TierBadge tier={item.candidate.tier} />}
      <div className="font-mono text-xl font-semibold tabular-nums">
        {item.displayedScore}
        <span className="text-warm-taupe text-sm">/100</span>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const tintClass =
    tier === "A" ? "glass-gold" : tier === "B" ? "glass-clay" : "glass-terracotta";
  return (
    <span
      className={cn(
        "font-mono-caps glass glass-sheen inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-charcoal-earth",
        tintClass,
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      TIER_{tier}
    </span>
  );
}

function PipelineTracker({ item }: { item: ResumeItem }) {
  const activeIdx = STAGES.indexOf(item.stage);
  const failed = item.stage === "FAILED";
  return (
    <div className="flex items-start">
      {STAGES.map((s, i) => {
        const done = !failed && (i < activeIdx || item.stage === "REVIEWABLE");
        const active = !failed && (i === activeIdx && item.stage !== "REVIEWABLE");
        const isLast = i === STAGES.length - 1;
        return (
          <div key={s} className={cn("flex items-start", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500",
                  "glass glass-sheen",
                  done && "glass-gold",
                  active && "glass-gold glass-breathe",
                  failed && i === activeIdx && "glass-terracotta",
                  !done && !active && !(failed && i === activeIdx) && "opacity-55",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-charcoal-earth" />
                ) : failed && i === activeIdx ? (
                  <span className="font-mono text-xs text-charcoal-earth">✕</span>
                ) : active ? (
                  <span className="inline-flex gap-0.5">
                    <span className="dot-1 inline-block h-1.5 w-1.5 rounded-full bg-charcoal-earth" />
                    <span className="dot-2 inline-block h-1.5 w-1.5 rounded-full bg-charcoal-earth" />
                    <span className="dot-3 inline-block h-1.5 w-1.5 rounded-full bg-charcoal-earth" />
                  </span>
                ) : (
                  <span className="font-mono text-xs text-warm-taupe">{i + 1}</span>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "font-mono-caps",
                    done || active ? "text-charcoal-earth" : "text-warm-taupe",
                  )}
                >
                  {s}
                </span>
                <span className="font-mono min-h-[14px] text-[10px] text-warm-taupe">
                  {item.stageTimestamps[s] ?? ""}
                </span>
              </div>
            </div>
            {!isLast && (
              <div className="mx-2 mt-5 h-[3px] flex-1 overflow-hidden rounded-full bg-charcoal-earth/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    done ? "w-full bg-gradient-to-r from-light-gold to-sunlit-clay" : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryBar({
  counters,
}: {
  counters: { queued: number; processing: number; reviewable: number };
}) {
  const total = counters.queued + counters.processing + counters.reviewable;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-6">
      <GlassPanel className="pointer-events-auto flex items-center gap-5 rounded-full px-5 py-3">
        <Row dot="var(--warm-taupe)" label="queued" value={counters.queued} />
        <span className="h-4 w-px bg-charcoal-earth/15" />
        <Row dot="var(--sunlit-clay)" label="processing" value={counters.processing} />
        <span className="h-4 w-px bg-charcoal-earth/15" />
        <Row dot="var(--light-gold)" label="reviewable" value={counters.reviewable} />
        <span className="h-4 w-px bg-charcoal-earth/15" />
        <div className="flex items-baseline gap-2">
          <span className="font-mono-caps text-warm-taupe">total</span>
          <TickingNumber value={total} />
        </div>
      </GlassPanel>
    </div>
  );
}

function Row({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: dot, boxShadow: `0 0 8px ${dot}` }}
      />
      <span className="font-mono-caps text-charcoal-earth">{label}</span>
      <TickingNumber value={value} />
    </div>
  );
}

function TickingNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const step = value > display ? 1 : -1;
    const iv = setInterval(() => {
      setDisplay((d) => {
        if (d === value) {
          clearInterval(iv);
          return d;
        }
        return d + step;
      });
    }, 80);
    return () => clearInterval(iv);
  }, [value, display]);
  return (
    <span className="font-mono text-base font-semibold tabular-nums text-charcoal-earth">
      {display}
    </span>
  );
}
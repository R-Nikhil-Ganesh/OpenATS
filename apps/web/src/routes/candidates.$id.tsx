import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Check,
  Link as LinkIcon,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { applicationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";

const API_BASE_URL =
  import.meta.env.VITE_PUBLIC_API_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export const Route = createFileRoute("/candidates/$id")({
  head: ({ loaderData }) => ({
    meta: [
      { title: `Candidate Details — OpenATS` },
      {
        name: "description",
        content: `Candidate profile details and AI assessment.`,
      },
    ],
  }),
  component: CandidateDetail,
});

const TABS = [
  "Profile",
  "AI Analysis",
  "Extracted Text",
  "History",
  "Link Validation",
] as const;

function CandidateDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("AI Analysis");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;

    async function loadPdf() {
      try {
        const token = getAccessToken();
        const response = await fetch(`${API_BASE_URL}/applications/${id}/resume`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to load PDF (HTTP ${response.status})`);
        }
        const blob = await response.blob();
        if (active) {
          const localUrl = URL.createObjectURL(blob);
          urlToRevoke = localUrl;
          setPdfUrl(localUrl);
        }
      } catch (err: any) {
        console.error("[PDF Load] Error loading resume PDF:", err);
        if (active) {
          setPdfError(err.message || "Failed to load PDF");
        }
      }
    }

    loadPdf();

    return () => {
      active = false;
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [id]);

  const { data: appDetail, isLoading } = useQuery({
    queryKey: ["application-detail", id],
    queryFn: () => applicationsApi.get(id),
  });

  const { data: historyData } = useQuery({
    queryKey: ["application-history", id],
    queryFn: () => applicationsApi.getHistory(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) =>
      applicationsApi.updateStatus(id, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["application-history", id] });
      alert("Status updated successfully!");
    },
    onError: (err: any) => {
      alert("Failed to update status: " + (err.response?.data?.error?.message || err.message));
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => applicationsApi.reprocess(id),
    onSuccess: () => {
      alert("Reprocessing triggered successfully!");
    },
    onError: (err: any) => {
      alert("Failed to trigger reprocessing: " + (err.response?.data?.error?.message || err.message));
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!appDetail) {
    return (
      <div className="glass p-8">
        <h1 className="font-display text-2xl">Candidate profile not found</h1>
      </div>
    );
  }

  const { candidate, resume, latest_evaluation, status } = appDetail;
  const score = latest_evaluation?.score || 0;
  const tier = latest_evaluation?.tier || "unscored";

  // Determine next workflow transitions
  let nextStatus = "";
  let advanceLabel = "";
  if (status === "reviewable") {
    nextStatus = "screening";
    advanceLabel = "Advance to screening";
  } else if (status === "screening") {
    nextStatus = "interviewing";
    advanceLabel = "Advance to interviewing";
  } else if (status === "interviewing") {
    nextStatus = "hired";
    advanceLabel = "Advance to hired";
  } else if (status === "hired" || status === "rejected") {
    nextStatus = "archived";
    advanceLabel = "Archive application";
  }

  const handleAdvance = () => {
    if (nextStatus) {
      updateStatusMutation.mutate({ status: nextStatus });
    }
  };

  const handleReject = () => {
    updateStatusMutation.mutate({ status: "rejected" });
  };

  const handleReprocess = () => {
    reprocessMutation.mutate();
  };

  return (
    <section className="mt-4 space-y-6">
      <div className="font-mono-caps flex items-center gap-1.5 text-warm-taupe">
        <Link to="/jobs" className="hover:text-charcoal-earth">
          jobs
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          to="/jobs/$id"
          params={{ id: appDetail.job_id }}
          className="hover:text-charcoal-earth"
        >
          {appDetail.job_title || "job"}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-charcoal-earth">{candidate.full_name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Resume preview */}
        <div className="glass diag-highlight panel-in relative p-6">
          <div className="relative z-10 mb-4 flex items-center justify-between">
            <div className="font-mono-caps text-warm-taupe">resume_preview</div>
            <div className="flex items-center gap-2">
              <button className="btn-glass-ghost !p-2" disabled>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono-caps text-warm-taupe">1 / 1</span>
              <button className="btn-glass-ghost !p-2" disabled>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            className="relative z-10 w-full h-[620px] rounded-xl overflow-hidden border border-white/10 bg-black/20"
            style={{ boxShadow: "0 4px 24px rgba(46,42,32,0.15)" }}
          >
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-none"
                title="Resume PDF"
              />
            ) : pdfError ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-warm-taupe font-mono text-xs">
                <AlertTriangle className="h-8 w-8 text-muted-terracotta mb-2 animate-bounce" />
                <span className="font-semibold text-charcoal-earth mb-2">Could not render PDF preview</span>
                <div className="max-w-xs text-left whitespace-pre-line overflow-y-auto max-h-[300px] border border-white/5 bg-white/5 rounded p-3 text-warm-taupe">
                  {resume?.extracted_markdown || "No resume text extracted."}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-warm-taupe font-mono text-xs">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mb-3"></div>
                Loading resume PDF...
              </div>
            )}
          </div>
        </div>

        {/* Candidate info */}
        <div className="glass diag-highlight panel-in relative p-6">
          <div className="relative z-10 flex items-start gap-5">
            <ScoreRing score={score} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold leading-tight text-charcoal-earth">
                {candidate.full_name}
              </h1>
              <div className="font-mono-caps mt-1 text-warm-taupe">
                {candidate.location || "Remote"} · {candidate.email}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={
                    tier === "A"
                      ? "tier-badge-a"
                      : tier === "B"
                        ? "tier-badge-b"
                        : tier === "C"
                          ? "tier-badge-c"
                          : "opacity-40"
                  }
                >
                  TIER_{tier}
                </span>
                <span
                  className="font-mono-caps rounded-full px-3 py-1"
                  style={{
                    background: "var(--ov-mint-soft)",
                    border: "1px solid var(--ov-mint-border)",
                  }}
                >
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="relative z-10 mt-6 flex flex-wrap items-center gap-1.5 rounded-full p-1"
            style={{
              background: "var(--ov-w-2)",
              border: "1px solid var(--ov-w-3)",
            }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  tab === t
                    ? "text-charcoal-earth"
                    : "text-warm-taupe hover:text-charcoal-earth",
                )}
                style={
                  tab === t
                    ? {
                        background: "var(--ov-gold-med)",
                        border: "1px solid var(--ov-w-3)",
                        boxShadow: "inset 0 1px 0 var(--ov-w-3)",
                      }
                    : undefined
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative z-10 mt-5">
            {tab === "AI Analysis" && (
              <AIAnalysis evaluation={latest_evaluation} />
            )}
            {tab === "Profile" && (
              <p className="text-sm text-charcoal-earth/85">
                {latest_evaluation?.recommendation || "No recommendation summary generated yet."}
              </p>
            )}
            {tab === "Extracted Text" && (
              <pre className="whitespace-pre-wrap font-mono text-xs text-charcoal-earth/80 max-h-[400px] overflow-y-auto">
                {resume?.extracted_markdown || "No extracted text available."}
              </pre>
            )}
            {tab === "History" && (
              <div className="space-y-4">
                {historyData && historyData.length > 0 ? (
                  historyData.map((h, i) => (
                    <div key={i} className="flex gap-3 text-sm text-charcoal-earth">
                      <span className="font-mono text-warm-taupe">
                        {new Date(h.changed_at).toLocaleString()}
                      </span>
                      <span>
                        Status transitioned from{" "}
                        <strong className="font-semibold text-sunlit-clay">{h.from_status || "None"}</strong> to{" "}
                        <strong className="font-semibold text-sunlit-clay">{h.to_status}</strong>
                        {h.note && <p className="mt-1 text-xs text-warm-taupe italic">"{h.note}"</p>}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="font-mono-caps text-warm-taupe">no_events_yet</div>
                )}
              </div>
            )}
            {tab === "Link Validation" && (
              <LinkValidation id={id} />
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div
        className="glass diag-highlight relative flex flex-wrap items-center justify-end gap-2 p-3"
        style={{ borderRadius: 999 }}
      >
        <button
          className="btn-glass-ghost relative z-10"
          onClick={handleReprocess}
          disabled={reprocessMutation.isPending}
        >
          <RefreshCw className="h-4 w-4" />{" "}
          {reprocessMutation.isPending ? "Reprocessing..." : "Reprocess"}
        </button>
        {status !== "rejected" && status !== "archived" && (
          <button
            className="btn-glass-destructive relative z-10"
            onClick={handleReject}
            disabled={updateStatusMutation.isPending}
          >
            <X className="h-4 w-4" /> Reject
          </button>
        )}
        {nextStatus && (
          <button
            className="btn-glass-primary relative z-10"
            onClick={handleAdvance}
            disabled={updateStatusMutation.isPending}
          >
            <Check className="h-4 w-4" /> {advanceLabel}
          </button>
        )}
      </div>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * score);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const size = 108;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (progress / 100) * c;

  return (
    <div className="relative flex h-[108px] w-[108px] items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--ov-gold-soft) 0%, transparent 65%)",
          filter: "blur(8px)",
        }}
      />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--lime-cream)" />
            <stop offset="50%" stopColor="var(--light-gold)" />
            <stop offset="100%" stopColor="var(--sunlit-clay)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--ov-w-3)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#score-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums text-charcoal-earth">
          {Math.round(progress)}
        </span>
        <span className="font-mono-caps -mt-1 text-[9px] text-warm-taupe">/100</span>
      </div>
    </div>
  );
}

function AIAnalysis({ evaluation }: { evaluation: any }) {
  if (!evaluation) {
    return (
      <div className="text-center text-warm-taupe py-6">
        No evaluation completed yet for this application.
      </div>
    );
  }

  const matchedSkills = evaluation.matched_skills || [];
  const missingRequirements = evaluation.missing_requirements || [];
  const strengths = evaluation.reasons?.strengths || [];

  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono-caps mb-2 text-warm-taupe">matched_skills</div>
        <div className="space-y-2.5">
          {matchedSkills.map((s: any) => (
            <div key={s.skill}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-charcoal-earth">{s.skill}</span>
                <span className="font-mono text-sm font-semibold text-sunlit-clay tabular-nums">
                  {Math.round((s.confidence || 0.8) * 100)}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{
                  background: "var(--ov-mint-soft)",
                  border: "1px solid var(--ov-w-3)",
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((s.confidence || 0.8) * 100)}%`,
                    background:
                      "linear-gradient(90deg, var(--lime-cream), var(--light-gold))",
                    boxShadow: "0 0 8px var(--ov-gold-med)",
                  }}
                />
              </div>
              {s.evidence && (
                <p className="mt-1 text-xs text-warm-taupe italic">"{s.evidence}"</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-mono-caps mb-2 text-warm-taupe">missing_requirements</div>
        <div className="flex flex-wrap gap-2">
          {missingRequirements.map((m: string) => (
            <span
              key={m}
              className="font-mono-caps inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
              style={{
                background: "var(--ov-terra-soft)",
                border: "1px solid var(--ov-terra-med)",
                color: "var(--charcoal-earth)",
                boxShadow: "inset 0 1px 0 var(--ov-line)",
              }}
            >
              <X className="h-3 w-3" /> {m}
            </span>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: "var(--ov-gold-soft)",
          border: "1px solid var(--ov-gold-med)",
          boxShadow: "inset 0 1px 0 var(--ov-w-3)",
        }}
      >
        <div className="font-mono-caps mb-2 text-warm-taupe">strengths</div>
        <ul className="space-y-2">
          {strengths.map((s: string) => (
            <li key={s} className="flex items-start gap-2.5 text-sm text-charcoal-earth">
              <span
                className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full"
                style={{
                  background: "var(--ov-mint-strong)",
                  border: "1px solid var(--ov-mint-border)",
                }}
              >
                <Check className="h-3 w-3 text-charcoal-earth" />
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LinkValidation({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: linkChecks, isLoading, isError, error } = useQuery({
    queryKey: ["validate-links", id],
    queryFn: () => applicationsApi.validateLinks(id),
  });

  // Results are cached server-side for 24h, so a plain refetch() would just
  // replay the same cached response — Recheck needs force=true to actually
  // re-run the checks.
  const recheckMutation = useMutation({
    mutationFn: () => applicationsApi.validateLinks(id, true),
    onSuccess: (links) => {
      queryClient.setQueryData(["validate-links", id], links);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-warm-taupe font-mono text-xs">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3"></div>
        Validating candidate links and analyzing repos...
      </div>
    );
  }

  if (isError || !linkChecks) {
    return (
      <div className="p-4 text-center text-warm-taupe font-mono text-xs">
        <AlertTriangle className="h-6 w-6 text-muted-terracotta mx-auto mb-2 animate-bounce" />
        Failed to validate links: {String(error || "Unknown error")}
      </div>
    );
  }

  if (linkChecks.length === 0) {
    return (
      <div className="text-center text-warm-taupe py-8 font-mono-caps text-xs">
        no_links_found_in_resume_or_profile
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 font-mono text-xs">
        <div className="text-warm-taupe">
          Verified {linkChecks.length} links and profile assets
        </div>
        <button
          className="btn-glass-ghost !px-3 !py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
          onClick={() => recheckMutation.mutate()}
          disabled={recheckMutation.isPending}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", recheckMutation.isPending && "animate-spin")} />
          {recheckMutation.isPending ? "Rechecking..." : "Recheck"}
        </button>
      </div>

      <div className="space-y-4">
        {linkChecks.map((l: any, i: number) => {
          const Icon = l.type === "github_repo" || l.type === "github_profile" ? Github : Globe;
          const href = l.url.startsWith("http") ? l.url : `https://${l.url}`;

          if (l.type === "github_profile" && l.githubData) {
            const gd = l.githubData;
            return (
              <div
                key={l.url + i}
                className="glass p-6 rounded-2xl border border-white/5 bg-white/5 space-y-6 relative overflow-hidden transition-all hover:bg-white/[0.06]"
              >
                {/* Header Section */}
                <div className="flex flex-col gap-4 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {gd.avatarUrl ? (
                      <img
                        src={gd.avatarUrl}
                        alt={gd.username}
                        className="w-12 h-12 rounded-full border border-white/10 shadow-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="p-3 rounded-full bg-white/5 border border-white/10 text-charcoal-earth flex-shrink-0">
                        <Github className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-caps text-[10px] text-warm-taupe">GITHUB PROFILE</span>
                        <span className="font-mono-caps text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          ANALYZED
                        </span>
                      </div>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-lg font-bold text-charcoal-earth hover:underline flex items-center gap-1.5 mt-0.5"
                      >
                        <span className="truncate">@{gd.username}</span> <ExternalLink className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Profile Quick Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 w-full">
                    <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center min-w-0">
                      <span className="font-mono text-[9px] text-warm-taupe truncate w-full text-center">repos</span>
                      <span className="font-display text-xs sm:text-sm font-bold text-charcoal-earth truncate w-full text-center">{gd.publicRepos}</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center min-w-0">
                      <span className="font-mono text-[9px] text-warm-taupe truncate w-full text-center">stars</span>
                      <span className="font-display text-xs sm:text-sm font-bold text-charcoal-earth truncate w-full text-center">⭐ {gd.totalStars}</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center min-w-0">
                      <span className="font-mono text-[9px] text-warm-taupe truncate w-full text-center">forks</span>
                      <span className="font-display text-xs sm:text-sm font-bold text-charcoal-earth truncate w-full text-center">🍴 {gd.totalForks}</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center min-w-0">
                      <span className="font-mono text-[9px] text-warm-taupe truncate w-full text-center">followers</span>
                      <span className="font-display text-xs sm:text-sm font-bold text-charcoal-earth truncate w-full text-center">{gd.followers}</span>
                    </div>
                  </div>
                </div>

                {/* Bio / Top Languages */}
                {(gd.bio || (gd.topLanguages && gd.topLanguages.length > 0)) && (
                  <div className="space-y-3">
                    {gd.bio && (
                      <p className="text-sm text-charcoal-earth/80 italic leading-relaxed">
                        "{gd.bio}"
                      </p>
                    )}
                    {gd.topLanguages && gd.topLanguages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="font-mono-caps text-[10px] text-warm-taupe mr-1">Top Languages:</span>
                        {gd.topLanguages.slice(0, 6).map((lang: string) => (
                          <span
                            key={lang}
                            className="font-mono text-[10px] bg-white/10 border border-white/5 text-charcoal-earth rounded-full px-2.5 py-0.5"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Overview Analysis */}
                {gd.analysis ? (
                  <div className="space-y-5 pt-2">
                    {/* Summary Card */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs font-mono-caps text-sunlit-clay">
                        <span className="h-2.5 w-2.5 rounded-full bg-sunlit-clay animate-pulse" />
                        AI Profile Summary
                      </div>
                      <p className="text-sm text-charcoal-earth/90 leading-relaxed">
                        {gd.analysis.summary}
                      </p>
                    </div>

                    {/* Overall Assessment & Skills */}
                    <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
                      {/* Left: Assessment */}
                      <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-2">
                        <div className="font-mono-caps text-xs text-warm-taupe">Technical Assessment</div>
                        <p className="text-sm text-charcoal-earth/95 leading-relaxed">
                          {gd.analysis.overallAssessment}
                        </p>
                      </div>

                      {/* Right: Demonstrated Skills */}
                      {gd.analysis.skills && gd.analysis.skills.length > 0 && (
                        <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-2.5">
                          <div className="font-mono-caps text-xs text-warm-taupe">Key Skills Demonstrated</div>
                          <div className="flex flex-wrap gap-1.5">
                            {gd.analysis.skills.map((skill: string) => (
                              <span
                                key={skill}
                                className="font-mono text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded px-2 py-0.5"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Highlighted Projects */}
                    {gd.analysis.projects && gd.analysis.projects.length > 0 && (
                      <div className="space-y-3">
                        <div className="font-mono-caps text-xs text-warm-taupe border-b border-white/5 pb-1">Highlighted Projects ({gd.analysis.projects.length})</div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {gd.analysis.projects.map((proj: any, idx: number) => (
                            <div
                              key={proj.name + idx}
                              className="group p-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 flex flex-col justify-between cursor-pointer"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-display font-semibold text-sm text-charcoal-earth truncate">
                                    {proj.name}
                                  </span>
                                  {proj.techStack && (
                                    <span className="font-mono text-[9px] bg-white/10 text-charcoal-earth px-2 py-0.5 rounded-full truncate max-w-[120px]">
                                      {proj.techStack}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-charcoal-earth/75 line-clamp-3 leading-relaxed transition-all duration-300 group-hover:text-charcoal-earth/95">
                                  {proj.description || "No description provided."}
                                </p>
                              </div>
                              {proj.significance && (
                                <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-500 ease-in-out group-hover:max-h-40 group-hover:opacity-100 text-[11px] text-warm-taupe italic">
                                  <div className="mt-2.5 pt-2 border-t border-white/5">
                                    <span className="font-semibold text-sunlit-clay not-italic">AI Overview:</span> {proj.significance}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-warm-taupe font-mono text-xs italic bg-white/5 rounded-xl border border-white/5">
                    No automated repository summary generated. Check console for LLM errors.
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={l.url + i}
              className="glass p-5 rounded-2xl border border-white/5 bg-white/5 space-y-4 relative overflow-hidden transition-all hover:bg-white/[0.07]"
            >
              {/* Top Row: Type & HTTP Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-charcoal-earth">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono-caps text-[10px] text-warm-taupe">
                      {l.type.replace("_", " ")}
                    </span>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-charcoal-earth hover:underline flex items-center gap-1 mt-0.5 truncate"
                    >
                      {l.url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>
                </div>

                <span
                  className={cn(
                    "font-mono-caps text-[10px] rounded px-2.5 py-1 font-semibold",
                    l.status === "valid"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  )}
                >
                  {l.status === "valid" ? `Reachable (${l.statusCode})` : `Broken (${l.statusCode || "500"})`}
                </span>
              </div>

              {/* GitHub Repo Details */}
              {l.type === "github_repo" && l.status === "valid" && (
                <div className="space-y-3 pt-1">
                  {l.repoInfo && (
                    <div className="flex items-center gap-4 font-mono text-xs text-warm-taupe">
                      <span>⭐ {l.repoInfo.stars} stars</span>
                      <span>🍴 {l.repoInfo.forks} forks</span>
                      {l.repoInfo.description && (
                        <span className="truncate italic flex-1 max-w-sm">
                          — {l.repoInfo.description}
                        </span>
                      )}
                    </div>
                  )}

                  {l.languages && l.languages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {l.languages.slice(0, 5).map((lang: string) => (
                        <span
                          key={lang}
                          className="font-mono text-[9px] bg-white/10 text-charcoal-earth rounded-full px-2 py-0.5"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI Verification Verdict */}
                  <div
                    className={cn(
                      "p-3.5 rounded-xl border space-y-1.5",
                      l.verdict === "validated"
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-100"
                        : l.verdict === "partial"
                          ? "bg-amber-500/5 border-amber-500/20 text-amber-100"
                          : "bg-rose-500/5 border-rose-500/20 text-rose-100"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs font-mono-caps">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          l.verdict === "validated"
                            ? "bg-emerald-400 animate-pulse"
                            : l.verdict === "partial"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                        )}
                      />
                      AI Skill Verification: {l.verdict.toUpperCase()}
                    </div>
                    <p className="text-xs text-charcoal-earth/80 leading-relaxed font-sans">
                      {l.reason}
                    </p>
                  </div>
                </div>
              )}

              {/* Scholar / ResearchGate Profile Match */}
              {(l.type === "scholar_profile" || l.verdict === "matches" || l.verdict === "mismatch") && l.status === "valid" && (
                <div
                  className={cn(
                    "p-3.5 rounded-xl border space-y-1.5 mt-2",
                    l.verdict === "matches"
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-100"
                      : "bg-rose-500/5 border-rose-500/20 text-rose-100"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs font-mono-caps">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        l.verdict === "matches" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                      )}
                    />
                    Identity Match: {l.verdict === "matches" ? "VERIFIED MATCH" : "IDENTITY WARNING"}
                  </div>
                  <p className="text-xs text-charcoal-earth/80 leading-relaxed">
                    {l.reason}
                  </p>
                </div>
              )}

              {/* General site reachable info */}
              {l.type === "general" && l.status === "valid" && l.verdict === "unknown" && (
                <p className="text-xs text-warm-taupe/90 italic pl-1.5 border-l border-white/10">
                  {l.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

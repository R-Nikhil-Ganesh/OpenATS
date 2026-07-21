import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Edit3,
  LayoutGrid,
  Search,
  ChevronRight,
  List,
  Sparkles,
  Trophy,
  Minus,
  Send,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Mail,
  X,
  Trash2,
} from "lucide-react";
import { jobsApi, applicationsApi, compareApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jobs/$id")({
  head: ({ loaderData }) => ({
    meta: [
      { title: `Job Details — OpenATS` },
      {
        name: "description",
        content: `Live candidate pipeline for role.`,
      },
    ],
  }),
  component: JobDetail,
});

const TABS: ("ALL" | "A" | "B" | "C")[] = ["ALL", "A", "B", "C"];

function JobDetail() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board" | "compare">("list");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [emailNotification, setEmailNotification] = useState<{
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    newStatus: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: job, isLoading: loadingJob } = useQuery({
    queryKey: ["job", id],
    queryFn: () => jobsApi.get(id),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["job-stats", id],
    queryFn: () => jobsApi.stats(id),
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ["job-applications", id],
    queryFn: () => jobsApi.applications(id),
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: (appId: string) => applicationsApi.delete(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-applications", id] });
      queryClient.invalidateQueries({ queryKey: ["job-stats", id] });
    },
    onError: (err: any) => {
      alert("Failed to delete application: " + (err.response?.data?.error?.message || err.message));
    },
  });

  const handleDelete = (appId: string, candidateName: string) => {
    if (window.confirm(`Remove "${candidateName}" from this job? This will permanently delete the application and resume.`)) {
      deleteApplicationMutation.mutate(appId);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      applicationsApi.updateStatus(appId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-applications", id] });
      queryClient.invalidateQueries({ queryKey: ["job-stats", id] });
    },
    onError: (err: any) => {
      alert("Failed to update status: " + (err.response?.data?.error?.message || err.message));
    },
  });

  const handleStatusChange = (appId: string, nextStatus: string) => {
    // If moving from reviewable, find candidate info for email preview
    const app = applications?.find((a) => a.id === appId);
    if (app?.status === "reviewable") {
      setEmailNotification({
        candidateName: app.candidate?.full_name || "Candidate",
        candidateEmail: app.candidate?.email || "",
        jobTitle: job?.title || "this role",
        newStatus: nextStatus,
      });
    }
    updateStatusMutation.mutate({ appId, status: nextStatus });
  };

  const filteredApps = useMemo(() => {
    if (!applications) return [];
    return applications
      .filter((app) => (tab === "ALL" ? true : app.tier === tab))
      .filter((app) =>
        query
          ? app.candidate?.full_name?.toLowerCase().includes(query.toLowerCase()) ||
            app.candidate?.email?.toLowerCase().includes(query.toLowerCase())
          : true,
      );
  }, [applications, tab, query]);

  if (loadingJob || loadingStats || loadingApps) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="glass p-8">
        <h1 className="font-display text-2xl">Job not found</h1>
      </div>
    );
  }

  const totals = stats || { total: 0, queued: 0, processing: 0, done: 0, failed: 0 };
  const progressPct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <section className="mt-4 space-y-6">
      {/* Breadcrumb */}
      <div className="font-mono-caps flex items-center gap-1.5 text-warm-taupe">
        <Link to="/jobs" className="hover:text-charcoal-earth">
          jobs
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-charcoal-earth">#{job.id.slice(0, 8)}</span>
      </div>

      {/* Header card */}
      <div className="glass diag-highlight panel-in relative p-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-charcoal-earth md:text-4xl">
                {job.title}
              </h1>
              <span
                className="font-mono-caps rounded-full px-3 py-1"
                style={{
                  background: "var(--ov-mint-soft)",
                  border: "1px solid var(--ov-mint-border)",
                  boxShadow: "inset 0 1px 0 var(--ov-w-3)",
                }}
              >
                {job.status}
              </span>
            </div>
            <div className="font-mono-caps mt-3 text-warm-taupe">
              {job.department || "General"} · {job.location || "Remote"} · created {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/" className="btn-glass-primary">
              <Upload className="h-4 w-4" /> Upload resumes
            </Link>
            <button
              onClick={() => {
                if (viewMode === "compare") {
                  setViewMode("list");
                } else {
                  setViewMode(viewMode === "board" ? "list" : "board");
                }
              }}
              className={cn(viewMode === "board" ? "btn-glass-primary" : "btn-glass-ghost")}
            >
              {viewMode === "board" ? (
                <>
                  <List className="h-4 w-4" /> View list
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4" /> View board
                </>
              )}
            </button>
            <button className="btn-glass-ghost">
              <Edit3 className="h-4 w-4" /> Edit
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="TOTAL" value={totals.total} />
          <Stat label="QUEUED" value={totals.queued} />
          <Stat label="PROCESSING" value={totals.processing} tone="taupe" />
          <Stat label="DONE" value={totals.done} tone="clay" />
          <Stat label="FAILED" value={totals.failed} tone="terracotta" />
        </div>

        {/* Progress bar */}
        <div className="relative z-10 mt-6">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full"
            style={{
              background: "var(--ov-w-2)",
              border: "1px solid var(--ov-line)",
              boxShadow: "inset 0 1px 0 var(--ov-w-3)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                background:
                  "linear-gradient(90deg, var(--lime-cream), var(--light-gold), var(--sunlit-clay))",
                boxShadow: "0 0 12px var(--ov-gold-med)",
              }}
            />
          </div>
          <div className="font-mono-caps mt-2 flex justify-between text-warm-taupe">
            <span>pipeline_progress</span>
            <span>{progressPct}%</span>
          </div>
        </div>
      </div>

      {/* Candidates Section */}
      {viewMode === "compare" ? (
        <CompareCandidatesView
          applicationIds={selectedAppIds}
          onBack={() => setViewMode("list")}
          jobTitle={job.title}
        />
      ) : viewMode === "board" ? (
        <KanbanBoard
          applications={applications || []}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <h2 className="font-display text-2xl font-semibold text-charcoal-earth">
              Candidates
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-taupe" />
              <input
                className="input-glass pl-9"
                placeholder="Search candidates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  tab === t ? "btn-glass-primary" : "btn-glass-ghost",
                  "text-xs !py-1.5",
                )}
              >
                <span className="font-mono-caps">
                  {t === "ALL" ? "all" : `tier_${t.toLowerCase()}`}
                </span>
              </button>
            ))}
          </div>

          <div className="glass diag-highlight panel-in relative overflow-hidden">
            <div
              className="relative z-10 grid gap-4 px-6 py-3 font-mono-caps text-warm-taupe"
              style={{
                gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr 36px",
                background: "var(--ov-w-1)",
                borderBottom: "1px solid var(--ov-line)",
              }}
            >
              <span></span>
              <span>candidate</span>
              <span>tier</span>
              <span>score</span>
              <span>status</span>
              <span className="text-right">applied</span>
              <span></span>
            </div>
            <div className="relative z-10">
              {filteredApps.map((c, index) => (
                <div
                  key={`${c.id}-${index}`}
                  className="group grid items-center gap-4 px-6 py-4 text-sm transition-colors hover:bg-[var(--ov-gold-soft)]"
                  style={{
                    gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr 36px",
                    borderBottom: "1px solid var(--ov-w-2)",
                  }}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedAppIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAppIds((prev) => [...prev, c.id]);
                        } else {
                          setSelectedAppIds((prev) => prev.filter((id) => id !== c.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-sunlit-clay focus:ring-sunlit-clay cursor-pointer"
                    />
                  </div>
                  <Link
                    to="/candidates/$id"
                    params={{ id: c.id }}
                    className="hover:underline cursor-pointer"
                  >
                    <div className="font-semibold text-charcoal-earth">{c.candidate?.full_name || "Unknown"}</div>
                    <div className="font-mono-caps text-warm-taupe">{c.candidate?.email || ""}</div>
                  </Link>
                  <div>
                    <span
                      className={cn(
                        c.tier === "A"
                          ? "tier-badge-a"
                          : c.tier === "B"
                            ? "tier-badge-b"
                            : c.tier === "C"
                              ? "tier-badge-c"
                              : "opacity-40"
                      )}
                    >
                      {c.tier ? `TIER_${c.tier}` : "UNSCORED"}
                    </span>
                  </div>
                  <div className="font-mono text-lg font-semibold text-charcoal-earth tabular-nums">
                    {c.score !== undefined && c.score !== null ? c.score : "—"}
                    {c.score !== undefined && c.score !== null && (
                      <span className="text-warm-taupe text-xs"> /100</span>
                    )}
                  </div>
                  <div>
                    <span
                      className="font-mono-caps rounded-full px-2.5 py-1"
                      style={{
                        background: "var(--ov-mint-soft)",
                        border: "1px solid var(--ov-mint-border)",
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="font-mono-caps text-right text-warm-taupe">
                    {new Date(c.applied_at).toLocaleDateString()}
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                    <button
                      onClick={() => handleDelete(c.id, c.candidate?.full_name || "this candidate")}
                      disabled={deleteApplicationMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-warm-taupe hover:text-[var(--muted-terracotta)] hover:bg-white/10 cursor-pointer disabled:cursor-not-allowed"
                      title="Delete application"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredApps.length === 0 && (
                <div className="px-6 py-10 text-center text-warm-taupe">
                  No candidates match.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating Compare Action Bar */}
      {selectedAppIds.length === 2 && viewMode !== "compare" && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-6 pointer-events-none">
          <div className="glass panel-in flex items-center gap-6 rounded-full px-6 py-3.5 shadow-xl border border-white/20 pointer-events-auto">
            <div className="text-sm font-medium text-charcoal-earth">
              <span className="font-mono text-sunlit-clay font-bold">2</span> candidates selected
            </div>
            <button
              onClick={() => setViewMode("compare")}
              className="btn-glass-primary flex items-center gap-2 !py-2 !px-4"
            >
              <Sparkles className="h-4 w-4" /> Compare Candidates
            </button>
            <button
              onClick={() => setSelectedAppIds([])}
              className="text-warm-taupe hover:text-charcoal-earth text-sm font-mono-caps cursor-pointer"
            >
              clear
            </button>
          </div>
        </div>
      )}

      {/* Email Notification Modal */}
      {emailNotification && (
        <EmailNotificationModal
          notification={emailNotification}
          onClose={() => setEmailNotification(null)}
        />
      )}
    </section>
  );
}

// ─── Email Notification Modal ────────────────────────────────────────────────

const STATUS_EMAIL_LABELS: Record<string, string> = {
  screening: "has been moved to Screening",
  interviewing: "has been shortlisted for an Interview",
  hired: "has been marked as Hired 🎉",
  rejected: "has not been selected at this time",
  archived: "has been archived",
};

function EmailNotificationModal({
  notification,
  onClose,
}: {
  notification: { candidateName: string; candidateEmail: string; jobTitle: string; newStatus: string };
  onClose: () => void;
}) {
  const statusLabel = STATUS_EMAIL_LABELS[notification.newStatus] || `status changed to ${notification.newStatus}`;
  const subject = `Update on your application – ${notification.jobTitle}`;
  const body = `Dear ${notification.candidateName},\n\nWe wanted to keep you informed about your application for the ${notification.jobTitle} role.\n\nYour application ${statusLabel}.\n\nWe appreciate your interest and will be in touch shortly.\n\nBest regards,\nThe Hiring Team`;

  const mailtoHref = `mailto:${encodeURIComponent(notification.candidateEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass diag-highlight panel-in relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ border: "1px solid var(--ov-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--ov-mint-soft)", border: "1px solid var(--ov-mint-border)" }}
            >
              <Mail className="h-4 w-4 text-charcoal-earth" />
            </div>
            <div>
              <div className="font-semibold text-charcoal-earth text-sm">Candidate email ready to send</div>
              <div className="font-mono-caps text-[10px] text-warm-taupe">candidate_notification</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10 transition-colors text-warm-taupe hover:text-charcoal-earth cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Email Preview */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--ov-w-1)", border: "1px solid var(--ov-w-3)" }}
        >
          <div className="grid grid-cols-[56px_1fr] gap-2 text-xs items-center">
            <span className="font-mono-caps text-warm-taupe">To</span>
            <span className="text-charcoal-earth font-medium break-all">{notification.candidateEmail}</span>
          </div>
          <div className="grid grid-cols-[56px_1fr] gap-2 text-xs items-center" style={{ borderTop: "1px solid var(--ov-w-3)", paddingTop: "12px" }}>
            <span className="font-mono-caps text-warm-taupe">Subject</span>
            <span className="text-charcoal-earth">{subject}</span>
          </div>
          <div
            className="mt-3 pt-3 text-xs leading-relaxed whitespace-pre-wrap text-charcoal-earth"
            style={{ borderTop: "1px solid var(--ov-w-3)" }}
          >
            {body}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <a
            href={mailtoHref}
            className="btn-glass-primary flex-1 flex items-center justify-center gap-2"
            onClick={onClose}
          >
            <Send className="h-4 w-4" /> Open in Email Client
          </a>
          <button onClick={onClose} className="btn-glass-ghost flex items-center gap-2">
            <X className="h-4 w-4" /> Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "clay" | "terracotta" | "taupe";
}) {
  const color =
    tone === "clay"
      ? "var(--sunlit-clay)"
      : tone === "terracotta"
        ? "var(--muted-terracotta)"
        : tone === "taupe"
          ? "var(--warm-taupe)"
          : "var(--charcoal-earth)";
  return (
    <div
      className="diag-highlight relative rounded-2xl px-4 py-3"
      style={{
        background: "var(--ov-w-2)",
        border: "1px solid var(--ov-w-3)",
        boxShadow: "inset 0 1px 0 var(--ov-w-3)",
      }}
    >
      <div
        className="relative z-10 font-display text-3xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
      <div className="font-mono-caps relative z-10 mt-1 text-[10px] text-warm-taupe">
        {label}
      </div>
    </div>
  );
}

// ─── Kanban Board Column Definitions & Component ───────────────────────────────

const KANBAN_COLUMNS = [
  { id: "reviewable", label: "Reviewable", bg: "var(--ov-w-1)" },
  { id: "screening", label: "Screening", bg: "var(--ov-w-2)" },
  { id: "interviewing", label: "Interviewing", bg: "rgba(var(--ov-gold-soft-rgb), 0.1)" },
  { id: "hired", label: "Hired", bg: "rgba(var(--ov-mint-soft-rgb), 0.1)" },
  { id: "rejected", label: "Rejected", bg: "rgba(var(--ov-terra-soft-rgb), 0.1)" },
];

function KanbanBoard({
  applications,
  onStatusChange,
}: {
  applications: any[];
  onStatusChange: (appId: string, nextStatus: string) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {
      reviewable: [],
      screening: [],
      interviewing: [],
      hired: [],
      rejected: [],
    };
    applications.forEach((app) => {
      const status = app.status;
      if (map[status]) {
        map[status].push(app);
      }
    });
    return map;
  }, [applications]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-6">
      {KANBAN_COLUMNS.map((col) => {
        const list = grouped[col.id] || [];
        return (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const appId = e.dataTransfer.getData("text/plain");
              if (appId) {
                onStatusChange(appId, col.id);
              }
            }}
            className="glass p-4 rounded-2xl flex flex-col min-h-[450px]"
            style={{ background: col.bg }}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <span className="font-mono-caps text-sm font-bold text-charcoal-earth">
                {col.label}
              </span>
              <span className="font-mono text-xs bg-white/20 text-charcoal-earth rounded-full px-2 py-0.5 font-semibold">
                {list.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {list.map((app, index) => (
                <div
                  key={`${app.id}-${index}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", app.id);
                  }}
                  className="glass diag-highlight p-3 rounded-xl cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all border border-white/10"
                >
                  <Link
                    to="/candidates/$id"
                    params={{ id: app.id }}
                    className="font-semibold text-charcoal-earth hover:underline block truncate"
                  >
                    {app.candidate?.full_name || "Unknown"}
                  </Link>
                  <div className="font-mono-caps text-[10px] text-warm-taupe mt-0.5 truncate">
                    {app.candidate?.email || ""}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        app.tier === "A"
                          ? "tier-badge-a text-xs"
                          : app.tier === "B"
                            ? "tier-badge-b text-xs"
                            : app.tier === "C"
                              ? "tier-badge-c text-xs"
                              : "opacity-40"
                      )}
                    >
                      {app.tier ? `TIER_${app.tier}` : "UNSCORED"}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-charcoal-earth">
                      {app.score !== undefined && app.score !== null ? `${app.score}/100` : "—"}
                    </span>
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <div className="h-full flex items-center justify-center text-center py-8 text-warm-taupe/65 font-mono text-xs italic">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compare Candidates View Component ──────────────────────────────────────────

function CompareCandidatesView({
  applicationIds,
  onBack,
  jobTitle,
}: {
  applicationIds: string[];
  onBack: () => void;
  jobTitle: string;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["compare-view", ...applicationIds],
    queryFn: () => compareApi.compare(applicationIds as [string, string]),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-warm-taupe">Weighing both resumes and generating AI breakdown...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-4 text-center">
        <AlertTriangle className="h-8 w-8 text-[var(--muted-terracotta)]" />
        <p className="text-sm text-warm-taupe">Couldn't generate candidate comparison. The LLM service may be unavailable.</p>
        <button onClick={() => refetch()} className="btn-glass-primary">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  const { candidates, comparison } = data;
  const names = { a: candidates.a.fullName, b: candidates.b.fullName };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h2 className="font-display text-2xl font-semibold text-charcoal-earth">Compare Candidates</h2>
          <p className="text-xs text-warm-taupe mt-1">Side-by-side comparison for {jobTitle}</p>
        </div>
        <button onClick={onBack} className="btn-glass-ghost flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to list
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Candidates Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CompareHeaderCard candidate={candidates.a} side="a" isWinner={comparison.winner === "a"} />
            <CompareHeaderCard candidate={candidates.b} side="b" isWinner={comparison.winner === "b"} />
          </div>

          {/* Verdict Box */}
          <div className="glass p-5 rounded-2xl relative overflow-hidden" style={{ background: "rgba(var(--ov-gold-soft-rgb), 0.15)" }}>
            <div className="flex items-center gap-2 mb-3">
              {comparison.winner === "tie" ? (
                <Minus className="h-5 w-5 text-warm-taupe" />
              ) : (
                <Trophy className="h-5 w-5 text-sunlit-clay" />
              )}
              <span className="font-mono-caps text-xs font-bold text-sunlit-clay">
                {comparison.winner === "tie" ? "TOO CLOSE TO CALL" : `STRONGER FIT: ${comparison.winner === "a" ? names.a : names.b}`}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-charcoal-earth">{comparison.summary}</p>
          </div>

          {/* Dimension Table */}
          <div className="glass rounded-2xl overflow-hidden border border-white/10">
            <div className="grid grid-cols-2 gap-4 px-4 py-3 border-b border-white/15 bg-white/5 text-xs font-mono-caps text-warm-taupe">
              <span>{names.a}</span>
              <span>{names.b}</span>
            </div>
            <div className="divide-y divide-white/10">
              {comparison.dimensions.map((dim: any, i: number) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-charcoal-earth">{dim.name}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                      dim.edge === "tie"
                        ? "bg-white/10 text-warm-taupe border border-white/15"
                        : "bg-white/10 text-sunlit-clay border border-white/15"
                    )}>
                      {dim.edge === "tie" ? <Minus className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
                      {dim.edge === "tie" ? "TIE" : dim.edge === "a" ? "EDGE A" : "EDGE B"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className={cn("p-2.5 rounded-xl leading-relaxed", dim.edge === "a" ? "bg-white/10 text-charcoal-earth border border-white/10" : "text-warm-taupe")}>
                      {dim.a_assessment}
                    </div>
                    <div className={cn("p-2.5 rounded-xl leading-relaxed", dim.edge === "b" ? "bg-white/10 text-charcoal-earth border border-white/10" : "text-warm-taupe")}>
                      {dim.b_assessment}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-1">
          <ChatPanel applicationIds={applicationIds} names={names} />
        </div>
      </div>
    </div>
  );
}

function CompareHeaderCard({
  candidate,
  side,
  isWinner,
}: {
  candidate: any;
  side: "a" | "b";
  isWinner: boolean;
}) {
  return (
    <div className={cn(
      "glass p-4 rounded-2xl flex items-center gap-4 relative overflow-hidden border",
      isWinner ? "border-sunlit-clay bg-white/5" : "border-white/10 bg-transparent"
    )}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full font-mono text-lg font-bold bg-white/15 border border-white/20 text-charcoal-earth">
        {candidate.score !== null ? Math.round(candidate.score) : "—"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono-caps text-[10px] text-warm-taupe">CANDIDATE_{side.toUpperCase()}</span>
          {isWinner && (
            <span className="text-[10px] font-bold text-sunlit-clay flex items-center gap-1 font-mono-caps">
              <Trophy className="h-3 w-3" /> EDGE
            </span>
          )}
        </div>
        <div className="font-semibold text-charcoal-earth truncate mt-0.5">{candidate.fullName}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded",
            candidate.tier === "A"
              ? "tier-badge-a text-xs"
              : candidate.tier === "B"
                ? "tier-badge-b text-xs"
                : candidate.tier === "C"
                  ? "tier-badge-c text-xs"
                  : "opacity-40"
          )}>
            {candidate.tier ? `TIER_${candidate.tier}` : "UNSCORED"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChatPanel({
  applicationIds,
  names,
}: {
  applicationIds: string[];
  names: { a: string; b: string };
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMutation = useMutation({
    mutationFn: (question: string) =>
      compareApi.ask(applicationIds as [string, string], question, messages),
    onSuccess: (data) => {
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
    },
    onError: () => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry — I couldn't answer that just now. Please try again." },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, askMutation.isPending]);

  const submit = () => {
    const q = input.trim();
    if (!q || askMutation.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    askMutation.mutate(q);
  };

  const suggestions = [
    `Who is stronger overall and why?`,
    `Which one has more relevant experience?`,
    `What are the biggest risks with each?`,
  ];

  return (
    <div className="glass p-4 rounded-2xl flex flex-col h-[550px] border border-white/10 bg-transparent">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
        <Sparkles className="h-4 w-4 text-sunlit-clay" />
        <span className="font-semibold text-charcoal-earth">AI Comparison Assistant</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-xs text-warm-taupe">
              Ask follow-up questions to query details from both resumes and the JD simultaneously.
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setMessages((m) => [...m, { role: "user", content: s }]);
                    askMutation.mutate(s);
                  }}
                  className="w-full text-left p-2.5 text-xs text-charcoal-earth bg-white/5 border border-white/15 rounded-xl hover:bg-white/10 transition cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed",
              m.role === "user"
                ? "bg-gradient-to-br from-light-gold to-sunlit-clay text-charcoal-earth ml-auto rounded-tr-none"
                : "bg-white/10 text-charcoal-earth mr-auto rounded-tl-none border border-white/10"
            )}
          >
            {m.content}
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex items-center gap-1.5 text-xs text-warm-taupe">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
            <span>AI is thinking...</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask a follow-up question..."
          className="input-glass flex-1 text-xs"
        />
        <button
          onClick={submit}
          disabled={!input.trim() || askMutation.isPending}
          className="btn-glass-primary !py-2 !px-3"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

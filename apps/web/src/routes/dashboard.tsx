import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Search,
  Upload,
  ArrowUpRight,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";
import { jobsApi, dashboardApi, type Job } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — OpenATS" },
      {
        name: "description",
        content: "Triage view: what needs your attention right now.",
      },
    ],
  }),
  component: Dashboard,
});

function useTick(target: number, ms = 900) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);
  return n;
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "gold" | "clay" | "lime" | "terra";
}) {
  const n = useTick(value, 900);
  const color =
    tone === "gold"
      ? "#EFD780"
      : tone === "clay"
        ? "#DBA159"
        : tone === "lime"
          ? "#FCFDAF"
          : "#C97B63";
  const borderTint =
    tone === "gold"
      ? "var(--ov-gold-med)"
      : tone === "terra"
        ? "var(--ov-terra-med)"
        : "var(--ov-line)";
  return (
    <div
      className="glass diag-highlight panel-in relative px-4 py-3"
      style={{ borderRadius: 16, borderColor: borderTint }}
    >
      <div
        className="relative z-10 font-display text-3xl font-bold leading-none"
        style={{ color }}
      >
        {n}
      </div>
      <div className="font-mono-caps relative z-10 mt-1.5 text-warm-taupe">
        {label}
      </div>
    </div>
  );
}

function TierBar({ job }: { job: any }) {
  const tierA = Number(job.tier_a_count || 0);
  const tierB = Number(job.tier_b_count || 0);
  const tierC = Number(job.tier_c_count || 0);
  const total = Math.max(1, tierA + tierB + tierC);
  const a = (tierA / total) * 100;
  const b = (tierB / total) * 100;
  const c = (tierC / total) * 100;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--ov-w-1)" }}
    >
      <span style={{ width: `${a}%`, background: "#EFD780" }} />
      <span style={{ width: `${b}%`, background: "#DBA159" }} />
      <span style={{ width: `${c}%`, background: "#C97B63" }} />
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  const tierA = Number(job.tier_a_count || 0);
  const tierB = Number(job.tier_b_count || 0);
  const tierC = Number(job.tier_c_count || 0);
  const applicants = Number(job.total_applicants || 0);

  const updatedTime = new Date(job.updated_at).getTime();
  const lastActivityDaysAgo = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
  const stale = lastActivityDaysAgo >= 5;

  const total = Math.max(1, tierA + tierB + tierC);
  const avgScore = Math.round(
    (tierA * 88 + tierB * 74 + tierC * 58) / total,
  );

  const { data: jobApps } = useQuery({
    queryKey: ["job-applications", job.id],
    queryFn: () => jobsApi.applications(job.id),
  });

  const jobFunnel = useMemo(() => {
    if (!jobApps) return [
      { key: "applied", label: "Applied", count: 0 },
      { key: "reviewable", label: "Review", count: 0 },
      { key: "screening", label: "Screening", count: 0 },
      { key: "interviewing", label: "Interview", count: 0 },
      { key: "hired", label: "Hired", count: 0 },
    ];
    const counts = jobApps.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const reviewable = counts.reviewable || 0;
    const screening = counts.screening || 0;
    const interviewing = counts.interviewing || 0;
    const hired = counts.hired || 0;

    return [
      { key: "applied", label: "Applied", count: jobApps.length },
      { key: "reviewable", label: "Review", count: reviewable + screening + interviewing + hired },
      { key: "screening", label: "Screening", count: screening + interviewing + hired },
      { key: "interviewing", label: "Interview", count: interviewing + hired },
      { key: "hired", label: "Hired", count: hired },
    ];
  }, [jobApps]);

  const conversion =
    jobFunnel[0].count > 0
      ? Math.round(
          (jobFunnel[jobFunnel.length - 1].count / jobFunnel[0].count) * 100,
        )
      : 0;

  return (
    <Link
      to="/jobs/$id"
      params={{ id: job.id }}
      className="job-card group panel-in relative block"
    >
      <div className="job-card-surface glass diag-highlight relative overflow-hidden p-5">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono-caps text-warm-taupe">
              #{job.id.slice(0, 8)} · {job.department || "General"}
            </div>
            <h3 className="font-display mt-1 truncate text-base font-bold text-charcoal-earth">
              {job.title}
            </h3>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-warm-taupe" />
        </div>
        <div className="relative z-10 mt-3 flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold text-charcoal-earth">
            {applicants}
          </span>
          <span className="font-mono-caps text-warm-taupe">applicants</span>
        </div>
        <div className="relative z-10 mt-3">
          <TierBar job={job} />
          <div className="font-mono-caps mt-2 flex gap-3 text-warm-taupe">
            <span style={{ color: "#EFD780" }}>A · {tierA}</span>
            <span style={{ color: "#DBA159" }}>B · {tierB}</span>
            <span style={{ color: "#C97B63" }}>C · {tierC}</span>
          </div>
        </div>
        {stale && (
          <div
            className="font-mono-caps relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1"
            style={{
              background: "var(--ov-terra-soft)",
              border: "1px solid var(--ov-terra-med)",
              color: "#C97B63",
            }}
          >
            <Clock className="h-3 w-3" /> idle {lastActivityDaysAgo}d
          </div>
        )}

        {/* Hover reveal panel */}
        <div className="job-reveal" aria-hidden="true">
          <div className="job-reveal-inner">
            <div className="flex items-center justify-between">
              <div className="font-mono-caps text-warm-taupe inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" style={{ color: "#EFD780" }} />
                role_insight
              </div>
              <div
                className="font-mono-caps rounded-full px-2 py-0.5"
                style={{
                  background: "var(--ov-gold-soft)",
                  border: "1px solid var(--ov-gold-med)",
                  color: "#EFD780",
                }}
              >
                avg {avgScore}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat
                icon={<Users className="h-3 w-3" />}
                label="active"
                value={jobFunnel[0].count}
              />
              <MiniStat
                icon={<TrendingUp className="h-3 w-3" />}
                label="conv"
                value={`${conversion}%`}
                tone="gold"
              />
              <MiniStat
                icon={<Clock className="h-3 w-3" />}
                label="idle"
                value={`${lastActivityDaysAgo}d`}
                tone={stale ? "terra" : undefined}
              />
            </div>

            <div className="mt-3 space-y-1.5">
              {jobFunnel.slice(0, 4).map((s, i) => {
                const w = Math.round((s.count / Math.max(1, jobFunnel[0].count)) * 100);
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="font-mono-caps w-16 shrink-0 text-warm-taupe text-[10px]">
                      {s.label}
                    </div>
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--ov-w-1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(6, w)}%`,
                          background:
                            i === 0
                              ? "#FCFDAF"
                              : i === jobFunnel.length - 1
                                ? "#EFD780"
                                : "#DBA159",
                          transitionDelay: `${120 + i * 80}ms`,
                        }}
                      />
                    </div>
                    <div
                      className="font-mono w-6 text-right text-[10px]"
                      style={{ color: "var(--charcoal-earth)" }}
                    >
                      {s.count}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="font-mono-caps mt-3 inline-flex items-center gap-1 text-[10px]"
              style={{ color: "#EFD780" }}
            >
              open role <ArrowUpRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "gold" | "terra";
}) {
  const color =
    tone === "gold" ? "#EFD780" : tone === "terra" ? "#C97B63" : "var(--charcoal-earth)";
  const bd =
    tone === "gold"
      ? "var(--ov-gold-med)"
      : tone === "terra"
        ? "var(--ov-terra-med)"
        : "var(--ov-line)";
  return (
    <div
      className="rounded-lg px-2 py-1.5"
      style={{ background: "var(--ov-w-1)", border: `1px solid ${bd}` }}
    >
      <div className="font-mono-caps flex items-center gap-1 text-warm-taupe text-[10px]">
        {icon} {label}
      </div>
      <div
        className="font-display mt-0.5 text-base font-bold leading-none"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
  });

  const { data: jobsList, isLoading: loadingJobs } = useQuery({
    queryKey: ["jobs-list"],
    queryFn: jobsApi.list,
  });

  const [funnelRole, setFunnelRole] = useState<string>("all");

  const { data: selectedJobApps } = useQuery({
    queryKey: ["job-applications", funnelRole],
    queryFn: () => jobsApi.applications(funnelRole),
    enabled: funnelRole !== "all",
  });

  const activeJobs = jobsList || [];
  const staleJobs = activeJobs.filter((job) => {
    const updatedTime = new Date(job.updated_at).getTime();
    const lastActivityDaysAgo = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
    return lastActivityDaysAgo >= 5;
  });

  const funnelStages = useMemo(() => {
    if (funnelRole === "all") {
      if (!summary?.status_distribution) {
        return [
          { key: "applied", label: "Applied", count: 0 },
          { key: "reviewable", label: "Review", count: 0 },
          { key: "screening", label: "Screening", count: 0 },
          { key: "interviewing", label: "Interview", count: 0 },
          { key: "hired", label: "Hired", count: 0 },
        ];
      }
      const dist = summary.status_distribution;
      const reviewable = dist.reviewable || 0;
      const screening = dist.screening || 0;
      const interviewing = dist.interviewing || 0;
      const hired = dist.hired || 0;

      return [
        { key: "applied", label: "Applied", count: summary.total_applicants },
        { key: "reviewable", label: "Review", count: reviewable + screening + interviewing + hired },
        { key: "screening", label: "Screening", count: screening + interviewing + hired },
        { key: "interviewing", label: "Interview", count: interviewing + hired },
        { key: "hired", label: "Hired", count: hired },
      ];
    } else {
      if (!selectedJobApps) {
        return [
          { key: "applied", label: "Applied", count: 0 },
          { key: "reviewable", label: "Review", count: 0 },
          { key: "screening", label: "Screening", count: 0 },
          { key: "interviewing", label: "Interview", count: 0 },
          { key: "hired", label: "Hired", count: 0 },
        ];
      }

      const counts = selectedJobApps.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const reviewable = counts.reviewable || 0;
      const screening = counts.screening || 0;
      const interviewing = counts.interviewing || 0;
      const hired = counts.hired || 0;

      return [
        { key: "applied", label: "Applied", count: selectedJobApps.length },
        { key: "reviewable", label: "Review", count: reviewable + screening + interviewing + hired },
        { key: "screening", label: "Screening", count: screening + interviewing + hired },
        { key: "interviewing", label: "Interview", count: interviewing + hired },
        { key: "hired", label: "Hired", count: hired },
      ];
    }
  }, [funnelRole, summary, selectedJobApps]);

  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.count));

  if (loadingSummary || loadingJobs) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <section className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono-caps text-warm-taupe">
            workspace / triage
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-charcoal-earth">
            Good morning.
          </h1>
          <p className="mt-1 text-sm text-warm-taupe">
            {summary?.awaiting_review || 0} candidates awaiting review across{" "}
            {activeJobs.length} open roles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-2"
            style={{
              background: "var(--ov-w-1)",
              border: "1px solid var(--ov-line)",
              minWidth: 240,
            }}
          >
            <Search className="h-4 w-4 text-warm-taupe" />
            <input
              placeholder="Find candidate by name or ID…"
              className="w-full bg-transparent text-sm text-charcoal-earth outline-none placeholder:text-warm-taupe"
            />
          </div>
          <Link to="/" className="btn-glass-primary">
            <Upload className="h-4 w-4" /> Upload resumes
          </Link>
        </div>
      </div>

      {/* Live status counters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard value={summary?.new_resumes || 0} label="NEW_RESUMES" tone="lime" />
        <StatCard value={summary?.awaiting_review || 0} label="AWAITING_REVIEW" tone="gold" />
        <StatCard value={summary?.queue_backlog || 0} label="PROCESSING" tone="clay" />
        <StatCard value={summary?.failed_count || 0} label="FAILED" tone="terra" />
      </div>

      {/* Needs attention */}
      {staleJobs.length > 0 && (
        <div
          className="glass diag-highlight panel-in relative p-5"
          style={{
            borderRadius: 20,
            borderColor: "var(--ov-terra-med)",
          }}
        >
          <div className="relative z-10 flex items-start gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--ov-terra-soft)",
                border: "1px solid var(--ov-terra-med)",
                color: "#C97B63",
              }}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono-caps text-warm-taupe">
                needs_attention
              </div>
              <h3 className="font-display mt-0.5 text-base font-bold text-charcoal-earth">
                {staleJobs.length} role{staleJobs.length > 1 ? "s" : ""} idle for 5+ days
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {staleJobs.map((j) => {
                  const updatedTime = new Date(j.updated_at).getTime();
                  const lastActivityDaysAgo = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
                  return (
                    <Link
                      key={j.id}
                      to="/jobs/$id"
                      params={{ id: j.id }}
                      className="font-mono-caps inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                      style={{
                        background: "var(--ov-w-1)",
                        border: "1px solid var(--ov-terra-med)",
                        color: "#C97B63",
                      }}
                    >
                      {j.title} · {lastActivityDaysAgo}d
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: active roles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-bold text-charcoal-earth">
              Active roles
            </h2>
            <Link
              to="/jobs"
              className="font-mono-caps text-warm-taupe hover:text-charcoal-earth"
            >
              view all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeJobs.slice(0, 4).map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </div>

        {/* Right: real employment funnel */}
        <div
          className="glass diag-highlight panel-in relative self-start p-5"
          style={{ borderRadius: 20 }}
        >
          <div className="relative z-10 mb-4">
            <div className="font-mono-caps text-warm-taupe">
              employment_funnel
            </div>
            <h2 className="font-display mt-0.5 text-base font-bold text-charcoal-earth">
              Where candidates are piling up
            </h2>
            <div className="mt-3 filter-tab-group flex-wrap">
              <button
                type="button"
                onClick={() => setFunnelRole("all")}
                className={`filter-tab ${funnelRole === "all" ? "is-active" : ""}`}
              >
                All roles
                <span className="tab-detail text-warm-taupe">
                  · {activeJobs.length} open
                </span>
              </button>
              {activeJobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setFunnelRole(j.id)}
                  className={`filter-tab ${funnelRole === j.id ? "is-active" : ""}`}
                >
                  {j.title.split(" ").slice(0, 2).join(" ")}
                  <span className="tab-detail text-warm-taupe">
                    · #{j.id.slice(0, 5)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-1.5">
            {funnelStages.map((stage, i) => {
              const prev = i > 0 ? funnelStages[i - 1].count : null;
              const dropoff =
                prev && prev > 0
                  ? Math.round(((prev - stage.count) / prev) * 100)
                  : null;
              const isHired = stage.key === "hired";
              const widthPct = Math.max(
                18,
                Math.round((stage.count / funnelMax) * 100),
              );
              const tone = isHired
                ? { bg: "var(--ov-gold-soft)", bd: "var(--ov-gold-med)", fg: "#EFD780" }
                : i === 0
                  ? { bg: "var(--ov-w-2)", bd: "var(--ov-line)", fg: "var(--charcoal-earth)" }
                  : i >= funnelStages.length - 2
                    ? { bg: "var(--ov-clay-soft)", bd: "var(--ov-clay-med)", fg: "#DBA159" }
                    : { bg: "var(--ov-w-1)", bd: "var(--ov-line)", fg: "var(--charcoal-earth)" };
              return (
                <div key={stage.key} className="flex flex-col items-center">
                  <div
                    className="relative flex h-12 items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 160,
                      background: tone.bg,
                      border: `1px solid ${tone.bd}`,
                      borderRadius: 12,
                      boxShadow: isHired
                        ? "0 0 22px var(--glow-gold), inset 0 1px 0 var(--ov-w-3)"
                        : "inset 0 1px 0 var(--ov-w-2)",
                    }}
                  >
                    <div className="font-mono-caps text-warm-taupe">
                      {stage.label}
                    </div>
                    <div
                      className="font-display text-xl font-bold leading-none"
                      style={{ color: tone.fg }}
                    >
                      {stage.count}
                    </div>
                  </div>
                  {dropoff !== null && (
                    <div
                      className="font-mono mt-0.5 text-[10px]"
                      style={{ color: "#C97B63" }}
                    >
                      ↓ −{dropoff}% drop-off
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="relative z-10 mt-4 flex items-center justify-between rounded-xl px-3 py-2 font-mono-caps text-warm-taupe"
            style={{ background: "var(--ov-w-1)", border: "1px solid var(--ov-line)" }}
          >
            <span>conversion · applied → hired</span>
            <span style={{ color: "#EFD780" }}>
              {funnelStages[0].count > 0
                ? Math.round(
                    (funnelStages[funnelStages.length - 1].count /
                      funnelStages[0].count) *
                      100,
                  )
                : 0}
              %
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
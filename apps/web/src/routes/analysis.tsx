import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, TrendingUp, X } from "lucide-react";
import { jobsApi, dashboardApi, type Job } from "@/lib/api";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis — OpenATS" },
      {
        name: "description",
        content:
          "Trend and insight view: funnel conversion, tier distribution, skill gaps, AI accuracy.",
      },
    ],
  }),
  component: AnalysisPage,
});

type TabKey = "overview" | "funnel" | "tiers" | "gaps" | "accuracy";
const TABS: { key: TabKey; label: string; detail: string }[] = [
  { key: "overview", label: "Overview", detail: "· top-line health" },
  { key: "funnel", label: "Funnel Trends", detail: "· stage conversion" },
  { key: "tiers", label: "Score & Tier", detail: "· A/B/C distribution" },
  { key: "gaps", label: "Skill Gaps", detail: "· most-missed reqs" },
  { key: "accuracy", label: "AI Accuracy", detail: "· override rate" },
];

const GOLD = "#EFD780";
const CLAY = "#DBA159";
const TERRA = "#C97B63";
const MINT = "#D0E3CC";

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`glass diag-highlight panel-in relative p-5 ${className}`}
      style={{ borderRadius: 20 }}
    >
      <div className="relative z-10 mb-3">
        <h3 className="font-display text-lg font-bold text-charcoal-earth">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-warm-taupe">{subtitle}</p>
        )}
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function StatCard({
  value,
  label,
  tone,
  hint,
}: {
  value: string;
  label: string;
  tone: "gold" | "clay" | "terra" | "mint";
  hint?: string;
}) {
  const color =
    tone === "gold" ? GOLD : tone === "clay" ? CLAY : tone === "terra" ? TERRA : MINT;
  const bd =
    tone === "gold"
      ? "var(--ov-gold-med)"
      : tone === "terra"
        ? "var(--ov-terra-med)"
        : tone === "clay"
          ? "var(--ov-clay-med)"
          : "var(--ov-line)";
  return (
    <div
      className="glass diag-highlight panel-in relative px-5 py-4"
      style={{ borderRadius: 16, borderColor: bd }}
    >
      <div
        className="relative z-10 font-display text-3xl font-bold leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="font-mono-caps relative z-10 mt-2 text-warm-taupe">
        {label}
      </div>
      {hint && (
        <div className="relative z-10 mt-1 text-[11px] text-warm-taupe">
          {hint}
        </div>
      )}
    </div>
  );
}

function InsightCallout({
  tone = "terra",
  icon,
  children,
}: {
  tone?: "terra" | "gold" | "mint";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bg =
    tone === "gold"
      ? "var(--ov-gold-soft)"
      : tone === "mint"
        ? "var(--ov-w-2)"
        : "var(--ov-terra-soft)";
  const bd =
    tone === "gold"
      ? "var(--ov-gold-med)"
      : tone === "mint"
        ? "var(--ov-line)"
        : "var(--ov-terra-med)";
  const fg = tone === "gold" ? GOLD : tone === "mint" ? MINT : TERRA;
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] text-warm-taupe"
      style={{ background: bg, border: `1px solid ${bd}` }}
    >
      <span style={{ color: fg }} className="mt-0.5 shrink-0">
        {icon ?? <AlertTriangle className="h-3.5 w-3.5" />}
      </span>
      <span>{children}</span>
    </div>
  );
}

/* ---------- Funnel Trends chart (multi-series line) ---------- */

const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
const FUNNEL_SERIES = [
  { key: "a_s", label: "Applied → Shortlist", color: GOLD, values: [42, 46, 40, 44, 48, 45, 47, 50] },
  { key: "s_i", label: "Shortlist → Interview", color: CLAY, values: [38, 36, 32, 30, 28, 27, 26, 24] },
  { key: "i_o", label: "Interview → Offer", color: MINT, values: [52, 54, 55, 58, 60, 61, 63, 62] },
  { key: "o_h", label: "Offer → Hired", color: TERRA, values: [70, 72, 68, 74, 72, 75, 77, 76] },
];

function LineChart() {
  const w = 640;
  const h = 220;
  const pad = { l: 32, r: 12, t: 12, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const yMax = 100;
  const xStep = iw / (WEEKS.length - 1);
  const yFor = (v: number) => pad.t + ih - (v / yMax) * ih;
  const xFor = (i: number) => pad.l + i * xStep;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[560px] w-full">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="var(--ov-line)"
              strokeDasharray="2 4"
            />
            <text
              x={pad.l - 6}
              y={yFor(g) + 3}
              textAnchor="end"
              className="font-mono"
              fontSize="9"
              fill="var(--warm-taupe)"
            >
              {g}
            </text>
          </g>
        ))}
        {WEEKS.map((wk, i) => (
          <text
            key={wk}
            x={xFor(i)}
            y={h - 8}
            textAnchor="middle"
            className="font-mono"
            fontSize="9"
            fill="var(--warm-taupe)"
          >
            {wk}
          </text>
        ))}
        {FUNNEL_SERIES.map((s) => {
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`)
            .join(" ");
          const area =
            d +
            ` L${xFor(s.values.length - 1)},${yFor(0)} L${xFor(0)},${yFor(0)} Z`;
          return (
            <g key={s.key}>
              <path d={area} fill={s.color} opacity={0.06} />
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3">
        {FUNNEL_SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[11px] text-warm-taupe">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Tier distribution per role (stacked bars) ---------- */

function TierStackedBars({ jobs }: { jobs: Job[] }) {
  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const tierA = Number(j.tier_a_count || 0);
        const tierB = Number(j.tier_b_count || 0);
        const tierC = Number(j.tier_c_count || 0);
        const total = tierA + tierB + tierC || 1;
        const a = (tierA / total) * 100;
        const b = (tierB / total) * 100;
        const c = (tierC / total) * 100;
        return (
          <div key={j.id}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-charcoal-earth">{j.title}</span>
              <span className="font-mono text-warm-taupe">
                {tierA + tierB + tierC} scored
              </span>
            </div>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full"
              style={{ background: "var(--ov-w-1)" }}
            >
              <span style={{ width: `${a}%`, background: GOLD }} />
              <span style={{ width: `${b}%`, background: CLAY }} />
              <span style={{ width: `${c}%`, background: TERRA }} />
            </div>
            <div className="font-mono-caps mt-1 flex gap-3 text-[10px] text-warm-taupe">
              <span style={{ color: GOLD }}>A · {tierA}</span>
              <span style={{ color: CLAY }}>B · {tierB}</span>
              <span style={{ color: TERRA }}>C · {tierC}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Score distribution histogram ---------- */

const SCORE_BUCKETS = [
  { range: "0–39", count: 4, tone: TERRA },
  { range: "40–54", count: 9, tone: TERRA },
  { range: "55–64", count: 14, tone: CLAY },
  { range: "65–74", count: 22, tone: CLAY },
  { range: "75–84", count: 18, tone: GOLD },
  { range: "85–94", count: 11, tone: GOLD },
  { range: "95–100", count: 3, tone: GOLD },
];

function Histogram({ distribution }: { distribution?: Array<{ bucket: string; count: number }> }) {
  const buckets = useMemo(() => {
    if (!distribution || distribution.length === 0) {
      return SCORE_BUCKETS;
    }
    return SCORE_BUCKETS.map((b) => {
      const match = distribution.find((d) => d.bucket === b.range);
      return {
        ...b,
        count: match ? Number(match.count) : 0,
      };
    });
  }, [distribution]);

  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="flex h-40 items-end gap-2">
      {buckets.map((b) => {
        const hpct = (b.count / max) * 100;
        return (
          <div key={b.range} className="flex flex-1 flex-col items-center gap-1">
            <div className="font-mono text-[10px] text-warm-taupe">{b.count}</div>
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{
                height: `${hpct}%`,
                background: b.tone,
                opacity: 0.85,
                boxShadow: `0 0 12px ${b.tone}33`,
              }}
            />
            <div className="font-mono-caps text-[9px] text-warm-taupe">
              {b.range}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Skill gaps ---------- */

const SKILL_GAPS = [
  { skill: "3+ years Go", pct: 68 },
  { skill: "Kubernetes production experience", pct: 61 },
  { skill: "gRPC / protobuf", pct: 54 },
  { skill: "Kafka at scale", pct: 47 },
  { skill: "OpenTelemetry", pct: 39 },
  { skill: "Postgres partitioning", pct: 33 },
];

function SkillGapsList({ gaps }: { gaps?: Array<{ skill: string; count: number }> }) {
  const list = useMemo(() => {
    if (!gaps || gaps.length === 0) {
      return SKILL_GAPS;
    }
    const total = gaps.reduce((sum, g) => sum + Number(g.count), 0) || 1;
    return gaps.map((g) => ({
      skill: g.skill,
      pct: Math.round((Number(g.count) / total) * 100),
    }));
  }, [gaps]);

  return (
    <div className="space-y-2">
      {list.map((g) => {
        const high = g.pct > 60;
        return (
          <div
            key={g.skill}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: "var(--ov-terra-soft)",
              border: `1px solid ${high ? "var(--ov-terra-med)" : "var(--ov-line)"}`,
            }}
          >
            <X className="h-3.5 w-3.5 shrink-0" style={{ color: TERRA }} />
            <div className="min-w-0 flex-1 text-[13px] text-charcoal-earth">
              {g.skill}
            </div>
            <div
              className="font-mono text-[11px]"
              style={{ color: high ? TERRA : "var(--warm-taupe)" }}
            >
              {g.pct}% missing
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- AI accuracy ---------- */

const OVERRIDE_TREND = [22, 20, 19, 17, 16, 14, 13, 11];

function OverrideTrend() {
  const w = 400;
  const h = 140;
  const pad = 20;
  const max = 30;
  const step = (w - pad * 2) / (OVERRIDE_TREND.length - 1);
  const yFor = (v: number) => pad + ((max - v) / max) * (h - pad * 2);
  const d = OVERRIDE_TREND.map(
    (v, i) => `${i === 0 ? "M" : "L"}${pad + i * step},${yFor(v)}`,
  ).join(" ");
  const area = d + ` L${pad + (OVERRIDE_TREND.length - 1) * step},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={area} fill={MINT} opacity={0.08} />
      <path d={d} fill="none" stroke={MINT} strokeWidth={2} />
      {OVERRIDE_TREND.map((v, i) => (
        <circle key={i} cx={pad + i * step} cy={yFor(v)} r={2.5} fill={MINT} />
      ))}
    </svg>
  );
}

function AnalysisPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [role, setRole] = useState<string>("all");

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
  });

  const { data: jobsList } = useQuery({
    queryKey: ["jobs-list"],
    queryFn: jobsApi.list,
  });

  const { data: metrics } = useQuery({
    queryKey: ["analysis-metrics"],
    queryFn: dashboardApi.analysis,
  });

  const { data: selectedJobApps } = useQuery({
    queryKey: ["job-applications", role],
    queryFn: () => jobsApi.applications(role),
    enabled: role !== "all",
  });

  const activeJobs = jobsList || [];

  const funnel = useMemo(() => {
    if (role === "all") {
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
  }, [role, summary, selectedJobApps]);

  const dropoffs = useMemo(() => {
    return funnel.slice(1).map((s, i) => {
      const prev = funnel[i].count;
      const drop = prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : 0;
      return { from: funnel[i].label, to: s.label, drop };
    });
  }, [funnel]);
  const biggestDrop = [...dropoffs].sort((a, b) => b.drop - a.drop)[0];

  return (
    <section className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono-caps text-warm-taupe">
            workspace / analysis
          </div>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-charcoal-earth">
            How the pipeline is performing.
          </h1>
          <p className="mt-1 text-sm text-warm-taupe">
            Trend and insight only. Triage lives on the Dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-mono-caps text-warm-taupe">role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-full bg-transparent px-3 py-2 text-sm text-charcoal-earth outline-none"
            style={{
              background: "var(--ov-w-1)",
              border: "1px solid var(--ov-line)",
            }}
          >
            <option value="all">All roles</option>
            {activeJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="filter-tab-group flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`filter-tab ${tab === t.key ? "is-active" : ""}`}
          >
            {t.label}
            <span className="tab-detail text-warm-taupe">{t.detail}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard value="18d" label="AVG_TIME_TO_HIRE" tone="gold" hint="↓ 2d vs last quarter" />
            <StatCard value="4.2d" label="AVG_TIME_IN_STAGE" tone="clay" hint="Interview stage longest" />
            <StatCard value={String(summary?.total_applicants || 0)} label="ACTIVE_PIPELINE" tone="mint" hint={`across ${activeJobs.length} open roles`} />
            <StatCard value="11%" label="AI_OVERRIDE_RATE" tone="terra" hint="trending down" />
          </div>
          <Panel
            title="Where candidates fall out"
            subtitle="Snapshot of the current funnel for the selected role."
          >
            <div className="grid gap-2 sm:grid-cols-5">
              {funnel.map((s, i) => (
                <div
                  key={s.key}
                  className="rounded-xl p-3 text-center"
                  style={{
                    background:
                      i === funnel.length - 1
                        ? "var(--ov-gold-soft)"
                        : "var(--ov-w-1)",
                    border: `1px solid ${
                      i === funnel.length - 1
                        ? "var(--ov-gold-med)"
                        : "var(--ov-line)"
                    }`,
                    boxShadow:
                      i === funnel.length - 1
                        ? "0 0 18px var(--glow-gold)"
                        : undefined,
                  }}
                >
                  <div
                    className="font-display text-2xl font-bold"
                    style={{
                      color:
                        i === funnel.length - 1 ? GOLD : "var(--charcoal-earth)",
                    }}
                  >
                    {s.count}
                  </div>
                  <div className="font-mono-caps mt-1 text-[10px] text-warm-taupe">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {biggestDrop && biggestDrop.drop > 0 && (
              <InsightCallout>
                Biggest drop-off:{" "}
                <strong className="text-charcoal-earth">
                  {biggestDrop.from} → {biggestDrop.to}
                </strong>{" "}
                loses {biggestDrop.drop}% of candidates. Consider adjusting the
                screening bar or interview loop.
              </InsightCallout>
            )}
          </Panel>
        </div>
      )}

      {tab === "funnel" && (
        <Panel
          title="Stage conversion over time"
          subtitle="Each line is the % of candidates who moved to the next stage that week."
        >
          <LineChart />
          <InsightCallout icon={<TrendingDown className="h-3.5 w-3.5" />}>
            <strong className="text-charcoal-earth">
              Shortlist → Interview
            </strong>{" "}
            has fallen from 38% to 24% over 8 weeks — the biggest deteriorating
            transition. Interview scheduling or availability is the likely
            bottleneck.
          </InsightCallout>
        </Panel>
      )}

      {tab === "tiers" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Tier distribution per role"
            subtitle="Share of A/B/C candidates in each role's scored pool."
          >
            <TierStackedBars jobs={activeJobs} />
            <InsightCallout tone="gold" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              <strong className="text-charcoal-earth">
                Active Roles Distribution
              </strong>{" "}
              shows Tier A proportions. The JDs are attracting strong candidates.
            </InsightCallout>
          </Panel>
          <Panel
            title="Score distribution"
            subtitle="How scored candidates are spread across score buckets."
          >
            <Histogram distribution={metrics?.score_distribution} />
            <InsightCallout tone="mint">
              Most candidates land in the 65–84 band — the model is
              discriminating well between mid and strong applicants.
            </InsightCallout>
          </Panel>
        </div>
      )}

      {tab === "gaps" && (
        <Panel
          title="Most-missed requirements"
          subtitle="Ranked by how often the requirement is absent from an applicant's resume."
        >
          <SkillGapsList gaps={metrics?.skill_gaps} />
          <InsightCallout>
            <strong className="text-charcoal-earth">3+ years Go</strong> is
            missing on 68% of applicants — unusually high. Consider whether the
            requirement is realistic for the current market, or broaden to
            "backend systems language."
          </InsightCallout>
        </Panel>
      )}

      {tab === "accuracy" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="AI override rate"
            subtitle="% of candidates where HR changed the AI-assigned tier. Lower = more trusted."
          >
            <div className="mb-2 flex items-baseline gap-2">
              <span
                className="font-display text-4xl font-bold"
                style={{ color: MINT }}
              >
                11%
              </span>
              <span className="font-mono-caps text-warm-taupe">this week</span>
            </div>
            <OverrideTrend />
            <InsightCallout tone="mint" icon={<TrendingDown className="h-3.5 w-3.5" />}>
              Override rate has fallen from 22% to 11% over 8 weeks — HR is
              agreeing with the model more often.
            </InsightCallout>
          </Panel>
          <Panel
            title="Override direction"
            subtitle="When HR does override, are they upgrading or downgrading the AI's call?"
          >
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-charcoal-earth">
                    Upgraded (AI too harsh)
                  </span>
                  <span className="font-mono text-warm-taupe">62%</span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--ov-w-1)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "62%",
                      background: GOLD,
                      boxShadow: `0 0 12px ${GOLD}55`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-charcoal-earth">
                    Downgraded (AI too lenient)
                  </span>
                  <span className="font-mono text-warm-taupe">38%</span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--ov-w-1)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "38%",
                      background: TERRA,
                      boxShadow: `0 0 12px ${TERRA}55`,
                    }}
                  />
                </div>
              </div>
            </div>
            <InsightCallout tone="gold" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              Overrides skew toward{" "}
              <strong className="text-charcoal-earth">upgrading</strong>. The
              scoring model is slightly conservative — worth a threshold tune.
            </InsightCallout>
          </Panel>
        </div>
      )}
    </section>
  );
}

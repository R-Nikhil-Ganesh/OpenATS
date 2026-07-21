import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { candidatesApi } from "@/lib/api";

type Tier = "A" | "B" | "C";

export const Route = createFileRoute("/candidates/")({
  head: () => ({
    meta: [
      { title: "Candidates — OpenATS" },
      { name: "description", content: "All candidates across every open role." },
    ],
  }),
  component: CandidatesIndex,
});

function CandidatesIndex() {
  const [filter, setFilter] = useState<"all" | Tier>("all");

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: candidatesApi.list,
  });

  const counts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0 } as Record<Tier, number>;
    if (!candidates) return c;
    candidates.forEach((x) => {
      if (x.tier && x.tier in c) {
        c[x.tier as Tier] += 1;
      }
    });
    return c;
  }, [candidates]);

  const avg = useMemo(() => {
    const a: Record<Tier, number[]> = { A: [], B: [], C: [] };
    if (!candidates) return { A: 0, B: 0, C: 0 };
    candidates.forEach((x) => {
      if (x.tier && x.tier in a && x.score !== undefined && x.score !== null) {
        a[x.tier as Tier].push(x.score);
      }
    });
    return {
      A: a.A.length ? Math.round(a.A.reduce((s, n) => s + n, 0) / a.A.length) : 0,
      B: a.B.length ? Math.round(a.B.reduce((s, n) => s + n, 0) / a.B.length) : 0,
      C: a.C.length ? Math.round(a.C.reduce((s, n) => s + n, 0) / a.C.length) : 0,
    };
  }, [candidates]);

  const visible = useMemo(() => {
    if (!candidates) return [];
    // Only show candidates who actually have an application
    const withApps = candidates.filter((c) => c.application_id);
    return filter === "all" ? withApps : withApps.filter((c) => c.tier === filter);
  }, [candidates, filter]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalCount = candidates?.filter((c) => c.application_id).length || 0;

  return (
    <section className="mt-4 space-y-6">
      <div className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono-caps text-warm-taupe">workspace / candidates</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-charcoal-earth">
            Candidates
          </h1>
        </div>
        <div className="filter-tab-group">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`filter-tab ${filter === "all" ? "is-active" : ""}`}
          >
            All
            <span className="tab-detail text-warm-taupe">· {totalCount} total</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("A")}
            className={`filter-tab ${filter === "A" ? "is-active-a" : ""}`}
          >
            Tier A
            <span className="tab-detail">· {counts.A} · avg {avg.A}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("B")}
            className={`filter-tab ${filter === "B" ? "is-active-b" : ""}`}
          >
            Tier B
            <span className="tab-detail">· {counts.B} · avg {avg.B}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("C")}
            className={`filter-tab ${filter === "C" ? "is-active-c" : ""}`}
          >
            Tier C
            <span className="tab-detail">· {counts.C} · avg {avg.C}</span>
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((c) => (
          <Link
            key={c.id}
            to="/candidates/$id"
            params={{ id: c.application_id! }}
            className="glass diag-highlight glass-hover panel-in relative flex items-center gap-4 p-5"
          >
            <div
              className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full font-display text-lg font-bold text-charcoal-earth"
              style={{
                background: "var(--ov-clay-soft)",
                border: "1px solid var(--ov-w-3)",
              }}
            >
              {c.full_name?.charAt(0) || "?"}
            </div>
            <div className="relative z-10 min-w-0 flex-1">
              <div className="truncate font-semibold text-charcoal-earth">{c.full_name}</div>
              <div className="font-mono-caps truncate text-warm-taupe">
                {c.job_title || "No active application"}
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <span
                className={
                  c.tier === "A"
                    ? "tier-badge-a"
                    : c.tier === "B"
                      ? "tier-badge-b"
                      : c.tier === "C"
                        ? "tier-badge-c"
                        : "opacity-40"
                }
              >
                {c.tier ? `TIER_${c.tier}` : "UNSCORED"}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-charcoal-earth">
                {c.score !== null && c.score !== undefined ? c.score : "—"}
              </span>
            </div>
          </Link>
        ))}
        {visible.length === 0 && (
          <div className="col-span-2 py-10 text-center text-warm-taupe">
            No candidates match.
          </div>
        )}
      </div>
    </section>
  );
}
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, ArrowUpRight, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — OpenATS" },
      { name: "description", content: "All open roles and their live intake pipelines." },
      { property: "og:title", content: "Jobs — OpenATS" },
      { property: "og:description", content: "All open roles and their live intake pipelines." },
    ],
  }),
  component: JobsIndex,
});

function JobsIndex() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [rawJd, setRawJd] = useState("");
  const [expMin, setExpMin] = useState<number>(0);
  const [expMax, setExpMax] = useState<number>(10);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.list,
  });

  const createJobMutation = useMutation({
    mutationFn: jobsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setIsOpen(false);
      setTitle("");
      setDepartment("");
      setLocation("");
      setRawJd("");
      setExpMin(0);
      setExpMax(10);
      alert("Job role created successfully!");
    },
    onError: (err: any) => {
      alert("Failed to create job: " + (err.response?.data?.error?.message || err.message));
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const jobsList = jobs || [];

  return (
    <section className="mt-6">
      <div className="mb-6 flex items-end justify-between px-1">
        <div>
          <div className="font-mono-caps text-warm-taupe">workspace / jobs</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-charcoal-earth">
            Jobs
          </h1>
        </div>
        <button className="btn-glass-primary" onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4" /> New job
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {jobsList.map((j) => (
          <Link
            key={j.id}
            to="/jobs/$id"
            params={{ id: j.id }}
            className="glass diag-highlight glass-hover panel-in group relative block p-6"
          >
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="glass glass-gold flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Briefcase className="h-5 w-5 text-charcoal-earth" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-charcoal-earth">
                    {j.title}
                  </h2>
                  <div className="font-mono-caps mt-1 text-warm-taupe">
                    {j.department} · {j.location}
                  </div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-warm-taupe transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <div className="relative z-10 mt-5 flex items-center gap-3">
              <span className={j.status === "active" ? "tier-badge-a" : "tier-badge-b"}>
                {j.status}
              </span>
              <span className="font-mono-caps text-warm-taupe">
                job_id: #{j.id.slice(0, 8)}
              </span>
              <span className="ml-auto font-mono text-sm text-charcoal-earth">
                <span className="font-semibold">{j.total_applicants || 0}</span>{" "}
                <span className="text-warm-taupe">applicants</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass diag-highlight relative w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-warm-taupe hover:text-charcoal-earth"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="font-display text-2xl font-semibold text-charcoal-earth">
              Create New Job Requisition
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Job Title *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Systems Engineer"
                  className="input-glass mt-1 w-full text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Department</span>
                <input
                  type="text"
                  placeholder="e.g. Platform Engineering"
                  className="input-glass mt-1 w-full text-sm"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Location</span>
                <input
                  type="text"
                  placeholder="e.g. Remote, US/EU"
                  className="input-glass mt-1 w-full text-sm"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Employment Type</span>
                <select
                  className="input-glass mt-1 w-full text-sm"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                  <option value="freelance">Freelance</option>
                </select>
              </label>
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Min Experience (Years)</span>
                <input
                  type="number"
                  min="0"
                  className="input-glass mt-1 w-full text-sm"
                  value={expMin}
                  onChange={(e) => setExpMin(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="font-mono-caps text-xs text-warm-taupe">Max Experience (Years)</span>
                <input
                  type="number"
                  min="0"
                  className="input-glass mt-1 w-full text-sm"
                  value={expMax}
                  onChange={(e) => setExpMax(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="block">
              <span className="font-mono-caps text-xs text-warm-taupe">Job Description (Markdown or Text) *</span>
              <textarea
                required
                rows={6}
                placeholder="Paste the full job description detailing required skills, nice-to-haves, role responsibilities..."
                className="input-glass mt-1 w-full resize-y font-sans text-sm"
                value={rawJd}
                onChange={(e) => setRawJd(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-glass-ghost"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-glass-primary"
                onClick={() => {
                  if (!title || !rawJd) {
                    alert("Please fill in both Job Title and Job Description.");
                    return;
                  }
                  createJobMutation.mutate({
                    title,
                    department,
                    location,
                    employment_type: employmentType as any,
                    raw_jd: rawJd,
                    experience_years_min: expMin,
                    experience_years_max: expMax,
                  });
                }}
                disabled={createJobMutation.isPending}
              >
                {createJobMutation.isPending ? "Creating..." : "Create Requisition"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
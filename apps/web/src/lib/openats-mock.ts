export type Tier = "A" | "B" | "C";

export interface Candidate {
  slug: string;
  name: string;
  email: string;
  score: number;
  tier: Tier;
  status: string;
  appliedAt: string;
  headline: string;
  location: string;
  matched: { skill: string; strength: number }[];
  missing: string[];
  strengths: string[];
  summary: string;
  resumeText: string;
}

export const CANDIDATES: Candidate[] = [
  {
    slug: "james-okafor",
    name: "James Okafor",
    email: "james.okafor@mail.com",
    score: 90,
    tier: "A",
    status: "Reviewable",
    appliedAt: "2026-07-14",
    headline: "Staff Backend Engineer · 8 yrs",
    location: "Lagos, NG · Remote",
    matched: [
      { skill: "Go", strength: 96 },
      { skill: "Postgres", strength: 92 },
      { skill: "gRPC", strength: 88 },
      { skill: "Kubernetes", strength: 82 },
      { skill: "Kafka", strength: 74 },
    ],
    missing: ["Rust", "OpenTelemetry"],
    strengths: [
      "Led migration of monolith to 12-service mesh at 40M req/day",
      "Deep Postgres tuning experience (partitioning, logical replication)",
      "Owned on-call rotation and incident review process",
    ],
    summary:
      "Systems-oriented backend engineer with strong distributed-messaging background. Aligns tightly with the platform + reliability shape of this role.",
    resumeText:
      "James Okafor\nStaff Backend Engineer, 8 years\n\nExperience\n— Payflex, 2022–now. Led platform team of 6; migrated monolith to service mesh serving 40M req/day. Cut p99 latency 62%.\n— Norvex, 2019–2022. Built ingest pipeline in Go processing 4B events/day on Kafka + Postgres.\n— Kola Systems, 2016–2019. Backend engineer on payments gateway; PCI DSS scope owner.\n\nEducation\n— B.Sc. Computer Science, University of Lagos, 2016.\n\nSkills\nGo, Postgres, gRPC, Kubernetes, Kafka, Redis, Terraform, GCP.",
  },
  {
    slug: "amara-okafor",
    name: "Amara Okafor",
    email: "amara.o@mail.com",
    score: 92,
    tier: "A",
    status: "Reviewable",
    appliedAt: "2026-07-13",
    headline: "Senior Backend Engineer · 7 yrs",
    location: "Berlin, DE",
    matched: [
      { skill: "Go", strength: 94 },
      { skill: "Postgres", strength: 90 },
      { skill: "Kafka", strength: 86 },
    ],
    missing: ["Kubernetes"],
    strengths: ["Distributed systems expertise", "Kafka streaming at scale"],
    summary: "Strong systems background with distributed messaging experience.",
    resumeText: "Amara Okafor — Senior Backend Engineer",
  },
  {
    slug: "elena-vasquez",
    name: "Elena Vasquez",
    email: "elena.v@mail.com",
    score: 88,
    tier: "A",
    status: "Reviewable",
    appliedAt: "2026-07-12",
    headline: "Platform Engineer · 6 yrs",
    location: "Barcelona, ES",
    matched: [{ skill: "Python", strength: 92 }, { skill: "FastAPI", strength: 88 }],
    missing: ["Go"],
    strengths: ["Deep API design experience"],
    summary: "Deep API design experience; consider for platform + ML infra split roles.",
    resumeText: "Elena Vasquez — Platform Engineer",
  },
  {
    slug: "rohan-malik",
    name: "Rohan Malik",
    email: "rohan.malik@mail.com",
    score: 78,
    tier: "B",
    status: "Reviewable",
    appliedAt: "2026-07-11",
    headline: "Backend Engineer · 5 yrs",
    location: "Bengaluru, IN",
    matched: [{ skill: "Node.js", strength: 85 }, { skill: "Postgres", strength: 78 }],
    missing: ["Kafka", "gRPC"],
    strengths: ["Solid backend fundamentals"],
    summary: "Solid backend fundamentals; gaps in streaming infra but promising trajectory.",
    resumeText: "Rohan Malik — Backend Engineer",
  },
  {
    slug: "marcus-chen",
    name: "Marcus Chen",
    email: "marcus.c@mail.com",
    score: 71,
    tier: "B",
    status: "Reviewable",
    appliedAt: "2026-07-10",
    headline: "Java Engineer · 9 yrs",
    location: "Singapore",
    matched: [{ skill: "Java", strength: 90 }, { skill: "Kafka", strength: 72 }],
    missing: ["Go", "Kubernetes"],
    strengths: ["Enterprise Java depth"],
    summary: "Enterprise Java depth; would need onboarding on the cloud-native stack.",
    resumeText: "Marcus Chen — Java Engineer",
  },
  {
    slug: "priya-raman",
    name: "Priya Raman",
    email: "priya.r@mail.com",
    score: 58,
    tier: "C",
    status: "Reviewable",
    appliedAt: "2026-07-09",
    headline: "Junior Developer · 2 yrs",
    location: "Chennai, IN",
    matched: [{ skill: "Python", strength: 70 }],
    missing: ["Go", "Postgres at scale", "Kubernetes"],
    strengths: ["Fast learner"],
    summary: "Early-career profile; better fit for mid-level or associate opening.",
    resumeText: "Priya Raman — Junior Developer",
  },
];

export const JOB = {
  slug: "senior-backend-engineer",
  title: "Senior Backend Engineer",
  department: "Engineering",
  location: "Remote",
  createdAt: "2026-07-04",
  status: "Active",
  jobId: "#4471",
  totals: { total: 24, queued: 3, processing: 5, done: 15, failed: 1 },
};

export function candidateBySlug(slug: string) {
  return CANDIDATES.find((c) => c.slug === slug);
}

export interface JobRole {
  slug: string;
  title: string;
  department: string;
  jobId: string;
  applicants: number;
  tierA: number;
  tierB: number;
  tierC: number;
  lastActivityDaysAgo: number;
}

export const JOBS: JobRole[] = [
  {
    slug: "senior-backend-engineer",
    title: "Senior Backend Engineer",
    department: "Engineering",
    jobId: "#4471",
    applicants: 24,
    tierA: 3,
    tierB: 2,
    tierC: 1,
    lastActivityDaysAgo: 0,
  },
  {
    slug: "product-designer",
    title: "Senior Product Designer",
    department: "Design",
    jobId: "#4468",
    applicants: 17,
    tierA: 2,
    tierB: 5,
    tierC: 3,
    lastActivityDaysAgo: 1,
  },
  {
    slug: "ml-platform-engineer",
    title: "ML Platform Engineer",
    department: "Engineering",
    jobId: "#4462",
    applicants: 41,
    tierA: 4,
    tierB: 6,
    tierC: 8,
    lastActivityDaysAgo: 5,
  },
  {
    slug: "gtm-lead",
    title: "GTM Lead, EMEA",
    department: "Revenue",
    jobId: "#4455",
    applicants: 12,
    tierA: 1,
    tierB: 2,
    tierC: 4,
    lastActivityDaysAgo: 7,
  },
];

export const PIPELINE_COUNTS = {
  newResumes: 12,
  awaitingReview: 8,
  processing: 5,
  failed: 1,
};

export const RECENT_ACTIVITY = [
  { slug: "amara-okafor", name: "Amara Okafor", score: 92, tier: "A" as Tier, minutesAgo: 6 },
  { slug: "james-okafor", name: "James Okafor", score: 90, tier: "A" as Tier, minutesAgo: 22 },
  { slug: "elena-vasquez", name: "Elena Vasquez", score: 88, tier: "A" as Tier, minutesAgo: 48 },
  { slug: "rohan-malik", name: "Rohan Malik", score: 78, tier: "B" as Tier, minutesAgo: 95 },
  { slug: "marcus-chen", name: "Marcus Chen", score: 71, tier: "B" as Tier, minutesAgo: 140 },
  { slug: "priya-raman", name: "Priya Raman", score: 58, tier: "C" as Tier, minutesAgo: 220 },
];

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export const FUNNEL: Record<string, FunnelStage[]> = {
  all: [
    { key: "applied", label: "Applied", count: 94 },
    { key: "shortlisted", label: "Shortlisted", count: 38 },
    { key: "interview", label: "Interview", count: 14 },
    { key: "offer", label: "Offer", count: 5 },
    { key: "hired", label: "Hired", count: 2 },
  ],
  "senior-backend-engineer": [
    { key: "applied", label: "Applied", count: 24 },
    { key: "shortlisted", label: "Shortlisted", count: 11 },
    { key: "interview", label: "Interview", count: 4 },
    { key: "offer", label: "Offer", count: 2 },
    { key: "hired", label: "Hired", count: 1 },
  ],
  "product-designer": [
    { key: "applied", label: "Applied", count: 17 },
    { key: "shortlisted", label: "Shortlisted", count: 8 },
    { key: "interview", label: "Interview", count: 3 },
    { key: "offer", label: "Offer", count: 1 },
    { key: "hired", label: "Hired", count: 0 },
  ],
  "ml-platform-engineer": [
    { key: "applied", label: "Applied", count: 41 },
    { key: "shortlisted", label: "Shortlisted", count: 15 },
    { key: "interview", label: "Interview", count: 6 },
    { key: "offer", label: "Offer", count: 2 },
    { key: "hired", label: "Hired", count: 1 },
  ],
  "gtm-lead": [
    { key: "applied", label: "Applied", count: 12 },
    { key: "shortlisted", label: "Shortlisted", count: 4 },
    { key: "interview", label: "Interview", count: 1 },
    { key: "offer", label: "Offer", count: 0 },
    { key: "hired", label: "Hired", count: 0 },
  ],
};
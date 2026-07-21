import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_PUBLIC_API_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Access tokens expire in 15m and there's no login page to catch the
// fallout — without this, an expired token just makes every request 401
// silently and the app renders with empty data instead of recovering.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const accessToken: string = res.data.accessToken;
    setTokens(accessToken, refreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      // Refresh token is also dead — the session is unrecoverable. Clear it
      // and reload so __root.tsx's ensureAuthenticated() auto-logs-in again.
      clearTokens();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  status: "draft" | "active" | "paused" | "closed" | "archived";
  raw_jd: string;
  normalized_jd?: string;
  required_skills?: string[];
  nice_to_have_skills?: string[];
  experience_years_min?: number;
  experience_years_max?: number;
  created_at: string;
  updated_at: string;
  // stats/aggregates returned by GET /jobs
  total_applicants?: number | string;
  by_status?: Record<string, number>;
  by_tier?: Record<string, number>;
  tier_a_count?: number | string;
  tier_b_count?: number | string;
  tier_c_count?: number | string;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  github_url?: string;
  location?: string;
  created_at: string;
  updated_at: string;
  // present on GET /candidates (joined from the candidate's latest application)
  application_id?: string;
  job_title?: string;
  job_department?: string;
  tier?: "A" | "B" | "C";
  score?: number;
}

export interface Application {
  id: string;
  candidate_id: string;
  resume_id: string;
  job_id: string;
  status:
    | "uploaded"
    | "queued"
    | "extracting"
    | "extracted"
    | "scoring"
    | "reviewable"
    | "screening"
    | "interviewing"
    | "hired"
    | "rejected"
    | "archived";
  applied_at: string;
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
  candidate?: Candidate;
  job_title?: string;
  job_department?: string;
  score?: number;
  tier?: "A" | "B" | "C" | "unscored";
  reasons?: {
    strengths: string[];
    weaknesses: string[];
    cultural_fit_notes?: string;
  };
  matched_skills?: Array<{
    skill: string;
    confidence: number;
    evidence: string;
  }>;
  missing_requirements?: string[];
  recommendation?: string;
  extracted_markdown?: string;
}

export interface ApplicationDetail extends Application {
  candidate: Candidate;
  resume: {
    id: string;
    original_filename: string;
    extracted_markdown: string;
    file_size_bytes: number;
  };
  latest_evaluation?: {
    id: string;
    model_name: string;
    tier: "A" | "B" | "C" | "unscored";
    score: number;
    matched_skills: Array<{
      skill: string;
      confidence: number;
      evidence: string;
    }>;
    missing_requirements: string[];
    reasons: {
      strengths: string[];
      weaknesses: string[];
      cultural_fit_notes?: string;
    };
    recommendation: string;
    scored_at: string;
  };
  processing_job?: {
    status: string;
    progress: number;
    error_message?: string;
  };
}

export interface DashboardSummary {
  active_jobs: number;
  total_applicants: number;
  queue_backlog: number;
  failed_count: number;
  awaiting_review: number;
  new_resumes: number;
  tier_distribution: Array<{
    tier: "A" | "B" | "C";
    count: number;
  }>;
  status_distribution: Record<string, number>;
  recent_jobs: Array<{
    id: string;
    title: string;
    department: string;
    status: string;
    created_at: string;
  }>;
}

export interface CompareDimension {
  name: string;
  a_assessment: string;
  b_assessment: string;
  edge: "a" | "b" | "tie";
}

export interface CompareResponse {
  candidates: {
    a: {
      applicationId: string;
      fullName: string;
      tier: string | null;
      score: number | null;
      profile: any;
    };
    b: {
      applicationId: string;
      fullName: string;
      tier: string | null;
      score: number | null;
      profile: any;
    };
  };
  comparison: {
    dimensions: CompareDimension[];
    winner: "a" | "b" | "tie";
    summary: string;
  };
  cached: boolean;
}

// ─── API Endpoints ───────────────────────────────────────────────────────────

export const jobsApi = {
  list: async () => {
    const res = await apiClient.get<{ data: Job[] }>("/jobs");
    return res.data.data;
  },
  create: async (data: Partial<Job>) => {
    const res = await apiClient.post<Job>("/jobs", data);
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<Job>(`/jobs/${id}`);
    return res.data;
  },
  update: async (id: string, data: Partial<Job>) => {
    const res = await apiClient.put<Job>(`/jobs/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/jobs/${id}`);
    return res.data;
  },
  stats: async (id: string) => {
    const res = await apiClient.get<any>(`/jobs/${id}/stats`);
    return res.data;
  },
  applications: async (id: string) => {
    const res = await apiClient.get<{ data: any[] }>(`/jobs/${id}/applications`);
    return res.data.data.map((row) => ({
      id: row.id,
      job_id: row.job_id || id,
      candidate_id: row.candidate_id,
      resume_id: row.resume_id,
      status: row.status,
      applied_at: row.applied_at,
      updated_at: row.updated_at,
      created_at: row.applied_at,
      tier: row.tier,
      score: row.score !== null && row.score !== undefined ? Number(row.score) : undefined,
      candidate: {
        id: row.candidate_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone || undefined,
        location: row.location || undefined,
        created_at: row.applied_at,
        updated_at: row.updated_at,
      },
      ai_analysis: {
        matched_skills: row.matched_skills || [],
        missing_requirements: row.missing_requirements || [],
        recommendation: row.recommendation || "",
        extracted_text: row.extracted_markdown || "",
      },
      profile: row.profile_json ?? undefined,
    })) as Application[];
  },
  uploadResumes: async (jobId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("resumes", file);
    });
    const res = await apiClient.post<{ results: any[] }>(`/jobs/${jobId}/resumes`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data.results;
  },
};

export const candidatesApi = {
  list: async () => {
    const res = await apiClient.get<Candidate[]>("/candidates");
    return res.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<Candidate>(`/candidates/${id}`);
    return res.data;
  },
};

export const applicationsApi = {
  get: async (id: string): Promise<ApplicationDetail> => {
    const res = await apiClient.get<{ application: any; history: any[] }>(`/applications/${id}`);
    const row = res.data.application;
    const detail: ApplicationDetail = {
      id: row.id,
      candidate_id: row.candidate_id,
      resume_id: row.resume_id,
      job_id: row.job_id,
      status: row.status,
      applied_at: row.applied_at,
      updated_at: row.updated_at,
      created_at: row.applied_at,
      candidate: {
        id: row.candidate_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone || undefined,
        linkedin_url: row.linkedin_url || undefined,
        github_url: row.github_url || undefined,
        location: row.location || undefined,
        created_at: row.applied_at,
        updated_at: row.updated_at,
      },
      resume: {
        id: row.resume_id,
        original_filename: row.file_name,
        extracted_markdown: row.extracted_markdown || "",
        file_size_bytes: row.file_size_bytes || 0,
      },
      latest_evaluation: row.eval_id
        ? {
            id: row.eval_id,
            model_name: row.model_name || "",
            tier: row.tier || "unscored",
            score: row.score !== null && row.score !== undefined ? Number(row.score) : 0,
            matched_skills: row.matched_skills || [],
            missing_requirements: row.missing_requirements || [],
            reasons: {
              strengths: row.strengths || [],
              weaknesses: row.weaknesses || [],
              cultural_fit_notes: row.reasons?.cultural_fit_notes || undefined,
            },
            recommendation: row.recommendation || "",
            scored_at: row.evaluated_at || "",
          }
        : undefined,
      processing_job: {
        status: row.processing_status || "queued",
        progress: row.progress || 0,
        error_message: row.error_message || undefined,
      },
    };
    return detail;
  },
  updateStatus: async (id: string, status: string, note?: string) => {
    const res = await apiClient.patch<Application>(`/applications/${id}/status`, {
      status,
      note,
    });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/applications/${id}`);
    return res.data;
  },
  reprocess: async (id: string, stage?: "extraction" | "scoring") => {
    const res = await apiClient.post(`/applications/${id}/reprocess`, { stage });
    return res.data;
  },
  getHistory: async (id: string) => {
    const res = await apiClient.get<any[]>(`/applications/${id}/history`);
    return res.data;
  },
  validateLinks: async (id: string, force = false) => {
    const res = await apiClient.post<{ links: any[] }>(
      `/applications/${id}/validate-links${force ? "?force=true" : ""}`
    );
    return res.data.links;
  },
};

export interface AnalysisMetrics {
  skill_gaps: Array<{ skill: string; count: number }>;
  score_distribution: Array<{ bucket: string; count: number }>;
}

export const dashboardApi = {
  summary: async () => {
    const res = await apiClient.get<DashboardSummary>("/dashboard/summary");
    return res.data;
  },
  queueStatus: async () => {
    const res = await apiClient.get<any>("/dashboard/queue-status");
    return res.data;
  },
  analysis: async () => {
    const res = await apiClient.get<AnalysisMetrics>("/dashboard/analysis");
    return res.data;
  },
};

export const settingsApi = {
  getModels: async () => {
    const res = await apiClient.get<{
      selected: Record<string, string>;
      available: string[];
      nvidiaAvailable?: string[];
    }>("/settings/models");
    return res.data;
  },
  updateModels: async (data: Record<string, string>) => {
    const res = await apiClient.put<{ selected: Record<string, string> }>("/settings/models", data);
    return res.data;
  },
};

export const compareApi = {
  compare: async (applicationIds: string[]) => {
    const res = await apiClient.post<CompareResponse>("/compare", {
      applicationIds,
    });
    return res.data;
  },
  ask: async (applicationIds: string[], question: string, history?: any[]) => {
    const res = await apiClient.post<{ answer: string }>("/compare/ask", {
      applicationIds,
      question,
      history,
    });
    return res.data;
  },
};

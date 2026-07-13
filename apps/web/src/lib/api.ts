import axios, { AxiosInstance } from 'axios';
import { getAccessToken, clearTokens } from './auth';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const BASE_URL = API_BASE_URL;

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/login', data),

  logout: () => apiClient.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    apiClient.post<{ accessToken: string }>('/auth/refresh', {
      refreshToken: refreshToken,
    }),

  me: () =>
    apiClient.get<{
      id: string;
      fullName: string;
      email: string;
      role: string;
    }>('/auth/me'),


};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  status: 'draft' | 'active' | 'closed';
  raw_jd: string;
  experience_years_min: number;
  experience_years_max: number;
  created_at: string;
  updated_at: string;
  total_applicants?: number;
  tier_a_count?: number;
  tier_b_count?: number;
  tier_c_count?: number;
  processing_count?: number;
};

export type JobStats = {
  total: number;
  queued: number;
  processing: number;
  done: number;
  failed: number;
};

export const jobsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<{ data: Job[]; pagination: { total: number } }>('/jobs', { params })
      .then(res => ({ ...res, data: { jobs: res.data.data, total: res.data.pagination.total } })),

  get: (id: string) => apiClient.get<Job>(`/jobs/${id}`),

  create: (data: Omit<Job, 'id' | 'created_at' | 'updated_at'>) =>
    apiClient.post<Job>('/jobs', data),

  update: (id: string, data: Partial<Job>) => apiClient.put<Job>(`/jobs/${id}`, data),

  delete: (id: string) => apiClient.delete(`/jobs/${id}`),

  getStats: (id: string) => apiClient.get<JobStats>(`/jobs/${id}/stats`),

  getApplications: (id: string, params?: { tier?: string; status?: string }) =>
    apiClient.get<{ data: any[]; pagination: any }>(`/jobs/${id}/applications`, { params })
      .then(res => {
        const applications = res.data.data.map(row => ({
          id: row.id,
          job_id: row.job_id || id,
          candidate_id: row.candidate_id,
          status: row.status,
          tier: row.tier,
          score: row.score,
          processing_status: row.processing_status,
          created_at: row.applied_at,
          updated_at: row.updated_at,
          candidate: {
            id: row.candidate_id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            location: row.location,
            resume_url: row.file_name,
            created_at: row.applied_at,
          },
          ai_analysis: {
            matched_skills: row.matched_skills || [],
            missing_requirements: row.missing_requirements || [],
            strengths: row.strengths || [],
            weaknesses: row.weaknesses || [],
            recommendation: row.recommendation || '',
            extracted_text: row.extracted_markdown || '',
          }
        }));
        return { ...res, data: { applications } };
      }),
};

// ─── Applications ─────────────────────────────────────────────────────────────
export type Application = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: 'uploaded' | 'queued' | 'extracting' | 'extracted' | 'scoring' | 'reviewable' | 'screening' | 'interviewing' | 'hired' | 'rejected' | 'archived';
  tier: 'A' | 'B' | 'C' | null;
  score: number | null;
  processing_status: 'queued' | 'extracting' | 'extracted' | 'scoring' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
  candidate?: Candidate;
  ai_analysis?: AIAnalysis;
};

export type AIAnalysis = {
  matched_skills: { skill: string; confidence: number }[];
  missing_requirements: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  extracted_text: string;
};

export type StatusHistoryEntry = {
  id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  changed_at: string;
  note?: string;
};

export const applicationsApi = {
  get: (id: string) => 
    apiClient.get<{ application: any; history: StatusHistoryEntry[] }>(`/applications/${id}`)
      .then(res => {
        const row = res.data.application;
        const application: Application = {
          id: row.id,
          job_id: row.job_id,
          candidate_id: row.candidate_id,
          status: row.status,
          tier: row.tier,
          score: row.score,
          processing_status: row.processing_status,
          error_message: row.error_message,
          created_at: row.applied_at,
          updated_at: row.updated_at,
          candidate: {
            id: row.candidate_id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            location: row.location,
            linkedin_url: row.linkedin_url,
            github_url: row.github_url,
            resume_url: row.storage_path,
            created_at: row.applied_at,
          },
          ai_analysis: {
            matched_skills: row.matched_skills || [],
            missing_requirements: row.missing_requirements || [],
            strengths: row.strengths || [],
            weaknesses: row.weaknesses || [],
            recommendation: row.recommendation,
            extracted_text: row.extracted_markdown,
          },
        };
        return { ...res, data: application };
      }),

  updateStatus: (id: string, data: { status: string; note?: string }) =>
    apiClient.patch<Application>(`/applications/${id}/status`, data),

  reprocess: (id: string) => apiClient.post<Application>(`/applications/${id}/reprocess`),

  getHistory: (id: string) =>
    apiClient.get<{ history: StatusHistoryEntry[] }>(`/applications/${id}/history`),
};

// ─── Candidates ────────────────────────────────────────────────────────────────
export type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  resume_url?: string;
  created_at: string;
};

export const candidatesApi = {
  get: (id: string) => apiClient.get<Candidate>(`/candidates/${id}`),
};

// ─── Compare ───────────────────────────────────────────────────────────────────
export type CompareDimension = {
  name: string;
  a_assessment: string;
  b_assessment: string;
  edge: 'a' | 'b' | 'tie';
};

export type CompareCandidate = {
  applicationId: string;
  fullName: string;
  tier: 'A' | 'B' | 'C' | null;
  score: number | null;
};

export type CompareResult = {
  candidates: { a: CompareCandidate; b: CompareCandidate };
  comparison: {
    dimensions: CompareDimension[];
    winner: 'a' | 'b' | 'tie';
    summary: string;
  };
};

export type CompareChatMessage = { role: 'user' | 'assistant'; content: string };

export const compareApi = {
  compare: (applicationIds: [string, string]) =>
    apiClient.post<CompareResult>('/compare', { applicationIds }),

  ask: (applicationIds: [string, string], question: string, history: CompareChatMessage[]) =>
    apiClient.post<{ answer: string }>('/compare/ask', { applicationIds, question, history }),
};

// ─── Role History ──────────────────────────────────────────────────────────────
export type RoleHistoryEntry = {
  id: string;
  candidate_name: string;
  role: string;
  department: string;
  tier: 'A' | 'B' | 'C';
  score: number;
  milestone: 'screening' | 'interviewing' | 'hired';
  skill_pattern?: string;
  accepted_at: string;
};

export const roleHistoryApi = {
  list: (params?: { department?: string; milestone?: string; page?: number }) =>
    apiClient.get<{ data: RoleHistoryEntry[]; pagination: { total: number } }>('/role-history', { params })
      .then(res => ({ ...res, data: { entries: res.data.data, total: res.data.pagination.total } })),

  findSimilar: (jobId: string) =>
    apiClient.get<{ results: (RoleHistoryEntry & { similarity_score: number })[] }>(
      '/role-history/similar',
      { params: { job_id: jobId } }
    ),
};

// ─── Settings ──────────────────────────────────────────────────────────────────
export type ModelSettings = {
  scoring_model: string;
  compare_model: string;
  chat_model: string;
};

export const settingsApi = {
  getModels: () =>
    apiClient.get<{ selected: ModelSettings; available: string[] }>('/settings/models'),

  updateModels: (updates: Partial<ModelSettings>) =>
    apiClient.put<{ selected: ModelSettings }>('/settings/models', updates),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export type DashboardSummary = {
  active_jobs: number;
  total_applicants: number;
  queue_backlog: number;
  failed_count: number;
  tier_distribution: { tier: string; count: number }[];
  recent_jobs: Job[];
};

export type QueueStatus = {
  processing: number;
  failed: number;
  queued: number;
};

export const dashboardApi = {
  getSummary: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
  getQueueStatus: () => apiClient.get<QueueStatus>('/dashboard/queue-status'),
};

export default apiClient;

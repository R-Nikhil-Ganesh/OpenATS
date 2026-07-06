// ─── Enum & Union Types ──────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'scoring'
  | 'reviewable'
  | 'screening'
  | 'interviewing'
  | 'hired'
  | 'rejected'
  | 'archived'
  | 'failed';

export type AiTier = 'A' | 'B' | 'C' | 'unscored';

export type UserRole = 'owner' | 'hiring_manager' | 'recruiter' | 'viewer';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'freelance';

export type JobStatus = 'draft' | 'open' | 'paused' | 'closed' | 'archived';

export type ProcessingJobStatus =
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'scoring'
  | 'completed'
  | 'failed';

// ─── Database Row Interfaces ─────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  last_login_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface JobRequisition {
  id: string;
  tenant_id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  raw_jd: string;
  status: JobStatus;
  experience_years_min: number | null;
  experience_years_max: number | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Candidate {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Resume {
  id: string;
  tenant_id: string;
  candidate_id: string;
  storage_path: string;
  content_hash: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string;
  extracted_markdown: string | null;
  extraction_status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface Application {
  id: string;
  tenant_id: string;
  job_id: string;
  candidate_id: string;
  resume_id: string;
  status: ApplicationStatus;
  applied_at: Date;
  updated_at: Date;
}

export interface AiEvaluation {
  id: string;
  tenant_id: string;
  application_id: string;
  model_name: string;
  model_version: string | null;
  score: number | null;
  tier: AiTier;
  summary: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommendation: string | null;
  raw_response: Record<string, unknown> | null;
  evaluated_at: Date;
  created_at: Date;
}

export interface StateHistory {
  id: string;
  tenant_id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string | null;
  note: string | null;
  created_at: Date;
}

export interface ProcessingJob {
  id: string;
  tenant_id: string;
  application_id: string;
  bullmq_job_id: string | null;
  status: ProcessingJobStatus;
  stage: string | null;
  error_message: string | null;
  attempts: number;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoleHistorySnapshot {
  id: string;
  tenant_id: string;
  job_id: string;
  application_id: string;
  candidate_id: string;
  milestone: string;
  job_title: string;
  department: string | null;
  candidate_name: string;
  tier: AiTier;
  score: number | null;
  snapshot_data: Record<string, unknown>;
  created_at: Date;
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── Express Request Augmentation ────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}

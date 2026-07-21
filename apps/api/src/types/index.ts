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
  | 'failed'
  | 'duplicate_candidate';

export type AiTier = 'A' | 'B' | 'C' | 'unscored';

export type UserRole = 'owner' | 'hiring_manager' | 'recruiter' | 'viewer';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'freelance';

export type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';

export type ProcessingJobStatus =
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'scoring'
  | 'completed'
  | 'failed'
  | 'needs_review';

// ─── Database Row Interfaces ─────────────────────────────────────────────────

export interface User {
  id: string;
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
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface JobRequisition {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType | null;
  status: JobStatus;
  raw_jd: string;
  normalized_jd: string | null;
  required_skills: Record<string, unknown>[];
  nice_to_have_skills: Record<string, unknown>[];
  experience_years_min: number | null;
  experience_years_max: number | null;
  created_by: string;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  location: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Resume {
  id: string;
  candidate_id: string;
  original_filename: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  content_hash: string | null;
  extracted_markdown: string | null;
  extraction_metadata: Record<string, unknown>;
  extracted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Application {
  id: string;
  candidate_id: string;
  resume_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: Date;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AiEvaluation {
  id: string;
  application_id: string;
  model_name: string;
  model_version: string | null;
  tier: AiTier;
  score: number | null;
  matched_skills: Record<string, unknown>[];
  missing_requirements: Record<string, unknown>[];
  reasons: Record<string, unknown>;
  recommendation: string | null;
  raw_response: string | null;
  scored_at: Date | null;
  created_at: Date;
}

export interface StateHistory {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string | null;
  note: string | null;
  changed_at: Date | null;
}

export interface CandidateConflictData {
  extracted_email: string | null;
  extracted_name: string | null;
  conflicting_candidate_id: string | null;
  conflicting_candidate_name: string | null;
  conflicting_application_id: string | null;
  conflict_type: 'same_job_duplicate' | 'cross_job_merge';
  detected_at_step: string;
}

export interface ProcessingJob {
  id: string;
  application_id: string;
  bullmq_job_id: string | null;
  status: ProcessingJobStatus;
  progress: number;
  error_message: string | null;
  error_stack: string | null;
  conflict_data: CandidateConflictData | null;
  attempts: number;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoleHistorySnapshot {
  id: string;
  job_id: string;
  application_id: string;
  evaluation_id: string | null;
  milestone: string;
  snapshot_data: Record<string, unknown>;
  captured_at: Date | null;
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
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
    }
  }
}

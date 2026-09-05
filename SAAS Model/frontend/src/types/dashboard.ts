export type CandidateStatus =
  | "SHORTLISTED"
  | "INVITED"
  | "INTERVIEW_STARTED"
  | "INTERVIEW_COMPLETED"
  | "FINAL_SELECTED"
  | "REJECTED";

export interface DashboardSummary {
  total_received: number;
  shortlisted: number;
  emails_queued: number;
  emails_sent: number;
  interview_started: number;
  interview_completed: number;
  final_selected: number;
  rejected: number;
  pending: number;
}

export interface StatusBreakdownItem {
  status: CandidateStatus;
  count: number;
}

export interface CandidateRow {
  id: string;
  candidate_external_id: string;
  name: string;
  email: string;
  resume_score: number | null;
  candidate_status: CandidateStatus;
  email_status: string;
  interview_expires_at: string | null;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  label: string;
  candidate_name: string | null;
  candidate_email: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

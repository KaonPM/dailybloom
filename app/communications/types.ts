export type CommunicationRow = {
  id: string;
  learner_id?: string | null;
  learner_name?: string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  recipient_count?: number | null;
  channel?: string | null;
  communication_type?: string | null;
  subject?: string | null;
  body_preview?: string | null;
  status?: string | null;
  attempt_count?: number | null;
  next_retry_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  sent_by_name?: string | null;
};

export type CommunicationSummaryData = { sentToday: number; delivered: number; read: number; failed: number; awaiting: number };
export type PaginationData = { page: number; pageSize: number; total: number; totalPages: number };
export type ClassroomOption = { id: number; classroom_name: string };

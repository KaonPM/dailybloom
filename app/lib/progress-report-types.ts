export type ProgressReportType = "developmental" | "grade-rr";
export type ProgressReportId = string | number | null | undefined;

export type ProgressReportIndicator = {
  key: string;
  label: string;
  name?: string;
  text?: string;
};

export type ProgressReportCategory = {
  key: string;
  label: string;
  name?: string;
  description?: string;
  indicators?: ProgressReportIndicator[];
  sections?: { indicators?: ProgressReportIndicator[] }[];
};

export type ProgressReportRatingLevel =
  | string
  | {
      code?: string;
      value?: string | number;
      level?: string;
      label?: string;
    };

export type ProgressReportAssessment = {
  id?: number | null;
  school_id?: number | null;
  classroom_id?: number | null;
  teacher_id?: string | null;
  learner_id?: ProgressReportId;
  report_period_id?: number | null;
  report_type?: ProgressReportType | null;
  status?: string | null;
  category?: string | null;
  indicator_key?: string | null;
  indicator_label?: string | null;
  indicator?: string | null;
  label?: string | null;
  level?: string | null;
  rating?: string | null;
  assessment_level?: string | null;
  selected_level?: string | null;
  selected_rating?: string | null;
  value?: string | null;
  teacher_comment?: string | null;
  principal_comment?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

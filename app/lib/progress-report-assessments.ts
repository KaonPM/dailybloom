import type {
  ProgressReportAssessment,
  ProgressReportCategory,
  ProgressReportIndicator,
} from "./progress-report-types";

export function getAssessmentValue(
  assessment?: ProgressReportAssessment | null
) {
  return (
    assessment?.level ||
    assessment?.rating ||
    assessment?.assessment_level ||
    assessment?.selected_level ||
    assessment?.selected_rating ||
    assessment?.value ||
    ""
  );
}

export function getCategoryIndicators(
  category?: ProgressReportCategory | null
): ProgressReportIndicator[] {
  return (
    category?.indicators ||
    category?.sections?.flatMap((section) => section.indicators || []) ||
    []
  );
}

export function getAssessmentTimestamp(
  assessment?: Pick<
    ProgressReportAssessment,
    "updated_at" | "created_at"
  > | null
) {
  const value = assessment?.updated_at || assessment?.created_at || "";
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function normalizeLatestAssessments(
  assessments: ProgressReportAssessment[]
) {
  const latestByIndicator = new Map<string, ProgressReportAssessment>();

  assessments.forEach((assessment) => {
    const key = [
      assessment.category || "",
      assessment.indicator_key || assessment.indicator_label || "",
    ].join("::");

    const current = latestByIndicator.get(key);
    const assessmentHasValue = Boolean(getAssessmentValue(assessment));
    const currentHasValue = Boolean(getAssessmentValue(current));

    if (
      !current ||
      (assessmentHasValue && !currentHasValue) ||
      (assessmentHasValue === currentHasValue &&
        getAssessmentTimestamp(assessment) >= getAssessmentTimestamp(current))
    ) {
      latestByIndicator.set(key, assessment);
    }
  });

  return Array.from(latestByIndicator.values());
}

export function makeAssessmentKey(
  categoryKey: string,
  indicatorKey: string
) {
  return `${categoryKey}::${indicatorKey}`;
}

export function normalizeProgressReportMatchValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

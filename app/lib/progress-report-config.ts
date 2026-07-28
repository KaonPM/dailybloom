import { gradeRRCategories, gradeRRRatingScale } from "./grade-rr-categories";
import { reportCategories } from "./report-categories";
import type {
  ProgressReportCategory,
  ProgressReportRatingLevel,
  ProgressReportType,
} from "./progress-report-types";

export const developmentalRatingScale = ["NP", "PA", "A", "G", "VG"];

export const teacherAssessmentStatusFilters = [
  "draft",
  "submitted",
  "reviewed",
  "locked",
  "generated",
];

export const principalAssessmentStatusFilters = [
  "submitted",
  "reviewed",
  "locked",
  "generated",
];

export function getProgressReportCategories(
  reportType: ProgressReportType
): ProgressReportCategory[] {
  return reportType === "grade-rr"
    ? (gradeRRCategories as ProgressReportCategory[])
    : (reportCategories as ProgressReportCategory[]);
}

export function getProgressReportRatingScale(
  reportType: ProgressReportType
): ProgressReportRatingLevel[] {
  return reportType === "grade-rr"
    ? (gradeRRRatingScale as ProgressReportRatingLevel[])
    : developmentalRatingScale;
}

export function getProgressReportTitle(
  reportType: ProgressReportType,
  uppercase = false
) {
  const title =
    reportType === "grade-rr"
      ? "Grade RR Progress Report"
      : "Developmental Progress Report";

  return uppercase ? title.toUpperCase() : title;
}

export function splitProgressReportCategories(
  reportType: ProgressReportType,
  categories = getProgressReportCategories(reportType)
) {
  const firstPageCount = reportType === "grade-rr" ? 2 : 3;

  return {
    firstPageCategories: categories.slice(0, firstPageCount),
    secondPageCategories: categories.slice(firstPageCount),
  };
}

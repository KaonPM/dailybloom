import type { ProgressReportType } from "./progress-report-types";

/**
 * Keeps a classroom's activity library and learner-report template in step.
 * Grade R A and Grade R B are one Grade R programme; Grade RR / Pre-Grade R
 * remain on their own report path and use the general activity library.
 */
export function getClassroomReportType(
  classroomName?: string | null
): ProgressReportType {
  const normalized = String(classroomName || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (/^(?:grade\s*rr|grade\s*r\s*r|pre[-\s]*grade\s*r)(?:\b|\s|\()/i.test(normalized)) {
    return "grade-rr";
  }

  if (/^grade\s*r(?:\b|\s|\()/i.test(normalized)) {
    return "grade-r";
  }

  return "developmental";
}

export function normalizeReportType(
  reportType?: string | null
): ProgressReportType {
  if (reportType === "grade-r" || reportType === "grade-rr") {
    return reportType;
  }

  return "developmental";
}

export function isGradeRClassroom(classroomName?: string | null) {
  return getClassroomReportType(classroomName) === "grade-r";
}

export function isGradeRActivityTheme(theme?: string | null) {
  return /^grade\s*r\s*:/i.test(String(theme || "").trim());
}

export function scopeActivityThemeForClassroom(
  theme: string,
  classroomName?: string | null
) {
  const cleanedTheme = theme.replace(/^grade\s*r\s*:\s*/i, "").trim();

  if (isGradeRClassroom(classroomName)) {
    return cleanedTheme ? `Grade R: ${cleanedTheme}` : "Grade R: General";
  }

  return cleanedTheme;
}

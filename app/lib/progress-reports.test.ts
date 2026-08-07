import assert from "node:assert/strict";
import test from "node:test";
import {
  getProgressReportCategories,
  getProgressReportRatingScale,
  getProgressReportTitle,
  principalAssessmentStatusFilters,
  splitProgressReportCategories,
  teacherAssessmentStatusFilters,
} from "./progress-report-config";
import {
  getAssessmentValue,
  getCategoryIndicators,
  makeAssessmentKey,
  normalizeLatestAssessments,
  normalizeProgressReportMatchValue,
} from "./progress-report-assessments";
import {
  getClassroomReportType,
  isGradeRActivityTheme,
} from "./classroom-programme";

test("keeps Developmental and Grade RR report definitions separate", () => {
  const developmental = getProgressReportCategories("developmental");
  const gradeRR = getProgressReportCategories("grade-rr");

  assert.ok(developmental.length > 0);
  assert.ok(gradeRR.length > 0);
  assert.notDeepEqual(
    developmental.map((category) => category.key),
    gradeRR.map((category) => category.key)
  );
  assert.equal(
    getProgressReportTitle("developmental"),
    "Developmental Progress Report"
  );
  assert.equal(
    getProgressReportTitle("grade-rr", true),
    "GRADE RR PROGRESS REPORT"
  );
});

test("uses the correct rating scale and print split for each report", () => {
  assert.deepEqual(getProgressReportRatingScale("developmental"), [
    "NP",
    "PA",
    "A",
    "G",
    "VG",
  ]);
  assert.notDeepEqual(
    getProgressReportRatingScale("developmental"),
    getProgressReportRatingScale("grade-rr")
  );

  const developmental = getProgressReportCategories("developmental");
  const gradeRR = getProgressReportCategories("grade-rr");
  const developmentalPages = splitProgressReportCategories(
    "developmental",
    developmental
  );
  const gradeRRPages = splitProgressReportCategories("grade-rr", gradeRR);

  assert.equal(developmentalPages.firstPageCategories.length, 3);
  assert.deepEqual(
    [
      ...developmentalPages.firstPageCategories,
      ...developmentalPages.secondPageCategories,
    ],
    developmental
  );
  assert.equal(gradeRRPages.firstPageCategories.length, 2);
  assert.deepEqual(
    [
      ...gradeRRPages.firstPageCategories,
      ...gradeRRPages.secondPageCategories,
    ],
    gradeRR
  );
});

test("keeps principal review filters stricter than practitioner filters", () => {
  assert.ok(teacherAssessmentStatusFilters.includes("draft"));
  assert.ok(!principalAssessmentStatusFilters.includes("draft"));
  assert.deepEqual(
    principalAssessmentStatusFilters,
    teacherAssessmentStatusFilters.filter((status) => status !== "draft")
  );
});

test("reads legacy assessment value columns without losing ratings", () => {
  assert.equal(getAssessmentValue({ level: "A", rating: "VG" }), "A");
  assert.equal(getAssessmentValue({ selected_rating: "3" }), "3");
  assert.equal(getAssessmentValue({ value: "PA" }), "PA");
  assert.equal(getAssessmentValue(null), "");
});

test("normalizes duplicate ratings to the latest meaningful assessment", () => {
  const result = normalizeLatestAssessments([
    {
      id: 1,
      category: "language",
      indicator_key: "listening",
      level: "A",
      updated_at: "2026-01-01T08:00:00Z",
    },
    {
      id: 2,
      category: "language",
      indicator_key: "listening",
      level: "",
      updated_at: "2026-01-02T08:00:00Z",
    },
    {
      id: 3,
      category: "language",
      indicator_key: "listening",
      level: "VG",
      updated_at: "2026-01-03T08:00:00Z",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 3);
  assert.equal(getAssessmentValue(result[0]), "VG");
});

test("supports category sections and stable assessment matching keys", () => {
  assert.deepEqual(
    getCategoryIndicators({
      key: "language",
      label: "Language",
      sections: [
        {
          indicators: [{ key: "speaking", label: "Speaking" }],
        },
      ],
    }),
    [{ key: "speaking", label: "Speaking" }]
  );
  assert.equal(makeAssessmentKey("language", "speaking"), "language::speaking");
  assert.equal(
    normalizeProgressReportMatchValue("  Language Skills "),
    "language skills"
  );
});

test("routes Grade R A and B to the Grade R programme only", () => {
  assert.equal(getClassroomReportType("Grade R (a)"), "grade-r");
  assert.equal(getClassroomReportType("Grade R (b)"), "grade-r");
  assert.equal(getClassroomReportType("Grade RR (a)"), "grade-rr");
  assert.equal(getClassroomReportType("Pre Grade R (b)"), "grade-rr");
  assert.equal(getClassroomReportType("Babies"), "developmental");
  assert.equal(isGradeRActivityTheme("Grade R: Mathematics"), true);
  assert.equal(isGradeRActivityTheme("Mathematics"), false);
});

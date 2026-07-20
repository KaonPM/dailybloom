"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { reportCategories } from "../lib/report-categories";
import {
  gradeRRCategories,
  gradeRRRatingScale,
} from "../lib/grade-rr-categories";

const levelOptions = [
  { value: "NP", label: "NP - Needs Practice" },
  { value: "PA", label: "PA - Partially Achieved" },
  { value: "A", label: "A - Achieved" },
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
];

type ReportType = "developmental" | "grade-rr";
type Indicator = { key: string; label: string };
type Category = {
  key: string;
  label: string;
  description?: string;
  indicators?: Indicator[];
  sections?: { indicators?: Indicator[] }[];
};
type LevelOption = { value: string | number; label: string };
type ProfileRow = {
  id: string;
  role?: string | null;
  school_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};
type ClassroomRow = { id: number; classroom_name?: string | null };
type LearnerRow = {
  id: string | number;
  name?: string | null;
  full_name?: string | null;
  classroom_id?: number | null;
  class?: string | null;
  classroom_name?: string | null;
};
type PeriodRow = {
  id: number;
  title?: string | null;
  report_type?: string | null;
  report_template?: ReportType | null;
};
type AssessmentRow = {
  category?: string | null;
  indicator_key?: string | null;
  level?: string | null;
  teacher_comment?: string | null;
  status?: string | null;
};
type AssessmentValues = Record<string, Record<string, { level: string }>>;
type AssessmentUpsertRow = {
  school_id: number;
  classroom_id: number;
  learner_id: string;
  report_period_id: number;
  report_type: ReportType;
  category: string;
  indicator_key: string;
  indicator_label: string;
  level: string;
  teacher_comment: string | null;
  teacher_id: string;
  status: "draft" | "submitted";
  updated_at: string;
};

export default function TeacherAssessmentsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  const [reportType, setReportType] = useState<"developmental" | "grade-rr">(
    "developmental"
  );

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [assessmentValues, setAssessmentValues] = useState<AssessmentValues>({});
  const [overallComment, setOverallComment] = useState("");
  const [existingAssessments, setExistingAssessments] = useState<AssessmentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeCategories =
    reportType === "grade-rr" ? gradeRRCategories : reportCategories;

  const activeLevels =
    reportType === "grade-rr" ? gradeRRRatingScale : levelOptions;

  useEffect(() => {
    loadPage();
  }, []);

  function getCategoryIndicators(category: Category): Indicator[] {
    return (
      category?.indicators ||
      category?.sections?.flatMap((section) => section.indicators || []) ||
      []
    );
  }

  function normalizeLevel(value: string) {
    if (!value) return "";

    const cleaned = value.trim();

    if (cleaned === "NP" || cleaned === "NP - Needs Practice") return "NP";
    if (cleaned === "PA" || cleaned === "PA - Partially Achieved") return "PA";
    if (cleaned === "A" || cleaned === "A - Achieved") return "A";
    if (cleaned === "G" || cleaned === "G - Good") return "G";
    if (cleaned === "VG" || cleaned === "VG - Very Good") return "VG";

    if (cleaned === "needs_support") return "NP";
    if (cleaned === "progressing") return "PA";
    if (cleaned === "meeting_expectations") return "G";
    if (cleaned === "exceeding_expectations") return "VG";

    if (cleaned === "1" || cleaned === "1 - Not yet achieved expectations") {
      return "1";
    }
    if (cleaned === "2" || cleaned === "2 - Partially achieved expectations") {
      return "2";
    }
    if (cleaned === "3" || cleaned === "3 - Achieved expectations") {
      return "3";
    }
    if (cleaned === "4" || cleaned === "4 - Exceeded expectations") {
      return "4";
    }

    return "";
  }

  function getTemplateFromPeriod(periodId: string) {
    const selectedPeriod = periods.find(
      (period) => String(period.id) === String(periodId)
    );

    return selectedPeriod?.report_template === "grade-rr"
      ? "grade-rr"
      : "developmental";
  }

  function formatReportTemplate(template: string) {
    if (template === "grade-rr") return "Grade RR Assessment";
    return "Developmental Assessment";
  }

  async function loadPage() {
    const result = await getCurrentProfile();

    if (result.error || !result.profile) {
      router.push("/login");
      return;
    }

    const currentProfile = result.profile;

    if (currentProfile.role !== "teacher" && currentProfile.role !== "principal") {
      router.push("/dashboard");
      return;
    }

    if (!currentProfile.school_id) {
      alert("No school linked to this account.");
      router.push("/dashboard");
      return;
    }

    setProfile(currentProfile);
    setSchoolId(Number(currentProfile.school_id));

    await fetchClassrooms(Number(currentProfile.school_id));
    await fetchPeriods(Number(currentProfile.school_id));

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms(data || []);
  }

  async function fetchPeriods(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("report_periods")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPeriods(data || []);
  }

  async function fetchLearnersByClassroom(classroomId: string) {
    if (!schoolId || !classroomId) {
      setLearners([]);
      return;
    }

    const selectedClassroom = classrooms.find(
      (room) => String(room.id) === String(classroomId)
    );

    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", schoolId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const filtered = (data || []).filter((learner) => {
      return (
        String(learner.classroom_id) === String(classroomId) ||
        learner.class === selectedClassroom?.classroom_name ||
        learner.classroom_name === selectedClassroom?.classroom_name
      );
    });

    setLearners(filtered);
  }

  async function loadExistingAssessment(
    learnerId: string,
    periodId: string,
    template = reportType
  ) {
    if (!learnerId || !periodId) return;

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("learner_id", learnerId)
      .eq("report_period_id", Number(periodId))
      .eq("report_type", template);

    if (error) {
      alert(error.message);
      return;
    }

    setExistingAssessments(data || []);

    const categories =
      template === "grade-rr" ? gradeRRCategories : reportCategories;

    const nextValues: AssessmentValues = {};

    (categories as Category[]).forEach((category) => {
      nextValues[category.key] = {};

      getCategoryIndicators(category).forEach((indicator) => {
        const existing = data?.find(
          (item) =>
            item.category === category.key &&
            item.indicator_key === indicator.key
        );

        nextValues[category.key][indicator.key] = {
          level: normalizeLevel(existing?.level || ""),
        };
      });
    });

    setAssessmentValues(nextValues);
    setOverallComment(data?.[0]?.teacher_comment || "");
  }

  function updateAssessmentLevel(
    categoryKey: string,
    indicatorKey: string,
    value: string
  ) {
    setAssessmentValues((current) => ({
      ...current,
      [categoryKey]: {
        ...current[categoryKey],
        [indicatorKey]: {
          ...current[categoryKey]?.[indicatorKey],
          level: normalizeLevel(value),
        },
      },
    }));
  }

  async function saveAssessment(status: "draft" | "submitted") {
    if (!schoolId) {
      alert("School is not linked correctly.");
      return;
    }

    if (!profile?.id) {
      alert("Teacher profile is not loaded.");
      return;
    }

    if (!selectedClassroomId) {
      alert("Please select class.");
      return;
    }

    if (!selectedLearnerId) {
      alert("Please select learner.");
      return;
    }

    if (!selectedPeriodId) {
      alert("Please select report period.");
      return;
    }

    const template = getTemplateFromPeriod(selectedPeriodId);

    const missingLevel = (activeCategories as Category[]).some((category) =>
      getCategoryIndicators(category).some((indicator) => {
        const level = normalizeLevel(
          assessmentValues?.[category.key]?.[indicator.key]?.level || ""
        );

        return !level;
      })
    );

    if (missingLevel) {
      alert("Please select a level for every assessment indicator.");
      return;
    }

    setSaving(true);

    const rowsMap = new Map<string, AssessmentUpsertRow>();

    (activeCategories as Category[]).forEach((category) => {
      getCategoryIndicators(category).forEach((indicator) => {
        const row = {
          school_id: Number(schoolId),
          classroom_id: Number(selectedClassroomId),
          learner_id: selectedLearnerId,
          report_period_id: Number(selectedPeriodId),
          report_type: template,
          category: category.key,
          indicator_key: indicator.key,
          indicator_label: indicator.label,
          level: normalizeLevel(
            assessmentValues?.[category.key]?.[indicator.key]?.level || ""
          ),
          teacher_comment: overallComment || null,
          teacher_id: profile.id,
          status,
          updated_at: new Date().toISOString(),
        };

        const key = `${row.learner_id}-${row.report_period_id}-${row.report_type}-${row.category}-${row.indicator_key}`;
        rowsMap.set(key, row);
      });
    });

    const rows = Array.from(rowsMap.values());

    const { error } = await supabase
      .from("learner_assessments")
      .upsert(rows, {
        onConflict:
          "learner_id,report_period_id,report_type,category,indicator_key",
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadExistingAssessment(selectedLearnerId, selectedPeriodId, template);

    setSaving(false);

    alert(
      status === "draft"
        ? "Assessment draft saved."
        : "Assessment submitted to principal."
    );
  }

  function formatPeriodType(type: string) {
    if (type === "quarterly") return "Quarterly Report";
    if (type === "biannual") return "Biannual Report";
    if (type === "annual") return "Annual Report";
    return type || "Report";
  }

  const teacherName =
    profile?.full_name || profile?.name || profile?.email || "Teacher";

  const canShowAssessmentForm =
    selectedClassroomId && selectedLearnerId && selectedPeriodId;

  const currentStatus = existingAssessments?.[0]?.status || null;

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 22, marginBottom: 24 }}>
        <h1 className="db-page-title">Learner Progress Assessments</h1>
        <p className="db-page-subtitle">
          Complete the assessment type selected by the principal for the open
          report period.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h3 style={sectionTitle}>Class, Teacher and Learner</h3>

          {currentStatus ? (
            <span style={currentStatus === "submitted" ? pillGreen : pillNeutral}>
              {currentStatus === "submitted" ? "Submitted" : "Draft"}
            </span>
          ) : null}
        </div>

        <div className="db-list-card" style={{ marginBottom: 14 }}>
          <strong>Assessment Type</strong>
          <p style={textStyle}>{formatReportTemplate(reportType)}</p>
        </div>

        <select
          className="db-input"
          value={selectedClassroomId}
          onChange={async (e) => {
            const classroomId = e.target.value;

            setSelectedClassroomId(classroomId);
            setSelectedLearnerId("");
            setSelectedPeriodId("");
            setReportType("developmental");
            setAssessmentValues({});
            setOverallComment("");
            setExistingAssessments([]);

            await fetchLearnersByClassroom(classroomId);
          }}
        >
          <option value="">Select Class</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={String(classroom.id)}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <div className="db-list-card" style={{ marginBottom: 14 }}>
          <strong>Teacher</strong>
          <p style={textStyle}>{teacherName}</p>
        </div>

        <select
          className="db-input"
          value={selectedLearnerId}
          onChange={async (e) => {
            const learnerId = e.target.value;
            setSelectedLearnerId(learnerId);
            setAssessmentValues({});
            setExistingAssessments([]);
            setOverallComment("");

            if (learnerId && selectedPeriodId) {
              const template = getTemplateFromPeriod(selectedPeriodId);
              setReportType(template);
              await loadExistingAssessment(learnerId, selectedPeriodId, template);
            }
          }}
        >
          <option value="">Select Learner</option>
          {learners.map((learner) => (
            <option key={learner.id} value={String(learner.id)}>
              {learner.name || learner.full_name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedPeriodId}
          onChange={async (e) => {
            const periodId = e.target.value;
            setSelectedPeriodId(periodId);
            setAssessmentValues({});
            setExistingAssessments([]);
            setOverallComment("");

            const template = getTemplateFromPeriod(periodId);
            setReportType(template);

            if (selectedLearnerId && periodId) {
              await loadExistingAssessment(selectedLearnerId, periodId, template);
            }
          }}
        >
          <option value="">Select Report Period</option>
          {periods.map((period) => (
            <option key={period.id} value={String(period.id)}>
              {period.title} ({formatPeriodType(period.report_type)} -{" "}
              {formatReportTemplate(period.report_template || "developmental")})
            </option>
          ))}
        </select>
      </div>

      {canShowAssessmentForm ? (
        <div className="db-card db-card-lavender" style={{ padding: 20 }}>
          <h3 style={sectionTitle}>
            {reportType === "grade-rr"
              ? "Grade RR Assessment Indicators"
              : "Development Indicators"}
          </h3>

          <div style={{ display: "grid", gap: 16 }}>
            {(activeCategories as Category[]).map((category) => (
              <div key={category.key} className="db-list-card">
                <strong>{category.label}</strong>
                <p style={textStyle}>{category.description}</p>

                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {getCategoryIndicators(category).map((indicator) => (
                    <div key={indicator.key}>
                      <label style={labelText}>{indicator.label}</label>

                      <select
                        className="db-input"
                        value={
                          assessmentValues?.[category.key]?.[indicator.key]
                            ?.level || ""
                        }
                        onChange={(e) =>
                          updateAssessmentLevel(
                            category.key,
                            indicator.key,
                            e.target.value
                          )
                        }
                      >
                        <option value="">Select Level</option>
                        {(activeLevels as LevelOption[]).map((level) => (
                          <option
                            key={level.value || level}
                            value={level.value || level}
                          >
                            {level.label || level}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="db-list-card" style={{ marginTop: 20 }}>
            <strong>Teacher Observation</strong>
            <textarea
              className="db-input"
              rows={3}
              placeholder="Teacher observation"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <button
              className="db-button-primary"
              onClick={() => saveAssessment("draft")}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              className="db-button-primary"
              onClick={() => saveAssessment("submitted")}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit to Principal"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 14px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800 as const,
};

const labelText = {
  display: "block",
  margin: "0 0 8px 0",
  color: "#2D2A3E",
  fontSize: 14,
  fontWeight: 700 as const,
};

const textStyle = {
  margin: "6px 0 12px 0",
  color: "#6D6888",
  fontSize: 14,
};

const pillGreen = {
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  height: "fit-content",
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  height: "fit-content",
};

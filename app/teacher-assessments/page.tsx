"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { reportCategories } from "../lib/report-categories";
import {
  gradeRRCategories,
  gradeRRRatingScale,
} from "../lib/grade-rr-categories";
import {
  gradeRCategories,
  gradeRRatingScale,
} from "../lib/grade-r-categories";
import { PERMISSIONS } from "../lib/permissions";
import {
  getClassroomReportType,
  normalizeReportType,
} from "../lib/classroom-programme";

const levelOptions = [
  { value: "NP", label: "NP - Needs Practice" },
  { value: "PA", label: "PA - Partially Achieved" },
  { value: "A", label: "A - Achieved" },
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
];

type ReportType = "developmental" | "grade-rr" | "grade-r";
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
  classroom_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  permissions?: string[] | null;
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
type EvidenceSnapshot = { attendance: { present: number; absent: number; rate: number | null }; activities: Array<{ developmental_area?: string | null; activity_name?: string | null }>; support_cases: Array<{ developmental_area?: string | null; support_status?: string | null; observation?: string | null }>; support_updates: Array<{ support_status?: string | null; intervention?: string | null; progress_note?: string | null; next_review_date?: string | null }>; summaries: Array<{ notes?: string | null; teacher_notes?: string | null }>; awards: Array<{ award_name?: string | null; award_reason?: string | null }> };
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
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);

  const [reportType, setReportType] = useState<ReportType>(
    "developmental"
  );

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [assessmentValues, setAssessmentValues] = useState<AssessmentValues>({});
  const [overallComment, setOverallComment] = useState("");
  const [existingAssessments, setExistingAssessments] = useState<AssessmentRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSnapshot | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedClassroom = useMemo(
    () =>
      classrooms.find(
        (classroom) => String(classroom.id) === String(selectedClassroomId)
      ),
    [classrooms, selectedClassroomId]
  );
  const selectedClassroomReportType = selectedClassroom
    ? getClassroomReportType(selectedClassroom.classroom_name)
    : null;
  const visiblePeriods = useMemo(
    () =>
      periods.filter(
        (period) =>
          !selectedClassroomReportType ||
          normalizeReportType(period.report_template) ===
            selectedClassroomReportType
      ),
    [periods, selectedClassroomReportType]
  );

  const activeCategories =
    reportType === "grade-r"
      ? gradeRCategories
      : reportType === "grade-rr"
        ? gradeRRCategories
        : reportCategories;

  const activeLevels =
    reportType === "grade-r"
      ? gradeRRatingScale
      : reportType === "grade-rr"
        ? gradeRRRatingScale
        : levelOptions;

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!schoolId || !selectedLearnerId || !selectedPeriodId) { setEvidence(null); return; }
    let cancelled = false;
    async function loadEvidence() {
      setEvidenceLoading(true);
      try {
        const response = await authenticatedFetch(`/api/learner-evidence?school_id=${schoolId}&learner_id=${selectedLearnerId}&report_period_id=${selectedPeriodId}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Evidence could not be loaded.");
        if (!cancelled) setEvidence(payload as EvidenceSnapshot);
      } catch (error) {
        if (!cancelled) alert(error instanceof Error ? error.message : "Evidence could not be loaded.");
      } finally { if (!cancelled) setEvidenceLoading(false); }
    }
    void loadEvidence();
    return () => { cancelled = true; };
  }, [schoolId, selectedLearnerId, selectedPeriodId]);

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

    const dbAchievementCode = cleaned.match(/^([1-7])(?:\s|-|$)/);
    if (dbAchievementCode) return dbAchievementCode[1];

    return "";
  }

  function getTemplateFromPeriod(periodId: string) {
    if (selectedClassroomReportType) return selectedClassroomReportType;

    const selectedPeriod = periods.find(
      (period) => String(period.id) === String(periodId)
    );

    return normalizeReportType(selectedPeriod?.report_template);
  }

  function formatReportTemplate(template: string) {
    if (template === "grade-rr") return "Grade RR Assessment";
    if (template === "grade-r") return "Grade R Assessment";
    return "Developmental Assessment";
  }

  async function loadPage() {
    const result = await getCurrentProfile();

    if (result.error || !result.profile) {
      router.push("/login");
      return;
    }

    const currentProfile = result.profile;

    const role = String(currentProfile.role || "").toLowerCase();
    const mayManageReports =
      ["principal", "owner", "master"].includes(role) ||
      (role === "admin" &&
        (currentProfile.permissions || []).includes(
          PERMISSIONS.PROGRESS_REPORTS_MANAGE
        ));

    if (role !== "teacher" && !mayManageReports) {
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

    const classroomRows = await fetchClassrooms(Number(currentProfile.school_id));
    const periodRows = await fetchPeriods(Number(currentProfile.school_id));
    const requestedClassroomId = searchParams.get("classroom") || "";
    const requestedLearnerId = searchParams.get("learner") || "";
    const requestedPeriodId = searchParams.get("period") || "";
    const requestedClassroom = classroomRows.find((item) => String(item.id) === requestedClassroomId);
    if (requestedClassroom && requestedLearnerId && periodRows.some((item) => String(item.id) === requestedPeriodId)) {
      setSelectedClassroomId(requestedClassroomId);
      setSelectedLearnerId(requestedLearnerId);
      setSelectedPeriodId(requestedPeriodId);
      setReportType(getClassroomReportType(requestedClassroom.classroom_name));
      await fetchLearnersByClassroom(requestedClassroomId);
    }

    if (role === "teacher" && currentProfile.classroom_id) {
      const assignedClassroom = classroomRows.find(
        (classroom) =>
          String(classroom.id) === String(currentProfile.classroom_id)
      );

      setSelectedClassroomId(String(currentProfile.classroom_id));
      setReportType(
        getClassroomReportType(assignedClassroom?.classroom_name)
      );
    }

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
      return [] as ClassroomRow[];
    }

    const nextClassrooms = (data || []) as ClassroomRow[];
    setClassrooms(nextClassrooms);
    return nextClassrooms;
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
      return [] as PeriodRow[];
    }

    const nextPeriods = (data || []) as PeriodRow[];
    setPeriods(nextPeriods);
    return nextPeriods;
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
      template === "grade-r"
        ? gradeRCategories
        : template === "grade-rr"
          ? gradeRRCategories
          : reportCategories;

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
      alert("Practitioner profile is not loaded.");
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

    const selectedPeriod = periods.find(
      (period) => String(period.id) === String(selectedPeriodId)
    );
    const template = selectedClassroomReportType || "developmental";

    if (normalizeReportType(selectedPeriod?.report_template) !== template) {
      alert(
        `This class uses the ${formatReportTemplate(template)}. Please select a matching report period.`
      );
      return;
    }

    if (reportType !== template) {
      setReportType(template);
      alert("The assessment type was corrected for this class. Please review the ratings and save again.");
      return;
    }

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
        const row: AssessmentUpsertRow = {
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

  function formatPeriodType(type?: string | null) {
    if (type === "quarterly") return "Quarterly Report";
    if (type === "biannual") return "Biannual Report";
    if (type === "annual") return "Annual Report";
    return type || "Report";
  }

  const teacherName =
    profile?.full_name || profile?.name || profile?.email || "Practitioner";

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
        {currentStatus ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <span style={currentStatus === "submitted" ? pillGreen : pillNeutral}>
              {currentStatus === "submitted" ? "Submitted" : "Draft"}
            </span>
          </div>
        ) : null}

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
            const classroom = classrooms.find(
              (item) => String(item.id) === String(classroomId)
            );
            setReportType(
              classroom
                ? getClassroomReportType(classroom.classroom_name)
                : "developmental"
            );
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
          <strong>Practitioner</strong>
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
          {visiblePeriods.map((period) => (
            <option key={period.id} value={String(period.id)}>
              {period.title} ({formatPeriodType(period.report_type)} -{" "}
              {formatReportTemplate(period.report_template || "developmental")})
            </option>
          ))}
        </select>
      </div>

      {canShowAssessmentForm ? (
        <details className="db-card db-card-green" style={{ padding: 20, marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800, color: "#2D2A3E" }}>Evidence for this review</summary>
          {evidenceLoading ? <p style={textStyle}>Loading learner evidence…</p> : evidence ? <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <p style={textStyle}>Use this evidence to inform your professional judgement. It does not automatically set a rating.</p>
            <div className="db-list-card"><strong>Attendance</strong><p style={textStyle}>{evidence.attendance.rate === null ? "No attendance captured for this period." : `${evidence.attendance.rate}% present · ${evidence.attendance.present} present · ${evidence.attendance.absent} absent`}</p></div>
            <div className="db-list-card"><strong>Completed learning activities ({evidence.activities.length})</strong><p style={textStyle}>{[...new Set(evidence.activities.map((item) => item.developmental_area).filter(Boolean))].join(" · ") || "No completed activities recorded for this period."}</p></div>
            <div className="db-list-card"><strong>Support and interventions</strong><p style={textStyle}>{evidence.support_cases.length ? `${evidence.support_cases.length} support case(s) · ${evidence.support_updates.length} recorded follow-up(s)` : "No learner support cases recorded for this period."}</p>{evidence.support_updates.slice(0, 2).map((item, index) => <p key={index} style={textStyle}>{item.intervention || item.progress_note || item.support_status}{item.next_review_date ? ` · Review: ${item.next_review_date}` : ""}</p>)}</div>
            <div className="db-list-card"><strong>Daily observations and achievements</strong><p style={textStyle}>{evidence.summaries.length} summary observation(s) · {evidence.awards.length} award(s)</p></div>
          </div> : null}
        </details>
      ) : null}

      {canShowAssessmentForm ? (
        <div className="db-card db-card-lavender" style={{ padding: 20 }}>
          <h3 style={sectionTitle}>
            {reportType === "grade-r"
              ? "Grade R Assessment Indicators"
              : reportType === "grade-rr"
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
                            key={String(level.value)}
                            value={String(level.value)}
                          >
                            {level.label}
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
            <strong>Practitioner Observation</strong>
            <textarea
              className="db-input"
              rows={3}
              placeholder="Practitioner observation"
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

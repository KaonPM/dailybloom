"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { reportCategories, reportLevels } from "../lib/report-categories";
import { useRouter } from "next/navigation";

export default function TeacherAssessmentsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [assessmentValues, setAssessmentValues] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  function isValidNumber(value: any) {
    if (value === "" || value === null || value === undefined) return false;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && !Number.isNaN(parsedValue);
  }

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "teacher" && profile.role !== "principal") {
      router.push("/dashboard");
      return;
    }

    if (!isValidNumber(profile.school_id)) {
      alert("No school linked to this account.");
      router.push("/dashboard");
      return;
    }

    const currentSchoolId = Number(profile.school_id);

    setProfile(profile);
    setSchoolId(currentSchoolId);

    await fetchClassrooms(currentSchoolId);
    await fetchPeriods(currentSchoolId);

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

  async function fetchLearnersByClassroom(
    currentSchoolId: number,
    classroomId: string
  ) {
    if (!isValidNumber(classroomId)) {
      setLearners([]);
      return;
    }

    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("classroom_id", Number(classroomId))
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners(data || []);
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

  async function loadExistingAssessment(learnerId: string, periodId: string) {
    if (!isValidNumber(learnerId) || !isValidNumber(periodId)) return;

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("learner_id", Number(learnerId))
      .eq("report_period_id", Number(periodId));

    if (error) {
      alert(error.message);
      return;
    }

    const nextValues: any = {};

    reportCategories.forEach((category) => {
      const existing = data?.find((item) => item.category === category.key);

      nextValues[category.key] = {
        level: existing?.level || "",
        teacher_comment: existing?.teacher_comment || "",
        status: existing?.status || "draft",
      };
    });

    setAssessmentValues(nextValues);
  }

  function formatPeriodType(type: string) {
    if (type === "quarterly") return "Quarterly Report";
    if (type === "biannual") return "Biannual Report";
    if (type === "annual") return "Annual Report";
    return type || "Report";
  }

  function updateCategory(categoryKey: string, field: string, value: string) {
    setAssessmentValues((current: any) => ({
      ...current,
      [categoryKey]: {
        ...current[categoryKey],
        [field]: value,
      },
    }));
  }

  async function saveAssessment(status: "draft" | "submitted") {
    const parsedSchoolId = Number(schoolId);
    const parsedClassroomId = Number(selectedClassroomId);
    const parsedLearnerId = Number(selectedLearnerId);
    const parsedPeriodId = Number(selectedPeriodId);

    if (!isValidNumber(parsedSchoolId)) {
      alert("School is not linked correctly.");
      return;
    }

    if (!profile?.id) {
      alert("Teacher profile is not loaded.");
      return;
    }

    if (!isValidNumber(selectedClassroomId)) {
      alert("Please select class.");
      return;
    }

    if (!isValidNumber(selectedLearnerId)) {
      alert("Please select learner.");
      return;
    }

    if (!isValidNumber(selectedPeriodId)) {
      alert("Please select report period.");
      return;
    }

    const missingLevel = reportCategories.some((category) => {
      return !assessmentValues[category.key]?.level;
    });

    if (missingLevel) {
      alert("Please select a level for every development area.");
      return;
    }

    setSaving(true);

    const rows = reportCategories.map((category) => ({
      school_id: parsedSchoolId,
      classroom_id: parsedClassroomId,
      learner_id: parsedLearnerId,
      report_period_id: parsedPeriodId,
      category: category.key,
      level: assessmentValues[category.key]?.level,
      teacher_comment: assessmentValues[category.key]?.teacher_comment || null,
      teacher_id: profile.id,
      status,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("learner_assessments")
      .upsert(rows, {
        onConflict: "learner_id,report_period_id,category",
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert(
      status === "draft"
        ? "Assessment draft saved."
        : "Assessment submitted to principal."
    );
  }

  const teacherName =
    profile?.full_name || profile?.name || profile?.email || "Teacher";

  const canShowAssessmentForm =
    isValidNumber(selectedClassroomId) &&
    isValidNumber(selectedLearnerId) &&
    isValidNumber(selectedPeriodId);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{ padding: "20px 22px", marginBottom: "24px" }}
      >
        <h1 className="db-page-title">Learner Progress Assessments</h1>
        <p className="db-page-subtitle">
          Complete learner development assessments and submit them to the
          principal.
        </p>
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <h3 style={sectionTitle}>Class, Teacher and Learner</h3>

        <select
          className="db-input"
          value={selectedClassroomId}
          onChange={async (e) => {
            const classroomId = e.target.value;

            setSelectedClassroomId(classroomId);
            setSelectedLearnerId("");
            setAssessmentValues({});

            if (schoolId && isValidNumber(classroomId)) {
              await fetchLearnersByClassroom(schoolId, classroomId);
            } else {
              setLearners([]);
            }
          }}
        >
          <option value="">Select Class</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={String(classroom.id)}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <div className="db-list-card" style={{ marginBottom: "14px" }}>
          <strong>Teacher</strong>
          <p style={textStyle}>{teacherName}</p>
        </div>

        <select
          className="db-input"
          value={selectedLearnerId}
          onChange={async (e) => {
            const learnerId = e.target.value;

            setSelectedLearnerId(learnerId);
            await loadExistingAssessment(learnerId, selectedPeriodId);
          }}
        >
          <option value="">Select Learner</option>
          {learners.map((learner) => (
            <option key={learner.id} value={String(learner.id)}>
              {learner.name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedPeriodId}
          onChange={async (e) => {
            const periodId = e.target.value;

            setSelectedPeriodId(periodId);
            await loadExistingAssessment(selectedLearnerId, periodId);
          }}
        >
          <option value="">Select Report Period</option>
          {periods.map((period) => (
            <option key={period.id} value={String(period.id)}>
              {period.title} ({formatPeriodType(period.report_type)})
            </option>
          ))}
        </select>
      </div>

      {canShowAssessmentForm && (
        <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
          <h3 style={sectionTitle}>Development Areas</h3>

          <div style={{ display: "grid", gap: "16px" }}>
            {reportCategories.map((category) => (
              <div key={category.key} className="db-list-card">
                <strong>{category.label}</strong>
                <p style={textStyle}>({category.description})</p>

                <select
                  className="db-input"
                  value={assessmentValues[category.key]?.level || ""}
                  onChange={(e) =>
                    updateCategory(category.key, "level", e.target.value)
                  }
                >
                  <option value="">Select Level</option>
                  {reportLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>

                <textarea
                  className="db-input"
                  rows={3}
                  placeholder="Teacher observation"
                  value={assessmentValues[category.key]?.teacher_comment || ""}
                  onChange={(e) =>
                    updateCategory(
                      category.key,
                      "teacher_comment",
                      e.target.value
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
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
      )}
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 12px 0",
  color: "var(--db-text-soft)",
};
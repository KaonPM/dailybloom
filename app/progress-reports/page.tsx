"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import {
  reportCategories,
  reportLevels,
  formatReportLevel,
} from "../lib/report-categories";
import { useRouter } from "next/navigation";

export default function ProgressReportsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [school, setSchool] = useState<any>(null);

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [assessments, setAssessments] = useState<any[]>([]);
  const [principalComment, setPrincipalComment] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState("quarterly");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "principal" && profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    if (!profile.school_id && profile.role !== "master") {
      alert("No school linked to this account.");
      return;
    }

    const currentSchoolId = Number(profile.school_id);

    setProfile(profile);
    setSchoolId(currentSchoolId);

    await fetchSchool(currentSchoolId);
    await fetchClassrooms(currentSchoolId);
    await fetchTeachers(currentSchoolId);
    await fetchPeriods(currentSchoolId);

    setLoading(false);
  }

  async function fetchSchool(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .eq("id", currentSchoolId)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setSchool(data);
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

  async function fetchTeachers(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("role", "teacher")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers(data || []);
  }

  async function fetchLearnersByClassroom(currentSchoolId: number, classroomId: string) {
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
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPeriods(data || []);
  }

  async function createReportPeriod() {
    if (!schoolId || !newPeriodTitle) {
      alert("Please enter a report period title.");
      return;
    }

    const { error } = await supabase.from("report_periods").insert([
      {
        school_id: schoolId,
        title: newPeriodTitle,
        report_type: newPeriodType,
        status: "open",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setNewPeriodTitle("");
    setNewPeriodType("quarterly");

    await fetchPeriods(schoolId);
    alert("Progress report period created.");
  }

  async function loadReportData(learnerId: string, periodId: string, teacherId?: string) {
    if (!learnerId || !periodId) return;

    let query = supabase
      .from("learner_assessments")
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .eq("learner_id", Number(learnerId))
      .eq("report_period_id", Number(periodId));

    if (teacherId) {
      query = query.eq("teacher_id", teacherId);
    }

    const { data: assessmentData, error: assessmentError } = await query;

    if (assessmentError) {
      alert(assessmentError.message);
      return;
    }

    setAssessments(assessmentData || []);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("learner_id", Number(learnerId))
      .eq("report_period_id", Number(periodId))
      .maybeSingle();

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setGeneratedReport(reportData);
    setPrincipalComment(reportData?.principal_comment || "");
  }

  function updateAssessment(category: string, field: string, value: string) {
    setAssessments((current) =>
      current.map((item) =>
        item.category === category ? { ...item, [field]: value } : item
      )
    );
  }

  async function savePrincipalReview() {
    if (!assessments.length) {
      alert("No teacher assessments found for this learner.");
      return;
    }

    setSaving(true);

    const rows = assessments.map((item) => ({
      ...item,
      status: "reviewed",
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
    alert("Principal review saved.");
  }

  async function generateReport() {
    if (!schoolId || !profile?.id || !selectedClassroomId || !selectedTeacherId || !selectedLearnerId || !selectedPeriodId) {
      alert("Please select class, teacher, learner and report period.");
      return;
    }

    if (!assessments.length) {
      alert("No submitted assessments found.");
      return;
    }

    setSaving(true);

    const { error: reportError } = await supabase
      .from("generated_reports")
      .upsert(
        [
          {
            school_id: schoolId,
            learner_id: Number(selectedLearnerId),
            report_period_id: Number(selectedPeriodId),
            principal_id: profile.id,
            principal_comment: principalComment || null,
            report_status: "generated",
            locked: true,
            generated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "learner_id,report_period_id",
        }
      );

    if (reportError) {
      alert(reportError.message);
      setSaving(false);
      return;
    }

    const lockedRows = assessments.map((item) => ({
      ...item,
      status: "locked",
      updated_at: new Date().toISOString(),
    }));

    const { error: lockError } = await supabase
      .from("learner_assessments")
      .upsert(lockedRows, {
        onConflict: "learner_id,report_period_id,category",
      });

    if (lockError) {
      alert(lockError.message);
      setSaving(false);
      return;
    }

    await loadReportData(selectedLearnerId, selectedPeriodId, selectedTeacherId);

    setSaving(false);
    alert("Official progress report generated and locked.");
  }

  function printReport() {
    window.print();
  }

  const selectedClassroom = classrooms.find(
    (classroom) => String(classroom.id) === String(selectedClassroomId)
  );

  const selectedTeacher = teachers.find(
    (teacher) => String(teacher.id) === String(selectedTeacherId)
  );

  const selectedLearner = learners.find(
    (learner) => String(learner.id) === String(selectedLearnerId)
  );

  const selectedPeriod = periods.find(
    (period) => String(period.id) === String(selectedPeriodId)
  );

  const teacherName =
    selectedTeacher?.full_name ||
    selectedTeacher?.email ||
    assessments[0]?.profiles?.full_name ||
    assessments[0]?.profiles?.email ||
    "Teacher not recorded";

  const principalName =
    profile?.full_name ||
    profile?.name ||
    profile?.email ||
    "Principal";

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div className="db-soft-card no-print" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h1 className="db-page-title">Progress Reports</h1>
        <p className="db-page-subtitle">
          Review teacher assessments and generate official learner progress reports.
        </p>
      </div>

      <div className="db-card db-card-blue no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Create Progress Report Period</h3>

        <input
          className="db-input"
          placeholder="Example: Term 1 Progress Report 2026"
          value={newPeriodTitle}
          onChange={(e) => setNewPeriodTitle(e.target.value)}
        />

        <select
          className="db-input"
          value={newPeriodType}
          onChange={(e) => setNewPeriodType(e.target.value)}
        >
          <option value="quarterly">Quarterly</option>
          <option value="biannual">Biannual</option>
          <option value="annual">Annual</option>
        </select>

        <button className="db-button-primary" onClick={createReportPeriod}>
          Create Progress Report Period
        </button>
      </div>

      <div className="db-card db-card-green no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Select Class, Teacher and Learner</h3>

        <select
          className="db-input"
          value={selectedClassroomId}
          onChange={async (e) => {
            const classroomId = e.target.value;

            setSelectedClassroomId(classroomId);
            setSelectedTeacherId("");
            setSelectedLearnerId("");
            setAssessments([]);
            setGeneratedReport(null);
            setPrincipalComment("");

            if (schoolId && classroomId) {
              await fetchLearnersByClassroom(schoolId, classroomId);
            } else {
              setLearners([]);
            }
          }}
        >
          <option value="">Select Class</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedTeacherId}
          onChange={async (e) => {
            setSelectedTeacherId(e.target.value);
            await loadReportData(selectedLearnerId, selectedPeriodId, e.target.value);
          }}
        >
          <option value="">Select Teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name || teacher.email}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedLearnerId}
          onChange={async (e) => {
            setSelectedLearnerId(e.target.value);
            await loadReportData(e.target.value, selectedPeriodId, selectedTeacherId);
          }}
        >
          <option value="">Select Learner</option>
          {learners.map((learner) => (
            <option key={learner.id} value={learner.id}>
              {learner.name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedPeriodId}
          onChange={async (e) => {
            setSelectedPeriodId(e.target.value);
            await loadReportData(selectedLearnerId, e.target.value, selectedTeacherId);
          }}
        >
          <option value="">Select Report Period</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.title} ({period.report_type})
            </option>
          ))}
        </select>
      </div>

      {selectedClassroom && selectedTeacher && selectedLearner && selectedPeriod && (
        <div className="db-card db-card-lavender report-print-area" style={{ padding: "24px" }}>
          <div style={reportHeader}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              {school?.logo_url ? (
                <img
                  src={school.logo_url}
                  alt="School Logo"
                  style={{
                    width: "82px",
                    height: "82px",
                    objectFit: "cover",
                    borderRadius: "16px",
                    background: "#fff",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "82px",
                    height: "82px",
                    borderRadius: "16px",
                    background: "#f2f2f2",
                  }}
                />
              )}

              <div>
                <h1 style={{ margin: 0 }}>
                  {school?.school_name || "School Name"}
                </h1>

                <p style={textStyle}>Learner Progress Report</p>
                <p style={textStyle}>{selectedPeriod.title}</p>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <strong>{selectedPeriod.report_type.toUpperCase()}</strong>

              <p style={textStyle}>
                Generated: {new Date().toLocaleDateString()}
              </p>

              <p style={textStyle}>
                Status: {generatedReport ? "Generated and Locked" : "Draft Review"}
              </p>
            </div>
          </div>

          <div style={learnerCard}>
            <h2 style={{ margin: 0 }}>{selectedLearner.name}</h2>

            <p style={textStyle}>
              <strong>Class:</strong> {selectedClassroom.classroom_name}
            </p>

            <p style={textStyle}>
              <strong>Teacher:</strong> {teacherName}
            </p>

            <p style={textStyle}>
              <strong>Date of Birth:</strong>{" "}
              {selectedLearner.date_of_birth || "Not added"}
            </p>

            <p style={textStyle}>
              <strong>Principal:</strong> {principalName}
            </p>
          </div>

          {assessments.length === 0 ? (
            <p className="db-helper">No teacher assessment submitted yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
              {reportCategories.map((category) => {
                const assessment = assessments.find(
                  (item) => item.category === category.key
                );

                if (!assessment) return null;

                return (
                  <div key={category.key} className="db-list-card">
                    <strong>{category.label}</strong>
                    <p style={textStyle}>({category.description})</p>

                    {!generatedReport ? (
                      <select
                        className="db-input no-print"
                        value={assessment.level}
                        onChange={(e) =>
                          updateAssessment(category.key, "level", e.target.value)
                        }
                      >
                        {reportLevels.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    <p>
                      <strong>Level:</strong> {formatReportLevel(assessment.level)}
                    </p>

                    {!generatedReport ? (
                      <textarea
                        className="db-input no-print"
                        rows={3}
                        value={assessment.teacher_comment || ""}
                        onChange={(e) =>
                          updateAssessment(
                            category.key,
                            "teacher_comment",
                            e.target.value
                          )
                        }
                      />
                    ) : null}

                    <p style={textStyle}>
                      <strong>Teacher Observation:</strong>{" "}
                      {assessment.teacher_comment || "No observation added."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: "22px" }}>
            <h3 style={sectionTitle}>Principal Comment</h3>

            {!generatedReport ? (
              <textarea
                className="db-input no-print"
                rows={4}
                placeholder="Add official principal comment"
                value={principalComment}
                onChange={(e) => setPrincipalComment(e.target.value)}
              />
            ) : null}

            <p style={textStyle}>
              {principalComment || "No principal comment added."}
            </p>
          </div>

          <p style={{ marginTop: "28px", fontSize: "12px", color: "#777" }}>
            Generated securely by DailyBloom
          </p>

          <div className="no-print" style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
            {!generatedReport && (
              <>
                <button
                  className="db-button-primary"
                  onClick={savePrincipalReview}
                  disabled={saving}
                >
                  Save Principal Review
                </button>

                <button
                  className="db-button-primary"
                  onClick={generateReport}
                  disabled={saving}
                >
                  Generate Official Progress Report
                </button>
              </>
            )}

            <button className="db-button-primary" onClick={printReport}>
              Print / Save PDF
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .report-print-area,
          .report-print-area * {
            visibility: visible;
          }

          .report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
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
  margin: "6px 0",
  color: "var(--db-text-soft)",
};

const reportHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "1px solid #ddd",
  paddingBottom: "16px",
  marginBottom: "18px",
} as const;

const learnerCard = {
  padding: "16px",
  borderRadius: "18px",
  background: "#fff",
  marginBottom: "18px",
} as const;
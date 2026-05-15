"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [allAssessments, setAllAssessments] = useState<any[]>([]);
  const [generatedReports, setGeneratedReports] = useState<any[]>([]);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [reviewAssessments, setReviewAssessments] = useState<any[]>([]);
  const [principalComment, setPrincipalComment] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState("quarterly");

  const [assessmentPage, setAssessmentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pageSize = 5;

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
    await fetchLearners(currentSchoolId);
    await fetchPeriods(currentSchoolId);
    await fetchAllAssessments(currentSchoolId);
    await fetchGeneratedReports(currentSchoolId);

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

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
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

  async function fetchAllAssessments(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", currentSchoolId)
      .in("status", ["submitted", "reviewed"])
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setAllAssessments(data || []);
  }

  async function fetchGeneratedReports(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("generated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setGeneratedReports(data || []);
  }

  function formatPeriodType(type: string) {
    if (type === "quarterly") return "Quarterly Report";
    if (type === "biannual") return "Biannual Report";
    if (type === "annual") return "Annual Report";
    return type;
  }

  async function createReportPeriod() {
    if (!schoolId || !newPeriodTitle) {
      alert("Please enter a progress report period title.");
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

  function getClassroomName(classroomId: any) {
    return (
      classrooms.find((classroom) => String(classroom.id) === String(classroomId))
        ?.classroom_name || "Class not recorded"
    );
  }

  function getLearnerName(learnerId: any) {
    return (
      learners.find((learner) => String(learner.id) === String(learnerId))?.name ||
      "Learner not recorded"
    );
  }

  function getTeacherName(teacherId: any) {
    const teacher = teachers.find((teacher) => String(teacher.id) === String(teacherId));
    return teacher?.full_name || teacher?.name || teacher?.email || "Teacher not recorded";
  }

  function getPeriodTitle(periodId: any) {
    const period = periods.find((period) => String(period.id) === String(periodId));
    return period ? `${period.title} (${formatPeriodType(period.report_type)})` : "Period not recorded";
  }

  const groupedAssessments = useMemo(() => {
    const map = new Map();

    allAssessments.forEach((item) => {
      const key = `${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${item.report_period_id}`;

      if (!map.has(key)) {
        map.set(key, {
          classroom_id: item.classroom_id,
          teacher_id: item.teacher_id,
          learner_id: item.learner_id,
          report_period_id: item.report_period_id,
          updated_at: item.updated_at,
          status: item.status,
          count: 1,
        });
      } else {
        const existing = map.get(key);
        existing.count += 1;
      }
    });

    return Array.from(map.values());
  }, [allAssessments]);

  const filteredAssessments = groupedAssessments.filter((item) => {
    if (selectedClassroomId && String(item.classroom_id) !== String(selectedClassroomId)) return false;
    if (selectedTeacherId && String(item.teacher_id) !== String(selectedTeacherId)) return false;
    if (selectedLearnerId && String(item.learner_id) !== String(selectedLearnerId)) return false;
    if (selectedPeriodId && String(item.report_period_id) !== String(selectedPeriodId)) return false;
    return true;
  });

  const filteredReports = generatedReports.filter((item) => {
    if (selectedClassroomId && String(item.classroom_id) !== String(selectedClassroomId)) return false;
    if (selectedLearnerId && String(item.learner_id) !== String(selectedLearnerId)) return false;
    if (selectedPeriodId && String(item.report_period_id) !== String(selectedPeriodId)) return false;
    return true;
  });

  const visibleAssessments = filteredAssessments.slice(
    (assessmentPage - 1) * pageSize,
    assessmentPage * pageSize
  );

  const visibleReports = filteredReports.slice(
    (reportPage - 1) * pageSize,
    reportPage * pageSize
  );

  async function openAssessmentReview(item: any) {
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedTeacherId(String(item.teacher_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("learner_id", (item.learner_id))
      .eq("report_period_id", Number(item.report_period_id))
      .eq("teacher_id", item.teacher_id);

    if (error) {
      alert(error.message);
      return;
    }

    setReviewAssessments(data || []);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .maybeSingle();

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setGeneratedReport(reportData);
    setPrincipalComment(reportData?.principal_comment || "");

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function openGeneratedReport(item: any) {
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .in("status", ["locked", "generated", "reviewed", "submitted"]);

    if (error) {
      alert(error.message);
      return;
    }

    setReviewAssessments(data || []);
    setGeneratedReport(item);
    setPrincipalComment(item.principal_comment || "");

    if (data && data.length > 0) {
      setSelectedTeacherId(String(data[0].teacher_id || ""));
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function updateAssessment(category: string, field: string, value: string) {
    setReviewAssessments((current) =>
      current.map((item) =>
        item.category === category ? { ...item, [field]: value } : item
      )
    );
  }

  async function savePrincipalReview() {
    if (!reviewAssessments.length) {
      alert("No teacher assessments found for this learner.");
      return;
    }

    setSaving(true);

    const rows = reviewAssessments.map((item) => ({
      ...item,
      classroom_id: Number(selectedClassroomId),
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

    if (schoolId) {
      await fetchAllAssessments(schoolId);
    }

    setSaving(false);
    alert("Principal review saved.");
  }

  async function generateReport() {
    if (!schoolId || !profile?.id || !selectedClassroomId || !selectedLearnerId || !selectedPeriodId) {
      alert("Please select class, learner and report period.");
      return;
    }

    if (!reviewAssessments.length) {
      alert("No submitted assessment found.");
      return;
    }

    setSaving(true);

    const { error: reportError } = await supabase
      .from("generated_reports")
      .upsert(
        [
          {
            school_id: schoolId,
            classroom_id: Number(selectedClassroomId),
            learner_id: selectedLearnerId,
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

    const lockedRows = reviewAssessments.map((item) => ({
      ...item,
      classroom_id: Number(selectedClassroomId),
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

    if (schoolId) {
      await fetchAllAssessments(schoolId);
      await fetchGeneratedReports(schoolId);
    }

    setSaving(false);
    alert("Official progress report generated and locked.");
  }

  function printReport() {
    window.print();
  }

  const selectedClassroom = classrooms.find(
    (classroom) => String(classroom.id) === String(selectedClassroomId)
  );

  const selectedLearner = learners.find(
    (learner) => String(learner.id) === String(selectedLearnerId)
  );

  const selectedPeriod = periods.find(
    (period) => String(period.id) === String(selectedPeriodId)
  );

  const teacherName = getTeacherName(selectedTeacherId);
  const principalName = profile?.full_name || profile?.name || profile?.email || "Principal";

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <div className="db-soft-card no-print" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h1 className="db-page-title">Progress Reports</h1>
        <p className="db-page-subtitle">
          Review teacher assessments, edit where needed, and generate official learner progress reports.
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
          <option value="quarterly">Quarterly Report</option>
          <option value="biannual">Biannual Report</option>
          <option value="annual">Annual Report</option>
        </select>

        <button className="db-button-primary" onClick={createReportPeriod}>
          Create Progress Report Period
        </button>
      </div>

      <div className="db-card db-card-green no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Filter Assessments and Reports</h3>

        <select
          className="db-input"
          value={selectedClassroomId}
          onChange={(e) => {
            setSelectedClassroomId(e.target.value);
            setAssessmentPage(1);
            setReportPage(1);
          }}
        >
          <option value="">All Classes</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedTeacherId}
          onChange={(e) => {
            setSelectedTeacherId(e.target.value);
            setAssessmentPage(1);
          }}
        >
          <option value="">All Teachers</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name || teacher.name || teacher.email}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedLearnerId}
          onChange={(e) => {
            setSelectedLearnerId(e.target.value);
            setAssessmentPage(1);
            setReportPage(1);
          }}
        >
          <option value="">All Learners</option>
          {learners.map((learner) => (
            <option key={learner.id} value={learner.id}>
              {learner.name}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={selectedPeriodId}
          onChange={(e) => {
            setSelectedPeriodId(e.target.value);
            setAssessmentPage(1);
            setReportPage(1);
          }}
        >
          <option value="">All Report Periods</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.title} ({formatPeriodType(period.report_type)})
            </option>
          ))}
        </select>
      </div>

      <div className="db-card db-card-lavender no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Teacher Submitted Assessments</h3>

        {visibleAssessments.length === 0 ? (
          <p className="db-helper">No submitted teacher assessments found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {visibleAssessments.map((item) => (
              <div
                key={`${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${item.report_period_id}`}
                className="db-list-card"
              >
                <strong>{getLearnerName(item.learner_id)}</strong>
                <p style={textStyle}>Class: {getClassroomName(item.classroom_id)}</p>
                <p style={textStyle}>Teacher: {getTeacherName(item.teacher_id)}</p>
                <p style={textStyle}>Period: {getPeriodTitle(item.report_period_id)}</p>
                <p style={textStyle}>Assessment items: {item.count}</p>

                <button
                  className="db-button-primary"
                  style={{ marginTop: "10px" }}
                  onClick={() => openAssessmentReview(item)}
                >
                  Open Review
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            className="db-button-primary"
            disabled={assessmentPage === 1}
            onClick={() => setAssessmentPage((page) => Math.max(1, page - 1))}
          >
            Previous
          </button>

          <button
            className="db-button-primary"
            disabled={assessmentPage * pageSize >= filteredAssessments.length}
            onClick={() => setAssessmentPage((page) => page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="db-card db-card-yellow no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Generated Progress Reports</h3>

        {visibleReports.length === 0 ? (
          <p className="db-helper">No generated progress reports yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {visibleReports.map((item) => (
              <div key={item.id} className="db-list-card">
                <strong>{getLearnerName(item.learner_id)}</strong>
                <p style={textStyle}>Class: {getClassroomName(item.classroom_id)}</p>
                <p style={textStyle}>Period: {getPeriodTitle(item.report_period_id)}</p>
                <p style={textStyle}>
                  Generated:{" "}
                  {item.generated_at
                    ? new Date(item.generated_at).toLocaleDateString()
                    : "Not recorded"}
                </p>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                  <button className="db-button-primary" onClick={() => openGeneratedReport(item)}>
                    View Report
                  </button>

                  <button
                    className="db-button-primary"
                    onClick={async () => {
                      await openGeneratedReport(item);
                      setTimeout(() => printReport(), 300);
                    }}
                  >
                    Download / Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            className="db-button-primary"
            disabled={reportPage === 1}
            onClick={() => setReportPage((page) => Math.max(1, page - 1))}
          >
            Previous
          </button>

          <button
            className="db-button-primary"
            disabled={reportPage * pageSize >= filteredReports.length}
            onClick={() => setReportPage((page) => page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {selectedClassroom && selectedLearner && selectedPeriod && reviewAssessments.length > 0 && (
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
                <h1 style={{ margin: 0 }}>{school?.school_name || "School Name"}</h1>
                <p style={textStyle}>Learner Progress Report</p>
                <p style={textStyle}>{selectedPeriod.title}</p>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <strong>{formatPeriodType(selectedPeriod.report_type)}</strong>
              <p style={textStyle}>Generated: {new Date().toLocaleDateString()}</p>
              <p style={textStyle}>
                Status: {generatedReport ? "Generated and Locked" : "Principal Review"}
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

          <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
            {reportCategories.map((category) => {
              const assessment = reviewAssessments.find(
                (item) => item.category === category.key
              );

              if (!assessment) return null;

              return (
                <div key={category.key} className="db-list-card">
                  <strong>{category.label}</strong>
                  <p style={textStyle}>({category.description})</p>

                  {!generatedReport && (
                    <select
                      className="db-input no-print"
                      value={assessment.level}
                      onChange={(e) => updateAssessment(category.key, "level", e.target.value)}
                    >
                      {reportLevels.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <p>
                    <strong>Level:</strong> {formatReportLevel(assessment.level)}
                  </p>

                  {!generatedReport && (
                    <textarea
                      className="db-input no-print"
                      rows={3}
                      value={assessment.teacher_comment || ""}
                      onChange={(e) =>
                        updateAssessment(category.key, "teacher_comment", e.target.value)
                      }
                    />
                  )}

                  <p style={textStyle}>
                    <strong>Teacher Observation:</strong>{" "}
                    {assessment.teacher_comment || "No observation added."}
                  </p>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "22px" }}>
            <h3 style={sectionTitle}>Principal Comment</h3>

            {!generatedReport && (
              <textarea
                className="db-input no-print"
                rows={4}
                placeholder="Add official principal comment"
                value={principalComment}
                onChange={(e) => setPrincipalComment(e.target.value)}
              />
            )}

            <p style={textStyle}>{principalComment || "No principal comment added."}</p>
          </div>

          <p style={{ marginTop: "28px", fontSize: "12px", color: "#777" }}>
            Generated securely by DailyBloom
          </p>

          <div className="no-print" style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
            {!generatedReport && (
              <>
                <button className="db-button-primary" onClick={savePrincipalReview} disabled={saving}>
                  Save Principal Review
                </button>

                <button className="db-button-primary" onClick={generateReport} disabled={saving}>
                  Generate Official Progress Report
                </button>
              </>
            )}

            <button className="db-button-primary" onClick={printReport}>
              Download / Print Report
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
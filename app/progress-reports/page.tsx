"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import {
  reportCategories,
  reportLevels,
  formatReportLevel,
} from "../lib/report-categories";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Collapsible section states
  const [showFilter, setShowFilter] = useState(false);
  const [showAssessments, setShowAssessments] = useState(true);
  const [showGeneratedReports, setShowGeneratedReports] = useState(true);
  const [expandedAssessmentKey, setExpandedAssessmentKey] = useState<string | null>(null);
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(null);

  const [assessmentPage, setAssessmentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);

  // Single teacher observation text (not per area)
  const [teacherObservation, setTeacherObservation] = useState("");

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
    if (error) { alert(error.message); return; }
    setSchool(data);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });
    if (error) { alert(error.message); return; }
    setClassrooms(data || []);
  }

  async function fetchTeachers(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("role", "teacher")
      .order("created_at", { ascending: false });
    if (error) { alert(error.message); return; }
    setTeachers(data || []);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });
    if (error) { alert(error.message); return; }
    setLearners(data || []);
  }

  async function fetchPeriods(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("report_periods")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });
    if (error) { alert(error.message); return; }
    setPeriods(data || []);
  }

  async function fetchAllAssessments(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", currentSchoolId)
      .in("status", ["submitted", "reviewed"])
      .order("updated_at", { ascending: false });
    if (error) { alert(error.message); return; }
    setAllAssessments(data || []);
  }

  async function fetchGeneratedReports(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("generated_at", { ascending: false });
    if (error) { alert(error.message); return; }
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

    if (error) { alert(error.message); return; }

    setNewPeriodTitle("");
    setNewPeriodType("quarterly");
    setShowCreateModal(false);
    await fetchPeriods(schoolId);
    alert("Progress report period created.");
  }

  function getClassroomName(classroomId: any) {
    return classrooms.find((c) => String(c.id) === String(classroomId))?.classroom_name || "Class not recorded";
  }

  function getLearnerName(learnerId: any) {
    return learners.find((l) => String(l.id) === String(learnerId))?.name || "Learner not recorded";
  }

  function getTeacherName(teacherId: any) {
    const t = teachers.find((t) => String(t.id) === String(teacherId));
    return t?.full_name || t?.name || t?.email || "Teacher not recorded";
  }

  function getPeriodTitle(periodId: any) {
    const p = periods.find((p) => String(p.id) === String(periodId));
    return p ? `${p.title} (${formatPeriodType(p.report_type)})` : "Period not recorded";
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
        map.get(key).count += 1;
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
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("teacher_id", item.teacher_id);

    if (error) { alert(error.message); return; }

    setReviewAssessments(data || []);

    const obs = (data || []).find((a: any) => a.teacher_comment)?.teacher_comment || "";
    setTeacherObservation(obs);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .maybeSingle();

    if (reportError) { alert(reportError.message); return; }

    setGeneratedReport(reportData);
    setPrincipalComment(reportData?.principal_comment || "");

    document
  .querySelector(".report-print-area")
  ?.scrollIntoView({ behavior: "smooth" });
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

    if (error) { alert(error.message); return; }

    setReviewAssessments(data || []);

    const obs = (data || []).find((a: any) => a.teacher_comment)?.teacher_comment || "";
    setTeacherObservation(obs);

    setGeneratedReport(item);
    setPrincipalComment(item.principal_comment || "");

    if (data && data.length > 0) {
      setSelectedTeacherId(String(data[0].teacher_id || ""));
    }

    document
  .querySelector(".report-print-area")
  ?.scrollIntoView({ behavior: "smooth" });
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

    for (const item of reviewAssessments) {
      const { error } = await supabase
        .from("learner_assessments")
        .update({
          classroom_id: Number(selectedClassroomId),
          status: "reviewed",
          teacher_comment: teacherObservation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    }

    if (schoolId) await fetchAllAssessments(schoolId);

    setSaving(false);
    alert("Principal review saved.");
  }

  async function saveChangesAndReturn() {
    if (!generatedReport?.id) return;
    setSaving(true);

    const { error } = await supabase
      .from("generated_reports")
      .update({
        principal_comment: principalComment || null,
        generated_at: new Date().toISOString(),
      })
      .eq("id", generatedReport.id);

    if (error) { alert(error.message); setSaving(false); return; }

    for (const item of reviewAssessments) {
      await supabase
        .from("learner_assessments")
        .update({ teacher_comment: teacherObservation, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }

    if (schoolId) await fetchGeneratedReports(schoolId);

    setSaving(false);
    setGeneratedReport(null);
    setReviewAssessments([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    alert("Changes saved successfully.");
  }

  async function deleteGeneratedReport(reportId: number) {
  const reason = prompt("Please provide a reason for deleting this report.");

  if (!reason || !reason.trim()) {
    alert("Deletion reason is required.");
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to permanently delete this generated report?\n\nReason: ${reason}`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("generated_reports")
    .delete()
    .eq("id", reportId);

  if (error) {
    alert(error.message);
    return;
  }

  try {
  await supabase.from("report_deletion_logs").insert([
    {
      report_id: reportId,
      deleted_by: profile?.id,
      reason,
      deleted_at: new Date().toISOString(),
    },
  ]);
} catch (err) {
  console.warn("Deletion log table missing or insert failed.");
}

  if (schoolId) {
    await fetchGeneratedReports(schoolId);
  }

  alert("Report deleted successfully.");
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

    const { data: existing } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("learner_id", selectedLearnerId)
      .eq("report_period_id", Number(selectedPeriodId))
      .maybeSingle();

    let reportError: any = null;

    if (existing?.id) {
      const { error } = await supabase
        .from("generated_reports")
        .update({
          school_id: schoolId,
          classroom_id: Number(selectedClassroomId),
          principal_id: profile.id,
          principal_comment: principalComment || null,
          report_status: "generated",
          locked: true,
          generated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      reportError = error;
    } else {
      const { error } = await supabase
        .from("generated_reports")
        .insert([{
          school_id: schoolId,
          classroom_id: Number(selectedClassroomId),
          learner_id: selectedLearnerId,
          report_period_id: Number(selectedPeriodId),
          principal_id: profile.id,
          principal_comment: principalComment || null,
          report_status: "generated",
          locked: true,
          generated_at: new Date().toISOString(),
        }]);
      reportError = error;
    }

    if (reportError) { alert(reportError.message); setSaving(false); return; }

    for (const item of reviewAssessments) {
      const { error } = await supabase
        .from("learner_assessments")
        .update({
          classroom_id: Number(selectedClassroomId),
          status: "locked",
          teacher_comment: teacherObservation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) { alert(error.message); setSaving(false); return; }
    }

    if (schoolId) {
      await fetchAllAssessments(schoolId);
      await fetchGeneratedReports(schoolId);
    }

    setSaving(false);
    alert("Official progress report generated and locked.");
  }

  async function downloadPDF() {
  const reportElement = document.querySelector(".report-print-area") as HTMLElement;

  if (!reportElement) {
    alert("Report not found.");
    return;
  }

  try {
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();

    if (pdfHeight > pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pageHeight);
    } else {
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
   }

  const learnerName =
  selectedLearner?.name?.replace(/\s+/g, "_") || "Learner";

  pdf.save(`${learnerName}_Progress_Report.pdf`);
  } catch (error) {
    console.error(error);
    alert("Failed to generate PDF.");
  }
}

  const selectedClassroom = classrooms.find((c) => String(c.id) === String(selectedClassroomId));
  const selectedLearner = learners.find((l) => String(l.id) === String(selectedLearnerId));
  const selectedPeriod = periods.find((p) => String(p.id) === String(selectedPeriodId));
  const teacherName = getTeacherName(selectedTeacherId);
  const principalName = profile?.full_name || profile?.name || profile?.email || "Principal";

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {/* Page Header */}
      <div
         className="db-card db-card-lavender no-print"
       style={{
    padding: "24px",
    }}
>
        <h1 className="db-page-title">Progress Reports</h1>
        <p className="db-page-subtitle">
          Review teacher assessments, edit where needed, and generate official learner progress reports.
        </p>
        <div style={{ position: "relative", zIndex: 1 }}></div>
      </div>

      {/* ── 1. CREATE PERIOD — just a button ── */}
      <div className="no-print" style={{ marginBottom: "24px" }}>
        <button
          className="db-button-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Progress Report Period
        </button>
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div style={modalOverlay} className="no-print">
          <div style={modalBox}>
            <h3 style={{ ...sectionTitle, marginBottom: "18px" }}>New Progress Report Period</h3>

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

            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button className="db-button-primary" onClick={createReportPeriod}>
                Create Period
              </button>
              <button
                className="db-button-primary"
                style={{ background: "#aaa" }}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. FILTER — collapsible ── */}
      <div className="db-card db-card-green no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          onClick={() => setShowFilter(!showFilter)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>Filter Assessment Reports</h3>
          <span style={chevron}>{showFilter ? "−" : "+"}</span>
        </div>

        {showFilter && (
          <div style={{ marginTop: "14px" }}>
            <select
              className="db-input"
              value={selectedClassroomId}
              onChange={(e) => { setSelectedClassroomId(e.target.value); setAssessmentPage(1); setReportPage(1); }}
            >
              <option value="">All Classes</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.classroom_name}</option>
              ))}
            </select>

            <select
              className="db-input"
              value={selectedTeacherId}
              onChange={(e) => { setSelectedTeacherId(e.target.value); setAssessmentPage(1); }}
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.name || t.email}</option>
              ))}
            </select>

            <select
              className="db-input"
              value={selectedLearnerId}
              onChange={(e) => { setSelectedLearnerId(e.target.value); setAssessmentPage(1); setReportPage(1); }}
            >
              <option value="">All Learners</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <select
              className="db-input"
              value={selectedPeriodId}
              onChange={(e) => { setSelectedPeriodId(e.target.value); setAssessmentPage(1); setReportPage(1); }}
            >
              <option value="">All Report Periods</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({formatPeriodType(p.report_type)})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 3. TEACHER SUBMITTED ASSESSMENTS — collapsible, learner name only ── */}
      <div className="db-card db-card-lavender no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          onClick={() => setShowAssessments(!showAssessments)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>Teacher Submitted Assessments</h3>
          <span style={chevron}>{showAssessments ? "−" : "+"}</span>
        </div>

        {showAssessments && (
          <>
            {visibleAssessments.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>No submitted teacher assessments found.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {visibleAssessments.map((item) => {
                  const key = `${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${item.report_period_id}`;
                  const isExpanded = expandedAssessmentKey === key;

                  return (
                    <div key={key} className="db-list-card" style={{ padding: "14px 16px" }}>
                      <div
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        onClick={() => setExpandedAssessmentKey(isExpanded ? null : key)}
                      >
                        <strong>{getLearnerName(item.learner_id)}</strong>
                        <span style={{ color: "var(--db-text-soft)", fontSize: "18px" }}>{isExpanded ? "−" : "+"}</span>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "12px" }}>
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="db-button-primary"
                disabled={assessmentPage === 1}
                onClick={() => setAssessmentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="db-button-primary"
                disabled={assessmentPage * pageSize >= filteredAssessments.length}
                onClick={() => setAssessmentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 4. GENERATED REPORTS — collapsible, learner name only ── */}
      <div className="db-card db-card-yellow no-print" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          onClick={() => setShowGeneratedReports(!showGeneratedReports)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>Generated Progress Reports</h3>
          <span style={chevron}>{showGeneratedReports ? "−" : "+"}</span>
        </div>

        {showGeneratedReports && (
          <>
            {visibleReports.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>No generated progress reports yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {visibleReports.map((item) => {
                  const key = String(item.id);
                  const isExpanded = expandedReportKey === key;

                  return (
                    <div key={item.id} className="db-list-card" style={{ padding: "14px 16px" }}>
                      <div
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        onClick={() => setExpandedReportKey(isExpanded ? null : key)}
                      >
                        <strong>{getLearnerName(item.learner_id)}</strong>
                        <span style={{ color: "var(--db-text-soft)", fontSize: "18px" }}>{isExpanded ? "−" : "+"}</span>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "12px" }}>
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
                          style={{ background: "#d9534f" }}
                          onClick={() => deleteGeneratedReport(item.id)}
                          >
                          Delete Report
                         </button>

                            <button
                              className="db-button-primary"
                              onClick={async () => {
                                await openGeneratedReport(item);
                                setTimeout(() => downloadPDF(), 300);
                              }}
                            >
                              Download / Print
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="db-button-primary"
                disabled={reportPage === 1}
                onClick={() => setReportPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="db-button-primary"
                disabled={reportPage * pageSize >= filteredReports.length}
                onClick={() => setReportPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 5. REPORT REVIEW / PRINT AREA ── */}
      {selectedClassroom && selectedLearner && selectedPeriod && reviewAssessments.length > 0 && (
        <div
  className="db-card db-card-lavender report-print-area"
  style={{
    padding: "24px",
    position: "relative",
    overflow: "hidden",
  }}
>
  {school?.logo_url && (
    <img
      src={school.logo_url}
      alt="Watermark"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "320px",
        opacity: 0.05,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  )}
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
                <p style={textStyle}>{selectedPeriod?.title || "Report Period"}</p>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <strong>{formatPeriodType(selectedPeriod.report_type)}</strong>
              <p style={textStyle}>Generated: {new Date().toLocaleDateString()}</p>
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
                </div>
              );
            })}
          </div>

          {/* Single teacher observation */}
          <div style={{ marginTop: "22px" }}>
            <h3 style={sectionTitle}>Teacher Observation</h3>

            {!generatedReport ? (
              <>
                <textarea
                  className="db-input no-print"
                  rows={4}
                  placeholder="Teacher's overall observation for this learner"
                  value={teacherObservation}
                  onChange={(e) => setTeacherObservation(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <p className="print-only" style={textStyle}>
                  {teacherObservation || "No observation added."}
                </p>
              </>
            ) : (
              <p style={textStyle}>{teacherObservation || "No observation added."}</p>
            )}
          </div>

          {/* Principal comment */}
          <div style={{ marginTop: "22px" }}>
            <h3 style={sectionTitle}>Principal Comment</h3>

            {!generatedReport ? (
              <>
                <textarea
                  className="db-input no-print"
                  rows={4}
                  placeholder="Add official principal comment"
                  value={principalComment}
                  onChange={(e) => setPrincipalComment(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <p className="print-only" style={textStyle}>
                  {principalComment || "No principal comment added."}
                </p>
              </>
            ) : (
              <p style={textStyle}>{principalComment || "No principal comment added."}</p>
            )}
          </div>

          {/* Signatures */}
          <div style={signatureRow}>
  <div style={signatureBlock}>
    <div style={signatureLine} />
    <p style={signatureLabel}>
      <strong>Teacher:</strong> {teacherName}
    </p>
    <p style={signatureLabel}>
      <strong>Date:</strong>{" "}
      {new Date().toLocaleDateString()}
    </p>
  </div>

  <div style={signatureBlock}>
    <div style={signatureLine} />
    <p style={signatureLabel}>
      <strong>Principal:</strong> {principalName}
    </p>
    <p style={signatureLabel}>
      <strong>Date:</strong>{" "}
      {new Date().toLocaleDateString()}
    </p>
  </div>
</div>

<p
  style={{
    marginTop: "28px",
    fontSize: "12px",
    color: "#777",
    textAlign: "center",
  }}
>
  Generated securely by DailyBloom
</p>

<div
  className="no-print"
  style={{
    display: "flex",
    gap: "12px",
    marginTop: "20px",
    flexWrap: "wrap",
  }}
>
  <button
    className="db-button-primary"
    style={{ background: "#777" }}
    onClick={() => {
      setGeneratedReport(null);
      setReviewAssessments([]);
      setPrincipalComment("");
      setTeacherObservation("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
  >
    Back
  </button>

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

       {generatedReport && (
       <button
         className="db-button-primary"
         onClick={saveChangesAndReturn}
         disabled={saving}
        >
        {saving ? "Saving…" : "Save Changes"}
        </button>
        )}

        <button
          className="db-button-primary"
          onClick={downloadPDF}
          >
          Download / Print Report
         </button>
        </div>
        </div>
      )}

  <style jsx global>{`
  .print-only {
    display: none;
  }

  @media print {
    body {
      background: white !important;
    }

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
      margin: 0;
      padding: 24px;
      box-shadow: none !important;
      border-radius: 0 !important;
      background: white !important;
    }

    .no-print {
      display: none !important;
    }

    .print-only {
      display: block !important;
    }
  }
`}</style>
    </div>
  );
}

/* ─── Styles ─── */

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

const collapsibleHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
};

const chevron: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "var(--db-text-soft)",
  lineHeight: 1,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  background: "#fff",
  borderRadius: "20px",
  padding: "28px 24px",
  width: "100%",
  maxWidth: "420px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
};

const reportHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "1px solid #ddd",
  paddingBottom: "16px",
  marginBottom: "18px",
};

const learnerCard: React.CSSProperties = {
  padding: "16px",
  borderRadius: "18px",
  background: "#fff",
  marginBottom: "18px",
};

const signatureRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "40px",
  marginTop: "24px",
  paddingTop: "16px",
  borderTop: "1px solid #eee",
};

const signatureBlock: React.CSSProperties = {
  flex: 1,
};

const signatureLine: React.CSSProperties = {
  borderBottom: "1.5px solid #333",
  marginBottom: "6px",
  height: "32px",
};

const signatureLabel: React.CSSProperties = {
  margin: "2px 0",
  fontSize: "11px",
  color: "#555",
};
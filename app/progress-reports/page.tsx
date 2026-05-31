"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { reportCategories } from "../lib/report-categories";
import {
  gradeRRCategories,
  gradeRRRatingScale,
} from "../lib/grade-rr-categories";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const reportLevels = ["NP", "PA", "A", "G", "VG"];

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

  const [reportType, setReportType] = useState<"developmental" | "grade-rr">(
    "developmental"
  );

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [reviewAssessments, setReviewAssessments] = useState<any[]>([]);
  const [principalComment, setPrincipalComment] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState("quarterly");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showFilter, setShowFilter] = useState(false);
  const [showAssessments, setShowAssessments] = useState(true);
  const [showGeneratedReports, setShowGeneratedReports] = useState(true);

  const [expandedAssessmentKey, setExpandedAssessmentKey] = useState<
    string | null
  >(null);
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(
    null
  );

  const [assessmentPage, setAssessmentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);

  const [teacherObservation, setTeacherObservation] = useState("");
  const [pendingDownload, setPendingDownload] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pageSize = 5;

  const activeCategories = useMemo(() => {
    return reportType === "grade-rr" ? gradeRRCategories : reportCategories;
  }, [reportType]);

  const activeRatingScale = useMemo(() => {
    return reportType === "grade-rr" ? gradeRRRatingScale : reportLevels;
  }, [reportType]);

  const reportTitle =
    reportType === "grade-rr"
      ? "Grade RR Progress Report"
      : "Developmental Progress Report";

  const reportTitleUpper =
    reportType === "grade-rr"
      ? "GRADE RR PROGRESS REPORT"
      : "DEVELOPMENTAL PROGRESS REPORT";

  const firstPageCategories =
    reportType === "grade-rr"
      ? activeCategories.slice(0, 2)
      : activeCategories.slice(0, 3);

  const secondPageCategories =
    reportType === "grade-rr"
      ? activeCategories.slice(2)
      : activeCategories.slice(3);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!pendingDownload || !generatedReport || reviewAssessments.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(async () => {
      await downloadPDF();
      setPendingDownload(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingDownload, generatedReport, reviewAssessments.length]);

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

    if (profile.role === "master" && !profile.school_id) {
      router.push("/master?view=manage-schools");
      return;
    }

    if (!profile.school_id) {
      alert("No school linked to this account.");
      router.push("/dashboard");
      return;
    }

    const currentSchoolId = Number(profile.school_id);

    if (!Number.isFinite(currentSchoolId) || currentSchoolId <= 0) {
      alert("Invalid school linked to this account.");
      router.push("/dashboard");
      return;
    }

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
      .or("is_deleted.is.null,is_deleted.eq.false")
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
    if (type === "quarterly") return "Term Report";
    if (type === "biannual") return "Semester Report";
    if (type === "annual") return "Annual Report";
    return type || "Report";
  }

  async function createReportPeriod() {
    if (!schoolId || !newPeriodTitle.trim()) {
      alert("Please enter a progress report period title.");
      return;
    }

    const { error } = await supabase.from("report_periods").insert([
      {
        school_id: schoolId,
        title: newPeriodTitle.trim(),
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
    setShowCreateModal(false);
    await fetchPeriods(schoolId);

    alert("Progress report period created.");
  }

  function getClassroomName(classroomId: any) {
    return (
      classrooms.find((c) => String(c.id) === String(classroomId))
        ?.classroom_name || "Class not recorded"
    );
  }

  function getLearnerName(learnerId: any) {
    return (
      learners.find((l) => String(l.id) === String(learnerId))?.name ||
      "Learner not recorded"
    );
  }

  function getTeacherName(teacherId: any) {
    const teacher = teachers.find((t) => String(t.id) === String(teacherId));

    return (
      teacher?.full_name ||
      teacher?.name ||
      teacher?.email ||
      "Practitioner not recorded"
    );
  }

  function getPeriodTitle(periodId: any) {
    const period = periods.find((p) => String(p.id) === String(periodId));

    return period
      ? `${period.title} (${formatPeriodType(period.report_type)})`
      : "Period not recorded";
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
    if (
      selectedClassroomId &&
      String(item.classroom_id) !== String(selectedClassroomId)
    ) {
      return false;
    }

    if (
      selectedTeacherId &&
      String(item.teacher_id) !== String(selectedTeacherId)
    ) {
      return false;
    }

    if (
      selectedLearnerId &&
      String(item.learner_id) !== String(selectedLearnerId)
    ) {
      return false;
    }

    if (
      selectedPeriodId &&
      String(item.report_period_id) !== String(selectedPeriodId)
    ) {
      return false;
    }

    return true;
  });

  const filteredReports = generatedReports.filter((item) => {
    const savedReportType = item.report_type || "developmental";

    if (savedReportType !== reportType) {
      return false;
    }

    if (
      selectedClassroomId &&
      String(item.classroom_id) !== String(selectedClassroomId)
    ) {
      return false;
    }

    if (
      selectedLearnerId &&
      String(item.learner_id) !== String(selectedLearnerId)
    ) {
      return false;
    }

    if (
      selectedPeriodId &&
      String(item.report_period_id) !== String(selectedPeriodId)
    ) {
      return false;
    }

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

    if (error) {
      alert(error.message);
      return;
    }

    setReviewAssessments(data || []);

    const observation =
      (data || []).find((assessment: any) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("report_type", reportType)
      .maybeSingle();

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setGeneratedReport(reportData);
    setPrincipalComment(reportData?.principal_comment || "");
    setOpeningDate(reportData?.opening_date || "");
    setClosingDate(reportData?.closing_date || "");

    window.requestAnimationFrame(() => {
      document
        .querySelector(".report-print-area")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function openGeneratedReport(item: any) {
    const savedReportType = item.report_type || "developmental";

    setReportType(savedReportType);
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

    const observation =
      (data || []).find((assessment: any) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);
    setGeneratedReport(item);
    setPrincipalComment(item.principal_comment || "");
    setOpeningDate(item.opening_date || "");
    setClosingDate(item.closing_date || "");

    if (data && data.length > 0) {
      setSelectedTeacherId(String(data[0].teacher_id || ""));
    }

    window.requestAnimationFrame(() => {
      document
        .querySelector(".report-print-area")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function savePrincipalReview() {
    if (!reviewAssessments.length) {
      alert("No practitioner observations found for this learner.");
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

    if (schoolId) {
      await fetchAllAssessments(schoolId);
    }

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
        opening_date: openingDate || null,
        closing_date: closingDate || null,
        report_type: reportType,
        generated_at: new Date().toISOString(),
      })
      .eq("id", generatedReport.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    for (const item of reviewAssessments) {
      const { error: assessmentError } = await supabase
        .from("learner_assessments")
        .update({
          teacher_comment: teacherObservation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (assessmentError) {
        alert(assessmentError.message);
        setSaving(false);
        return;
      }
    }

    if (schoolId) {
      await fetchGeneratedReports(schoolId);
    }

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

    try {
      await supabase.from("report_deletion_logs").insert([
        {
          report_id: reportId,
          deleted_by: profile?.id,
          reason: reason.trim(),
          deleted_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.warn("Deletion log table missing or insert failed.");
    }

    const { error } = await supabase
      .from("generated_reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      alert(error.message);
      return;
    }

    if (schoolId) {
      await fetchGeneratedReports(schoolId);
    }

    alert("Report deleted successfully.");
  }

  async function generateReport() {
    if (
      !schoolId ||
      !profile?.id ||
      !selectedClassroomId ||
      !selectedLearnerId ||
      !selectedPeriodId
    ) {
      alert("Please select class, learner and report period.");
      return;
    }

    if (!reviewAssessments.length) {
      alert("No submitted observation found.");
      return;
    }

    setSaving(true);

    const { data: existing } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("learner_id", selectedLearnerId)
      .eq("report_period_id", Number(selectedPeriodId))
      .eq("report_type", reportType)
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
          opening_date: openingDate || null,
          closing_date: closingDate || null,
          report_type: reportType,
          report_status: "generated",
          locked: true,
          generated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      reportError = error;
    } else {
      const { error } = await supabase.from("generated_reports").insert([
        {
          school_id: schoolId,
          classroom_id: Number(selectedClassroomId),
          learner_id: selectedLearnerId,
          report_period_id: Number(selectedPeriodId),
          principal_id: profile.id,
          principal_comment: principalComment || null,
          opening_date: openingDate || null,
          closing_date: closingDate || null,
          report_type: reportType,
          report_status: "generated",
          locked: true,
          generated_at: new Date().toISOString(),
        },
      ]);

      reportError = error;
    }

    if (reportError) {
      alert(reportError.message);
      setSaving(false);
      return;
    }

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

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    }

    if (schoolId) {
      await fetchAllAssessments(schoolId);
      await fetchGeneratedReports(schoolId);
    }

    setSaving(false);
    alert(`Official ${reportTitle.toLowerCase()} generated and locked.`);
  }

  async function downloadPDF() {
    const reportElement = document.querySelector(
      ".report-print-area"
    ) as HTMLElement;
    const pdfButtons = document.querySelector(".pdf-hide") as HTMLElement;
    const bookletPages = Array.from(
      document.querySelectorAll(".booklet-page")
    ) as HTMLElement[];

    if (!reportElement || bookletPages.length === 0) {
      alert("Report not found.");
      return;
    }

    try {
      if (pdfButtons) {
        pdfButtons.style.display = "none";
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < bookletPages.length; index++) {
        const page = bookletPages[index];

        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgRatio = canvas.width / canvas.height;

        let renderWidth = pdfWidth;
        let renderHeight = renderWidth / imgRatio;

        if (renderHeight > pdfHeight) {
          renderHeight = pdfHeight;
          renderWidth = renderHeight * imgRatio;
        }

        const x = (pdfWidth - renderWidth) / 2;
        const y = (pdfHeight - renderHeight) / 2;

        if (index > 0) {
          pdf.addPage("a4", "landscape");
        }

        pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      }

      if (pdfButtons) {
        pdfButtons.style.display = "flex";
      }

      const learnerName =
        selectedLearner?.name?.replace(/\s+/g, "_") || "Learner";
      const fileLabel =
        reportType === "grade-rr"
          ? "Grade_RR_Progress_Report"
          : "Developmental_Progress_Report";

      pdf.save(`${learnerName}_${fileLabel}.pdf`);
    } catch (error) {
      if (pdfButtons) {
        pdfButtons.style.display = "flex";
      }

      console.error(error);
      alert("Failed to generate PDF.");
    }
  }

  const selectedClassroom = classrooms.find(
    (c) => String(c.id) === String(selectedClassroomId)
  );
  const selectedLearner = learners.find(
    (l) => String(l.id) === String(selectedLearnerId)
  );
  const selectedPeriod = periods.find(
    (p) => String(p.id) === String(selectedPeriodId)
  );
  const teacherName = getTeacherName(selectedTeacherId);

  function calculateAge(dateOfBirth?: string | null) {
    if (!dateOfBirth) return "Not added";

    const birthDate = new Date(dateOfBirth);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return `${age} ${age === 1 ? "year" : "years"}`;
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div
        className="db-card db-card-lavender no-print"
        style={{ padding: "24px" }}
      >
        <h1 className="db-page-title">Progress Reports</h1>
        <p className="db-page-subtitle">
          Review practitioner observations and generate developmental or Grade RR
          learner progress reports.
        </p>
      </div>

      <div className="no-print" style={{ marginBottom: "24px" }}>
        <button
          className="db-button-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Progress Report Period
        </button>
      </div>

      {showCreateModal && (
        <div style={modalOverlay} className="no-print">
          <div style={modalBox}>
            <h3 style={{ ...sectionTitle, marginBottom: "18px" }}>
              New Progress Report Period
            </h3>

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
              <option value="quarterly">Term Report</option>
              <option value="biannual">Semester Report</option>
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

      <div
        className="db-card db-card-green no-print"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <div onClick={() => setShowFilter(!showFilter)} style={collapsibleHeader}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Filter Reports</h3>
          <span style={chevron}>{showFilter ? "-" : "+"}</span>
        </div>

        {showFilter && (
          <div style={{ marginTop: "14px" }}>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as "developmental" | "grade-rr");
                setReportPage(1);
              }}
              className="db-input"
            >
              <option value="developmental">
                Developmental Progress Report
              </option>
              <option value="grade-rr">Grade RR Progress Report</option>
            </select>

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
              <option value="">All Practitioners / Teachers</option>
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
        )}
      </div>

      <div
        className="db-card db-card-lavender no-print"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <div
          onClick={() => setShowAssessments(!showAssessments)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            Practitioner Submitted Observations
          </h3>
          <span style={chevron}>{showAssessments ? "-" : "+"}</span>
        </div>

        {showAssessments && (
          <>
            {visibleAssessments.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>
                No submitted practitioner observations found.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {visibleAssessments.map((item) => {
                  const key = `${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${item.report_period_id}`;
                  const isExpanded = expandedAssessmentKey === key;

                  return (
                    <div
                      key={key}
                      className="db-list-card"
                      style={{ padding: "14px 16px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setExpandedAssessmentKey(isExpanded ? null : key)
                        }
                      >
                        <strong>{getLearnerName(item.learner_id)}</strong>
                        <span
                          style={{
                            color: "var(--db-text-soft)",
                            fontSize: "18px",
                          }}
                        >
                          {isExpanded ? "-" : "+"}
                        </span>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "12px" }}>
                          <p style={textStyle}>
                            Class: {getClassroomName(item.classroom_id)}
                          </p>
                          <p style={textStyle}>
                            Practitioner/Teacher:{" "}
                            {getTeacherName(item.teacher_id)}
                          </p>
                          <p style={textStyle}>
                            Period: {getPeriodTitle(item.report_period_id)}
                          </p>
                          <p style={textStyle}>Observation items: {item.count}</p>

                          <button
                            className="db-button-primary"
                            style={{ marginTop: "10px" }}
                            onClick={() => openAssessmentReview(item)}
                          >
                            Review Observations
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
          </>
        )}
      </div>

      <div
        className="db-card db-card-yellow no-print"
        style={{ padding: "20px", marginBottom: "24px" }}
      >
        <div
          onClick={() => setShowGeneratedReports(!showGeneratedReports)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            Generated Progress Reports
          </h3>
          <span style={chevron}>{showGeneratedReports ? "-" : "+"}</span>
        </div>

        {showGeneratedReports && (
          <>
            {visibleReports.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>
                No generated progress reports yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {visibleReports.map((item) => {
                  const key = String(item.id);
                  const isExpanded = expandedReportKey === key;

                  return (
                    <div
                      key={item.id}
                      className="db-list-card"
                      style={{ padding: "14px 16px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setExpandedReportKey(isExpanded ? null : key)
                        }
                      >
                        <strong>{getLearnerName(item.learner_id)}</strong>
                        <span
                          style={{
                            color: "var(--db-text-soft)",
                            fontSize: "18px",
                          }}
                        >
                          {isExpanded ? "-" : "+"}
                        </span>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "12px" }}>
                          <p style={textStyle}>
                            Type:{" "}
                            {(item.report_type || "developmental") === "grade-rr"
                              ? "Grade RR Progress Report"
                              : "Developmental Progress Report"}
                          </p>
                          <p style={textStyle}>
                            Class: {getClassroomName(item.classroom_id)}
                          </p>
                          <p style={textStyle}>
                            Period: {getPeriodTitle(item.report_period_id)}
                          </p>
                          <p style={textStyle}>
                            Generated:{" "}
                            {item.generated_at
                              ? new Date(item.generated_at).toLocaleDateString()
                              : "Not recorded"}
                          </p>

                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              flexWrap: "wrap",
                              marginTop: "10px",
                            }}
                          >
                            <button
                              className="db-button-primary"
                              onClick={() => openGeneratedReport(item)}
                            >
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
                                setPendingDownload(true);
                                await openGeneratedReport(item);
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
          </>
        )}
      </div>

      {selectedClassroom &&
        selectedLearner &&
        selectedPeriod &&
        reviewAssessments.length > 0 && (
          <div
            className="db-card db-card-lavender report-print-area"
            style={{
              padding: "24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="booklet-page">
              <div style={{ ...bookletPanel, textAlign: "center" }}>
                {school?.logo_url && (
                  <img
                    src={school.logo_url}
                    alt="School Logo"
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "contain",
                      marginBottom: "20px",
                    }}
                  />
                )}

                <h1 style={coverSchoolName}>
                  {school?.school_name || "Preschool Name"}
                </h1>

                <h2 style={coverTitle}>{reportTitleUpper}</h2>

                <p style={coverText}>{selectedClassroom.classroom_name}</p>

                <p style={coverText}>
                  <strong>EMIS / NPO Number:</strong>{" "}
                  {school?.emis_number || school?.npo_number || "Not added"}
                </p>

                <p style={coverText}>
                  <strong>Address:</strong>{" "}
                  {school?.address ||
                    school?.school_address ||
                    school?.physical_address ||
                    "Not added"}
                </p>

                <p style={coverText}>
                  <strong>Contact:</strong>{" "}
                  {school?.contact_number ||
                    school?.phone_number ||
                    school?.telephone ||
                    "Not added"}
                </p>

                <p style={{ ...coverText, marginTop: "30px" }}>
                  {selectedPeriod.title}
                </p>
              </div>

              <div style={bookletPanel}>
                <h2 style={bookletTitle}>{reportTitleUpper}</h2>

                <div style={learnerInfoBox}>
                  <p style={bookletText}>
                    <strong>Name of Child:</strong> {selectedLearner.name}
                  </p>

                  <p style={bookletText}>
                    <strong>Age:</strong>{" "}
                    {selectedLearner?.age ||
                      calculateAge(selectedLearner?.date_of_birth)}
                  </p>

                  <p style={bookletText}>
                    <strong>Date of Birth:</strong>{" "}
                    {selectedLearner.date_of_birth || "Not added"}
                  </p>

                  <p style={bookletText}>
                    <strong>Class:</strong> {selectedClassroom.classroom_name}
                  </p>

                  {reportType === "grade-rr" ? (
                    <>
                      <p style={bookletText}>
                        <strong>Opening Date:</strong>{" "}
                        {openingDate || "Not added"}
                      </p>

                      <p style={bookletText}>
                        <strong>Closing Date:</strong>{" "}
                        {closingDate || "Not added"}
                      </p>
                    </>
                  ) : null}
                </div>

                <div style={codesBox}>
                  <strong>Codes / Level of Competence</strong>
                  <br />
                  {reportType === "grade-rr"
                    ? "1 = Not Achieved | 2 = Partially Achieved | 3 = Achieved | 4 = Outstanding Achievement"
                    : "NP = Needs Practice | PA = Partially Achieved | A = Achieved | G = Good | VG = Very Good"}
                </div>

                {reportType === "grade-rr" ? (
                  <div className="no-print" style={gradeRRMetaGrid}>
                    <div>
                      <p style={labelText}>Opening Date</p>
                      <input
                        className="db-input"
                        type="date"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <p style={labelText}>Closing Date</p>
                      <input
                        className="db-input"
                        type="date"
                        value={closingDate}
                        onChange={(e) => setClosingDate(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                {firstPageCategories.map((category: any) => (
                  <React.Fragment key={category.key}>
                    <h3 style={bookletSectionTitle}>{category.label}</h3>

                    {category.description ? (
                      <p style={bookletSmallText}>{category.description}</p>
                    ) : null}

                    <ReportSkillTable
                      categoryKey={category.key}
                      categories={activeCategories}
                      ratingScale={activeRatingScale}
                      reviewAssessments={reviewAssessments}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="booklet-page">
              <div style={bookletPanel}>
                {secondPageCategories.map((category: any) => (
                  <React.Fragment key={category.key}>
                    <h3 style={bookletSectionTitle}>{category.label}</h3>

                    {category.description ? (
                      <p style={bookletSmallText}>{category.description}</p>
                    ) : null}

                    <ReportSkillTable
                      categoryKey={category.key}
                      categories={activeCategories}
                      ratingScale={activeRatingScale}
                      reviewAssessments={reviewAssessments}
                    />
                  </React.Fragment>
                ))}
              </div>

              <div style={bookletPanel}>
                <h3 style={bookletSectionTitle}>Practitioner Remarks</h3>

                <textarea
                  className="db-input no-print compact-textarea"
                  rows={3}
                  placeholder="Type practitioner remarks for this learner"
                  value={teacherObservation}
                  onChange={(e) => {
                    setTeacherObservation(e.target.value);
                    setTeacherComment(e.target.value);
                  }}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <p className="print-only" style={remarksBox}>
                  {teacherObservation ||
                    teacherComment ||
                    "No practitioner remarks added."}
                </p>

                <h3 style={bookletSectionTitle}>Principal Comments</h3>

                <textarea
                  className="db-input no-print compact-textarea"
                  rows={3}
                  placeholder="Type principal comments"
                  value={principalComment}
                  onChange={(e) => setPrincipalComment(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <p className="print-only" style={remarksBox}>
                  {principalComment || "No principal comments added."}
                </p>

                <div style={signatureGrid}>
                  <p style={bookletLine}>Teacher's Name: {teacherName}</p>
                  <p style={bookletLine}>
                    Opening Date: {openingDate || "__________________"}
                  </p>
                  <p style={bookletLine}>
                    Closing Date: {closingDate || "__________________"}
                  </p>
                  <p style={bookletLine}>Teacher's Signature: ___________</p>
                  <p style={bookletLine}>Principal's Signature: __________</p>
                </div>
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
              Generated securely by DailyBloom.{" "}
              {reportType === "grade-rr"
                ? "Aligned to Grade RR reporting domains."
                : "Aligned to the six recognised DBE National Curriculum Framework developmental and learning areas."}
            </p>

            <div
              className="no-print pdf-hide"
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
                  setTeacherComment("");
                  setOpeningDate("");
                  setClosingDate("");
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
                    Generate Official {reportTitle}
                  </button>
                </>
              )}

              {generatedReport && (
                <button
                  className="db-button-primary"
                  onClick={saveChangesAndReturn}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}

              <button className="db-button-primary" onClick={downloadPDF}>
                Download / Print {reportTitle}
              </button>

              <p
                className="no-print"
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginTop: "12px",
                  lineHeight: 1.5,
                }}
              >
                Recommended print settings: Landscape | Double-sided | Flip on
                short edge | A4
              </p>
            </div>
          </div>
        )}

      <style jsx global>{`
        .print-only {
          display: none;
        }

        .booklet-page {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8mm;
          background: #fff;
          padding: 6mm;
          margin-bottom: 18px;
          border-radius: 14px;
          box-sizing: border-box;
          min-height: 190mm;
        }

        .compact-textarea {
          min-height: 54px !important;
          font-size: 12px !important;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

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
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
          }

          .booklet-page {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6mm !important;
            page-break-after: always;
            break-after: page;
            width: 100%;
            min-height: 190mm;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }

          .booklet-page:last-of-type {
            page-break-after: auto;
            break-after: auto;
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

function ReportSkillTable({
  categoryKey,
  categories,
  ratingScale,
  reviewAssessments,
}: {
  categoryKey: string;
  categories: any[];
  ratingScale: any[];
  reviewAssessments: any[];
}) {
  const category = categories.find((item) => item.key === categoryKey);

  const indicators =
    category?.indicators ||
    category?.sections?.flatMap((section: any) => section.indicators || []) ||
    [];

  const categoryAssessments = reviewAssessments.filter(
    (item) => item.category === categoryKey
  );

  function getLevelCode(level: any) {
    if (typeof level === "string") {
      return level.includes(" - ") ? level.split(" - ")[0] : level;
    }

    return (
      level?.code ||
      level?.value ||
      level?.level ||
      level?.label ||
      String(level || "")
    );
  }

  const levels = ratingScale.map((level) => getLevelCode(level));

  function normalizeLevel(value: string) {
    if (!value) return "";

    const cleaned = String(value).trim();

    if (levels.includes(cleaned)) return cleaned;

    if (cleaned === "NP - Needs Practice") return "NP";
    if (cleaned === "PA - Partially Achieved") return "PA";
    if (cleaned === "A - Achieved") return "A";
    if (cleaned === "G - Good") return "G";
    if (cleaned === "VG - Very Good") return "VG";

    if (cleaned === "needs_practice") return "NP";
    if (cleaned === "partially_achieved") return "PA";
    if (cleaned === "achieved") return "A";
    if (cleaned === "good") return "G";
    if (cleaned === "very_good") return "VG";

    if (cleaned === "needs_support") return "NP";
    if (cleaned === "progressing") return "PA";
    if (cleaned === "meeting_expectations") return "G";
    if (cleaned === "exceeding_expectations") return "VG";

    if (cleaned === "not_achieved") return "1";
    if (cleaned === "partially_achieved_grade_rr") return "2";
    if (cleaned === "achieved_grade_rr") return "3";
    if (cleaned === "outstanding_achievement") return "4";

    if (cleaned === "1 - Not Achieved") return "1";
    if (cleaned === "2 - Partially Achieved") return "2";
    if (cleaned === "3 - Achieved") return "3";
    if (cleaned === "4 - Outstanding Achievement") return "4";

    return "";
  }

  function getIndicatorLevel(indicator: any) {
    const assessment = categoryAssessments.find(
      (item) =>
        item.indicator_key === indicator.key ||
        item.indicator_label === indicator.label
    );

    return normalizeLevel(assessment?.level || "");
  }

  if (indicators.length === 0) {
    return (
      <div
        style={{
          padding: "8px",
          border: "1px solid #ddd",
          fontSize: "8px",
          color: "#555",
          marginBottom: "4px",
        }}
      >
        No assessment indicators configured.
      </div>
    );
  }

  return (
    <table style={skillTable}>
      <thead>
        <tr>
          <th style={skillHeader}>Assessment Indicator</th>

          {levels.map((level) => (
            <th key={level} style={levelHeader}>
              {level}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {indicators.map((indicator: any) => {
          const selectedLevel = getIndicatorLevel(indicator);

          return (
            <tr key={`${categoryKey}-${indicator.key}`}>
              <td style={skillCell}>{indicator.label}</td>

              {levels.map((level) => (
                <td key={level} style={tickCell}>
                  {selectedLevel === level ? "✓" : ""}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
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

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
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

const bookletPanel: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8d8d8",
  padding: "9px",
  minHeight: "178mm",
  boxSizing: "border-box",
  overflow: "hidden",
};

const bookletTitle: React.CSSProperties = {
  textAlign: "center",
  fontSize: "15px",
  margin: "0 0 6px",
  color: "#222",
};

const bookletSectionTitle: React.CSSProperties = {
  fontSize: "9.5px",
  fontWeight: 800,
  textTransform: "uppercase",
  margin: "7px 0 4px",
  background: "#f3f3f3",
  padding: "3px 5px",
  border: "1px solid #ddd",
};

const bookletText: React.CSSProperties = {
  fontSize: "9.5px",
  margin: "3px 0",
  color: "#333",
};

const remarksBox: React.CSSProperties = {
  minHeight: "34px",
  border: "1px solid #ddd",
  padding: "5px",
  margin: "4px 0 6px",
  fontSize: "9px",
  color: "#333",
  lineHeight: 1.25,
  background: "#fafafa",
};

const bookletSmallText: React.CSSProperties = {
  fontSize: "8px",
  margin: "2px 0 4px",
  color: "#555",
  lineHeight: 1.2,
};

const bookletLine: React.CSSProperties = {
  fontSize: "9px",
  margin: "5px 0",
  color: "#333",
};

const skillTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "7.6px",
  marginBottom: "4px",
};

const skillHeader: React.CSSProperties = {
  border: "1px solid #888",
  padding: "2px 3px",
  textAlign: "left",
  background: "#f7f7f7",
};

const levelHeader: React.CSSProperties = {
  border: "1px solid #888",
  padding: "2px",
  textAlign: "center",
  width: "18px",
  background: "#f7f7f7",
};

const skillCell: React.CSSProperties = {
  border: "1px solid #888",
  padding: "2px 3px",
  verticalAlign: "top",
  lineHeight: 1.15,
};

const tickCell: React.CSSProperties = {
  border: "1px solid #888",
  padding: "2px",
  textAlign: "center",
  fontWeight: 800,
  lineHeight: 1,
};

const signatureGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "4px 10px",
  marginTop: "8px",
};

const coverSchoolName: React.CSSProperties = {
  fontSize: "22px",
  marginTop: "14px",
  marginBottom: "14px",
  color: "#222",
};

const coverTitle: React.CSSProperties = {
  fontSize: "19px",
  margin: "16px 0",
  color: "#4f6fbd",
};

const coverText: React.CSSProperties = {
  fontSize: "11px",
  margin: "7px 0",
  color: "#333",
  lineHeight: 1.35,
};

const learnerInfoBox: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2px 8px",
  border: "1px solid #ddd",
  padding: "6px",
  marginBottom: "6px",
  background: "#fafafa",
};

const codesBox: React.CSSProperties = {
  fontSize: "8.5px",
  lineHeight: 1.25,
  padding: "5px",
  border: "1px solid #ddd",
  margin: "5px 0",
  background: "#fafafa",
};

const gradeRRMetaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  margin: "8px 0",
};
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

const certificateTypes = [
  "Certificate of Achievement",
  "Certificate of Participation",
  "Certificate of Excellence",
  "Certificate of Good Progress",
];

const certificateReasonOptions: Record<string, string[]> = {
  "Certificate of Achievement": [
    "Having achieved above average",
    "Outstanding academic achievement",
    "Excellent classroom performance",
    "Consistent hard work and dedication",
  ],
  "Certificate of Participation": [
    "Active participation in class activities",
    "Positive participation and teamwork",
    "Enthusiastic involvement in school activities",
    "Taking part with confidence and effort",
  ],
  "Certificate of Excellence": [
    "Excellent achievement and effort",
    "Outstanding excellence in learning",
    "Exceptional progress and dedication",
    "Excellent behaviour and leadership",
  ],
  "Certificate of Good Progress": [
    "Good progress throughout the year",
    "Steady improvement and commitment",
    "Growing confidence and effort",
    "Positive progress in learning",
  ],
};

const teacherAssessmentStatusFilters = [
  "draft",
  "submitted",
  "reviewed",
  "locked",
  "generated",
];

const principalAssessmentStatusFilters = [
  "submitted",
  "reviewed",
  "locked",
  "generated",
];

function getAssessmentValue(assessment: any) {
  return (
    assessment?.level ||
    assessment?.rating ||
    assessment?.assessment_level ||
    assessment?.selected_level ||
    assessment?.selected_rating ||
    assessment?.value ||
    ""
  );
}

function getCategoryIndicators(category: any) {
  return (
    category?.indicators ||
    category?.sections?.flatMap((section: any) => section.indicators || []) ||
    []
  );
}

function getAssessmentTimestamp(assessment: any) {
  const value = assessment?.updated_at || assessment?.created_at || "";
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeLatestAssessments(assessments: any[]) {
  const latestByIndicator = new Map<string, any>();

  assessments.forEach((assessment) => {
    const key = [
      assessment.category || "",
      assessment.indicator_key || assessment.indicator_label || "",
    ].join("::");

    const current = latestByIndicator.get(key);
    const assessmentHasValue = Boolean(getAssessmentValue(assessment));
    const currentHasValue = Boolean(getAssessmentValue(current));

    if (
      !current ||
      (assessmentHasValue && !currentHasValue) ||
      getAssessmentTimestamp(assessment) >= getAssessmentTimestamp(current)
    ) {
      latestByIndicator.set(key, assessment);
    }
  });

  return Array.from(latestByIndicator.values());
}

function makeAssessmentKey(categoryKey: string, indicatorKey: string) {
  return `${categoryKey}::${indicatorKey}`;
}

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
  const [newReportTemplate, setNewReportTemplate] = useState<
    "developmental" | "grade-rr"
  >("developmental");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showFilter, setShowFilter] = useState(false);
  const [showPeriodManagement, setShowPeriodManagement] = useState(false);
  const [showTeacherChecklist, setShowTeacherChecklist] = useState(false);
  const [showAssessments, setShowAssessments] = useState(false);
  const [showGeneratedReports, setShowGeneratedReports] = useState(false);

  const [expandedAssessmentKey, setExpandedAssessmentKey] = useState<
    string | null
  >(null);
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(
    null
  );

  const [assessmentPage, setAssessmentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [awardPage, setAwardPage] = useState(1);

  const [teacherObservation, setTeacherObservation] = useState("");
  const [teacherRatings, setTeacherRatings] = useState<Record<string, string>>(
    {}
  );
  const [pendingDownload, setPendingDownload] = useState(false);

  const [showAwards, setShowAwards] = useState(false);
  const [awards, setAwards] = useState<any[]>([]);

  const [selectedAwardLearnerId, setSelectedAwardLearnerId] = useState("");
  const [selectedAwardClassroomId, setSelectedAwardClassroomId] = useState("");
  const [selectedAwardTeacherId, setSelectedAwardTeacherId] = useState("");
  const [selectedAwardPeriodId, setSelectedAwardPeriodId] = useState("");
  const [selectedAwardType, setSelectedAwardType] = useState("");
  const [awardReason, setAwardReason] = useState("");
  const [selectedAward, setSelectedAward] = useState<any>(null);
  const [pendingAwardDownload, setPendingAwardDownload] = useState(false);

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

  useEffect(() => {
    if (!pendingAwardDownload || !selectedAward) return;

    const frame = window.requestAnimationFrame(async () => {
      await downloadAwardCertificate();
      setPendingAwardDownload(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingAwardDownload, selectedAward]);

  useEffect(() => {
    if (!profile || profile.role !== "teacher") {
      return;
    }

    fetchTeacherSavedRatings();
  }, [profile, selectedLearnerId, selectedPeriodId, reportType]);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (
      profile.role !== "principal" &&
      profile.role !== "master" &&
      profile.role !== "teacher"
    ) {
      router.push("/dashboard");
      return;
    }

    if (profile.role === "master" && !profile.school_id) {
      router.push("/master?view=manage-schools");
      return;
    }

    if (!profile.school_id) {
      alert("No school linked to this account.");
      router.push(profile.role === "teacher" ? "/teacher" : "/dashboard");
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

    if (profile.role === "teacher") {
      setSelectedTeacherId(String(profile.id || ""));

      if (profile.classroom_id) {
        setSelectedClassroomId(String(profile.classroom_id));
      }
    }

    await fetchSchool(currentSchoolId);
    await fetchClassrooms(currentSchoolId);
    await fetchTeachers(currentSchoolId);
    await fetchLearners(currentSchoolId);
    await fetchPeriods(currentSchoolId);
    await fetchAllAssessments(currentSchoolId);
    await fetchGeneratedReports(currentSchoolId);

    if (profile.role !== "teacher") {
      await fetchAwards(currentSchoolId);
    }

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
      .order("created_at", { ascending: false });

    if (error) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_school_teachers_for_attendance"
      );

      if (rpcError) {
        alert(error.message);
        return;
      }

      setTeachers(rpcData || []);
      return;
    }

    const teacherRows = (data || []).filter((item: any) => {
      const role = String(item.role || "").toLowerCase();

      return (
        role.includes("teacher") ||
        role.includes("practitioner") ||
        role.includes("educator") ||
        item.classroom_id ||
        item.assigned_classroom_id ||
        item.classroom ||
        item.classroom_name ||
        item.assigned_classroom ||
        item.assigned_classroom_name
      );
    });

    if (teacherRows.length > 0) {
      setTeachers(teacherRows);
      return;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_school_teachers_for_attendance"
    );

    if (rpcError) {
      setTeachers(data || []);
      return;
    }

    setTeachers(rpcData || []);
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
      .in("status", principalAssessmentStatusFilters)
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

  async function fetchAwards(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("achievement_awards")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setAwards((data || []).filter((award: any) => !award.deleted_at));
  }

  async function deleteCertificate(award: any) {
    if (!schoolId || !award?.id) return;

    const reason = prompt("Please provide a reason for deleting this certificate.");

    if (!reason || !reason.trim()) {
      alert("Deletion reason is required.");
      return;
    }

    const confirmed = confirm(
      `Delete certificate for ${getLearnerName(award.learner_id)}?`
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("achievement_awards")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profile?.id || null,
        delete_reason: reason.trim(),
      })
      .eq("id", award.id)
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    if (selectedAward?.id === award.id) {
      setSelectedAward(null);
    }

    await fetchAwards(schoolId);
    setSaving(false);
    alert("Certificate deleted.");
  }

  function formatPeriodType(type: string) {
    if (type === "quarterly") return "Term Report";
    if (type === "biannual") return "Semester Report";
    if (type === "annual") return "Annual Report";
    return type || "Report";
  }

  function formatReportTemplate(template: string) {
    if (template === "grade-rr") return "Grade RR Progress Report";
    return "Developmental Progress Report";
  }

  function periodStatusStyle(status: string) {
    if (status === "open") return pillGreen;
    if (status === "closed") return pillOrange;
    return pillGrey;
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
        report_template: newReportTemplate,
        status: "open",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setNewPeriodTitle("");
    setNewPeriodType("quarterly");
    setNewReportTemplate("developmental");
    setShowCreateModal(false);
    await fetchPeriods(schoolId);

    alert("Progress report period created.");
  }

  async function fetchTeacherSavedRatings() {
    if (
      !schoolId ||
      !profile?.id ||
      profile.role !== "teacher" ||
      !selectedLearnerId ||
      !selectedPeriodId
    ) {
      setTeacherRatings({});
      setTeacherObservation("");
      setTeacherComment("");
      return;
    }

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", schoolId)
      .eq("teacher_id", profile.id)
      .eq("learner_id", selectedLearnerId)
      .eq("report_period_id", Number(selectedPeriodId))
      .eq("report_type", reportType)
      .in("status", teacherAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const latestAssessments = normalizeLatestAssessments(data || []);
    const nextRatings: Record<string, string> = {};

    latestAssessments.forEach((assessment) => {
      const indicatorKey =
        assessment.indicator_key || assessment.indicator_label || "";

      if (!assessment.category || !indicatorKey) {
        return;
      }

      nextRatings[makeAssessmentKey(assessment.category, indicatorKey)] =
        getAssessmentValue(assessment);
    });

    const observation =
      latestAssessments.find((assessment: any) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherRatings(nextRatings);
    setTeacherObservation(observation);
    setTeacherComment(observation);
  }

  function handleTeacherRatingChange(
    categoryKey: string,
    indicatorKey: string,
    level: string
  ) {
    setTeacherRatings((current) => ({
      ...current,
      [makeAssessmentKey(categoryKey, indicatorKey)]: level,
    }));
  }

  async function saveTeacherChecklist(status: "draft" | "submitted") {
    const selectedLearnerForSave = learners.find(
      (learner) => String(learner.id) === String(selectedLearnerId)
    );
    const effectiveClassroomId =
      selectedClassroomId ||
      getLearnerClassroomId(selectedLearnerForSave) ||
      (isTeacher ? teacherClassroomIds[0] || "" : "");

    if (
      !schoolId ||
      !profile?.id ||
      !effectiveClassroomId ||
      !selectedLearnerId ||
      !selectedPeriodId
    ) {
      alert(
        isTeacher
          ? "Please select learner and term/report period. If this continues, check that the learner is linked to your class."
          : "Please select class, learner and report period."
      );
      return;
    }

    const selectedRows = activeCategories.flatMap((category: any) => {
      return getCategoryIndicators(category)
        .map((indicator: any) => {
          const indicatorKey = indicator.key || indicator.label;
          const level =
            teacherRatings[makeAssessmentKey(category.key, indicatorKey)];

          if (!level) {
            return null;
          }

          return {
            category,
            indicator,
            indicatorKey,
            level,
          };
        })
        .filter(Boolean);
    });

    if (selectedRows.length === 0) {
      alert("Please select at least one checklist rating.");
      return;
    }

    setSaving(true);

    for (const row of selectedRows as any[]) {
      const { data: existingFull, error: existingFullError } = await supabase
        .from("learner_assessments")
        .select("id, status")
        .eq("school_id", schoolId)
        .eq("classroom_id", Number(effectiveClassroomId))
        .eq("teacher_id", profile.id)
        .eq("learner_id", selectedLearnerId)
        .eq("report_period_id", Number(selectedPeriodId))
        .eq("report_type", reportType)
        .eq("category", row.category.key)
        .eq("indicator_key", row.indicatorKey)
        .maybeSingle();

      if (existingFullError) {
        alert(existingFullError.message);
        setSaving(false);
        return;
      }

      if (
        existingFull?.status === "reviewed" ||
        existingFull?.status === "locked" ||
        existingFull?.status === "generated"
      ) {
        alert(
          "This checklist has already been reviewed or locked and cannot be edited."
        );
        setSaving(false);
        return;
      }

      const payload = {
        school_id: schoolId,
        classroom_id: Number(effectiveClassroomId),
        teacher_id: profile.id,
        learner_id: selectedLearnerId,
        report_period_id: Number(selectedPeriodId),
        report_type: reportType,
        category: row.category.key,
        indicator_key: row.indicatorKey,
        indicator_label: row.indicator.label || row.indicatorKey,
        level: row.level,
        rating: row.level,
        teacher_comment: teacherObservation || null,
        status,
        updated_at: new Date().toISOString(),
      };

      const { error } = existingFull?.id
        ? await supabase
            .from("learner_assessments")
            .update(payload)
            .eq("id", existingFull.id)
        : await supabase.from("learner_assessments").insert([payload]);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    }

    await fetchTeacherSavedRatings();

    if (schoolId) {
      await fetchAllAssessments(schoolId);
    }

    setSaving(false);
    alert(
      status === "submitted"
        ? "Checklist submitted to principal."
        : "Checklist draft saved."
    );
  }

  async function updatePeriodStatus(
    periodId: number,
    status: "open" | "closed" | "archived"
  ) {
    const { error } = await supabase
      .from("report_periods")
      .update({ status })
      .eq("id", periodId);

    if (error) {
      alert(error.message);
      return;
    }

    if (schoolId) {
      await fetchPeriods(schoolId);
    }
  }

  async function createAward() {
    if (
      !schoolId ||
      !selectedAwardLearnerId ||
      !selectedAwardTeacherId ||
      !selectedAwardPeriodId ||
      !selectedAwardType ||
      !awardReason
    ) {
      alert("Please complete all certificate fields.");
      return;
    }

    const selectedTeacherName = selectedAwardTeacherId
      ? getTeacherName(selectedAwardTeacherId)
      : "";
    const awardTeacherName =
      selectedTeacherName &&
      selectedTeacherName !== "Practitioner not recorded"
        ? selectedTeacherName
        : getAwardTeacherName(selectedAwardLearnerId);

    setSaving(true);

    const { data: existingAward, error: existingAwardError } = await supabase
      .from("achievement_awards")
      .select("id")
      .eq("learner_id", selectedAwardLearnerId)
      .eq("report_period_id", selectedAwardPeriodId)
      .eq("award_name", selectedAwardType)
      .maybeSingle();

    if (existingAwardError) {
      alert(existingAwardError.message);
      setSaving(false);
      return;
    }

    if (existingAward) {
      alert("This certificate has already been issued.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("achievement_awards").insert([
      {
        school_id: schoolId,
        learner_id: selectedAwardLearnerId,
        classroom_id: selectedAwardClassroomId || null,
        teacher_id: selectedAwardTeacherId || null,
        report_period_id: selectedAwardPeriodId,
        award_name: selectedAwardType,
        award_reason: awardReason || null,
        teacher_name: awardTeacherName,
        principal_name: profile?.full_name || profile?.name || "Principal",
        award_year: new Date().getFullYear(),
        certificate_generated: true,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSelectedAwardLearnerId("");
    setSelectedAwardClassroomId("");
    setSelectedAwardTeacherId("");
    setSelectedAwardPeriodId("");
    setSelectedAwardType("");
    setAwardReason("");

    await fetchAwards(schoolId);
    setAwardPage(1);

    setSaving(false);
    alert("Certificate created.");
  }

  function getClassroomName(classroomId: any) {
    return (
      classrooms.find((c) => String(c.id) === String(classroomId))
        ?.classroom_name || "Class not recorded"
    );
  }

  function getLearnerName(learnerId: any) {
    const learner = learners.find((l) => String(l.id) === String(learnerId));

    return learner?.legal_name || learner?.name || "Learner not recorded";
  }

  function getAwardTeacherName(learnerId: any, award?: any) {
    if (
      award?.teacher_name &&
      award.teacher_name !== "Practitioner not recorded"
    ) {
      return award.teacher_name;
    }

    if (award?.teacher_id) {
      const teacherName = getTeacherName(award.teacher_id);

      if (teacherName !== "Practitioner not recorded") {
        return teacherName;
      }
    }

    const learner = learners.find((l) => String(l.id) === String(learnerId));

    const classroomId = award?.classroom_id
      ? String(award.classroom_id)
      : getLearnerClassroomId(learner);

    if (!classroomId) {
      return "Practitioner not recorded";
    }

    const classroom = classrooms.find(
      (c) => String(c.id) === String(classroomId)
    );

    if (classroom?.teacher_id) {
      return getTeacherName(classroom.teacher_id);
    }

    const teacherId = getClassroomTeacherId(classroomId);

    if (teacherId) {
      return getTeacherName(teacherId);
    }

    if (classroom?.teacher_name) {
      return classroom.teacher_name;
    }

    return "Practitioner not recorded";
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

  function getLearnerClassroomId(learner: any) {
    if (!learner) return "";

    if (learner.classroom_id) {
      return String(learner.classroom_id);
    }

    const learnerClassNames = [
      learner.class,
      learner.classroom,
      learner.classroom_name,
      learner.class_name,
      learner.assigned_classroom,
      learner.assigned_classroom_name,
    ]
      .filter(Boolean)
      .map((item: any) => String(item).trim().toLowerCase());

    const classroom = classrooms.find(
      (item) =>
        learnerClassNames.includes(
          String(item.classroom_name || "").trim().toLowerCase()
        ) ||
        learnerClassNames.includes(String(item.id || "").trim().toLowerCase())
    );

    return classroom ? String(classroom.id) : "";
  }

  function getClassroomTeacherId(classroomId: any) {
    if (!classroomId) return "";

    const classroom = classrooms.find(
      (item) => String(item.id) === String(classroomId)
    );

    if (classroom?.teacher_id) {
      return String(classroom.teacher_id);
    }

    const teacher = teachers.find(
      (item) =>
        String(item.classroom_id) === String(classroomId) ||
        String(item.assigned_classroom_id) === String(classroomId) ||
        String(item.classroom) === String(classroom?.classroom_name) ||
        String(item.classroom_name) === String(classroom?.classroom_name) ||
        String(item.class) === String(classroom?.classroom_name) ||
        String(item.assigned_classroom) === String(classroom?.classroom_name) ||
        String(item.assigned_classroom_name) ===
          String(classroom?.classroom_name)
    );

    return teacher ? String(teacher.id) : "";
  }

  function getTeacherClassroomIds() {
    if (!profile) return [];

    const classroomIds = new Set<string>();
    const teacherId = String(profile.id || "");
    const teacherEmail = String(profile.email || "").toLowerCase();
    const teacherNames = [
      profile.full_name,
      profile.name,
      profile.teacher_name,
      profile.display_name,
    ]
      .filter(Boolean)
      .map((item: any) => String(item).trim().toLowerCase());

    if (profile.classroom_id) {
      classroomIds.add(String(profile.classroom_id));
    }

    if (profile.assigned_classroom_id) {
      classroomIds.add(String(profile.assigned_classroom_id));
    }

    const profileClassNames = [
      profile.classroom,
      profile.classroom_name,
      profile.assigned_classroom,
      profile.assigned_classroom_name,
      profile.class,
    ]
      .filter(Boolean)
      .map((item: any) => String(item).trim().toLowerCase());

    classrooms.forEach((classroom) => {
      const classroomId = String(classroom.id || "");
      const classroomName = String(classroom.classroom_name || "")
        .trim()
        .toLowerCase();
      const classroomTeacherName = String(classroom.teacher_name || "")
        .trim()
        .toLowerCase();
      const classroomTeacherEmail = String(classroom.teacher_email || "")
        .trim()
        .toLowerCase();

      if (!classroomId) return;

      if (
        String(classroom.teacher_id || "") === teacherId ||
        String(classroom.practitioner_id || "") === teacherId ||
        (teacherEmail && classroomTeacherEmail === teacherEmail) ||
        (classroomTeacherName &&
          teacherNames.some((teacherName) => teacherName === classroomTeacherName)) ||
        (classroomName &&
          profileClassNames.some(
            (profileClassName) => profileClassName === classroomName
          ))
      ) {
        classroomIds.add(classroomId);
      }
    });

    return Array.from(classroomIds);
  }

  function handleAwardLearnerChange(learnerId: string) {
    setSelectedAwardLearnerId(learnerId);

    if (!learnerId) {
      setSelectedAwardClassroomId("");
      setSelectedAwardTeacherId("");
      return;
    }

    const learner = learners.find(
      (item) => String(item.id) === String(learnerId)
    );

    const classroomId = getLearnerClassroomId(learner);
    const teacherId = getClassroomTeacherId(classroomId);

    setSelectedAwardClassroomId(classroomId);
    setSelectedAwardTeacherId(teacherId);
  }

  function getPeriodTitle(periodId: any) {
    const period = periods.find((p) => String(p.id) === String(periodId));

    return period
      ? `${period.title} (${formatPeriodType(
          period.report_type
        )} - ${formatReportTemplate(
          period.report_template || "developmental"
        )})`
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

  const uniqueAwards = useMemo<any[]>(() => {
    const map = new Map<string, any>();

    awards.forEach((award: any) => {
      const key = `${award.learner_id || ""}-${
        award.report_period_id || ""
      }-${award.award_name || ""}`;

      if (!map.has(key)) {
        map.set(key, award);
      }
    });

    return Array.from(map.values());
  }, [awards]);

  const filteredAwards = uniqueAwards.filter((award) => {
    if (
      selectedClassroomId &&
      String(award.classroom_id) !== String(selectedClassroomId)
    ) {
      return false;
    }

    if (
      selectedLearnerId &&
      String(award.learner_id) !== String(selectedLearnerId)
    ) {
      return false;
    }

    if (
      selectedPeriodId &&
      String(award.report_period_id) !== String(selectedPeriodId)
    ) {
      return false;
    }

    return true;
  });

  const visibleAwards = filteredAwards.slice(
    (awardPage - 1) * pageSize,
    awardPage * pageSize
  );

  const isTeacher = profile?.role === "teacher";
  const isPrincipal = profile?.role === "principal";
  const isPrincipalView = !isTeacher;

  const visiblePeriods = isTeacher
    ? periods.filter((period) => period.status !== "archived")
    : periods;

  const teacherClassroomIds = isTeacher ? getTeacherClassroomIds() : [];

  const learnerOptions = learners.filter((learner) => {
    const learnerClassroomId = String(getLearnerClassroomId(learner));

    if (isTeacher && teacherClassroomIds.length > 0) {
      return teacherClassroomIds.includes(learnerClassroomId);
    }

    if (selectedClassroomId) {
      return learnerClassroomId === String(selectedClassroomId);
    }

    return true;
  });

  async function openAssessmentReview(item: any) {
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedTeacherId(String(item.teacher_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));

    const period = periods.find(
      (periodItem) => String(periodItem.id) === String(item.report_period_id)
    );

    if (period?.report_template) {
      setReportType(period.report_template as "developmental" | "grade-rr");
    }

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("teacher_id", item.teacher_id)
      .in("status", principalAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const latestAssessments = normalizeLatestAssessments(data || []);

    setReviewAssessments(latestAssessments);

    const observation =
      latestAssessments.find((assessment: any) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("report_type", period?.report_template || reportType)
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
      .in("status", principalAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const latestAssessments = normalizeLatestAssessments(data || []);

    setReviewAssessments(latestAssessments);

    const observation =
      latestAssessments.find((assessment: any) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);
    setGeneratedReport(item);
    setPrincipalComment(item.principal_comment || "");
    setOpeningDate(item.opening_date || "");
    setClosingDate(item.closing_date || "");

    if (latestAssessments.length > 0) {
      setSelectedTeacherId(String(latestAssessments[0].teacher_id || ""));
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
      alert("No submitted checklist ratings found for this learner and period.");
      return;
    }

    if (!reviewAssessments.some((assessment) => getAssessmentValue(assessment))) {
      alert("No submitted checklist ratings found for this learner and period.");
      return;
    }

    if (selectedPeriod?.status === "archived") {
      alert(
        "This report period has been archived. Reports can no longer be generated."
      );
      return;
    }

    setSaving(true);

    const selectedReportPeriod = periods.find(
      (period) => String(period.id) === String(selectedPeriodId)
    );
    const reportTemplate =
      selectedReportPeriod?.report_template || reportType || "developmental";

    const { data: existing } = await supabase
      .from("generated_reports")
      .select("id")
      .eq("learner_id", selectedLearnerId)
      .eq("report_period_id", Number(selectedPeriodId))
      .eq("report_type", reportTemplate)
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
          report_type: reportTemplate,
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
          report_type: reportTemplate,
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

  async function downloadAwardCertificate() {
    const certificateElement = document.querySelector(
      ".award-certificate-print-area"
    ) as HTMLElement;
    const certificateButtons = document.querySelector(
      ".award-certificate-buttons"
    ) as HTMLElement;

    if (!certificateElement) {
      alert("Certificate not found.");
      return;
    }

    try {
      if (certificateButtons) {
        certificateButtons.style.display = "none";
      }

      const canvas = await html2canvas(certificateElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      if (certificateButtons) {
        certificateButtons.style.display = "flex";
      }

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(imgData, "PNG", 0, 0, 297, 210);

      const learnerName =
        getLearnerName(selectedAward?.learner_id).replace(/\s+/g, "_") ||
        "Learner";

      if (selectedAward?.id && schoolId) {
        const reprintPayload = {
          certificate_id: selectedAward.id,
          school_id: schoolId,
          learner_id: selectedAward.learner_id,
          printed_at: new Date().toISOString(),
          action: "download",
        };

        const { error: reprintError } = await supabase
          .from("certificate_reprints")
          .insert([reprintPayload]);

        if (reprintError) {
          console.warn("Certificate reprint audit failed:", reprintError.message);
        }
      }

      pdf.save(`${learnerName}_Certificate.pdf`);
    } catch (error) {
      if (certificateButtons) {
        certificateButtons.style.display = "flex";
      }

      console.error(error);
      alert("Failed to generate certificate PDF.");
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

  const primaryColor = school?.primary_color || "#4f6fbd";
  const secondaryColor = school?.secondary_color || "#D4AF37";

  const selectedAwardLearnerName = selectedAward
    ? getLearnerName(selectedAward.learner_id)
    : "";

  const selectedAwardTitle = selectedAward?.award_name || "";
  const selectedAwardYear =
    selectedAward?.award_year ||
    (selectedAward?.created_at
      ? new Date(selectedAward.created_at).getFullYear()
      : new Date().getFullYear());
  const selectedAwardSubtitle = selectedAwardTitle
    .replace(/^Certificate\s+of\s+/i, "OF ")
    .toUpperCase();
  const selectedAwardReasonLine = selectedAward?.award_reason
    ? selectedAward.award_reason.toUpperCase()
    : "OUTSTANDING EFFORT";

  let learnerNameSize = 44;

  if (selectedAwardLearnerName.length > 30) {
    learnerNameSize = 38;
  }

  if (selectedAwardLearnerName.length > 45) {
    learnerNameSize = 32;
  }

  if (selectedAwardLearnerName.length > 60) {
    learnerNameSize = 28;
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div
        className="db-card db-card-lavender no-print"
        style={{ padding: "24px", marginBottom: "24px" }}
      >
        <h1 className="db-page-title">Progress Reports</h1>
        <p className="db-page-subtitle">
          Generate Developmental Reports for all learners and Grade RR Reports for
          learners preparing for Grade R next year.
        </p>
      </div>

      {isPrincipal && (
        <div className="no-print" style={{ marginBottom: "24px" }}>
          <button
            className="db-button-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Progress Report Period
          </button>
        </div>
      )}

      {isPrincipal && (
        <div
          className="db-card db-card-blue no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
          <div
            onClick={() => setShowPeriodManagement(!showPeriodManagement)}
            style={collapsibleHeader}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              Report Period Management
            </h3>
            <span style={chevron}>{showPeriodManagement ? "-" : "+"}</span>
          </div>

          {showPeriodManagement && (
            <>
              {visiblePeriods.length === 0 ? (
                <p className="db-helper" style={{ marginTop: "14px" }}>
                  No report periods created yet.
                </p>
              ) : (
                <div
                  style={{ display: "grid", gap: "12px", marginTop: "14px" }}
                >
                  {visiblePeriods.map((period) => (
                    <div key={period.id} className="db-list-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>{period.title}</strong>
                          <p style={textStyle}>
                            {formatReportTemplate(
                              period.report_template || "developmental"
                            )}
                          </p>
                          <span
                            style={periodStatusStyle(period.status || "open")}
                          >
                            Status: {period.status || "open"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                          }}
                        >
                          {(period.status || "open") === "open" ? (
                            <button
                              className="db-button-primary"
                              onClick={() =>
                                updatePeriodStatus(period.id, "closed")
                              }
                            >
                              Close Period
                            </button>
                          ) : null}

                          {period.status === "closed" ? (
                            <>
                              <button
                                className="db-button-primary"
                                onClick={() =>
                                  updatePeriodStatus(period.id, "open")
                                }
                              >
                                Reopen
                              </button>

                              <button
                                className="db-button-primary"
                                style={{ background: "#777" }}
                                onClick={() =>
                                  updatePeriodStatus(period.id, "archived")
                                }
                              >
                                Archive
                              </button>
                            </>
                          ) : null}

                          {period.status === "archived" ? (
                            <span style={pillGrey}>Archived</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isPrincipal && showCreateModal && (
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
              value={newReportTemplate}
              onChange={(e) =>
                setNewReportTemplate(
                  e.target.value as "developmental" | "grade-rr"
                )
              }
            >
              <option value="developmental">
                Developmental Progress Report
              </option>
              <option value="grade-rr">Grade RR Progress Report</option>
            </select>

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

            {!isTeacher && (
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
            )}

            {!isTeacher && (
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
            )}

            <select
              className="db-input"
              value={selectedLearnerId}
              onChange={(e) => {
                const learnerId = e.target.value;
                const learner = learners.find(
                  (item) => String(item.id) === String(learnerId)
                );
                const learnerClassroomId = getLearnerClassroomId(learner);

                setSelectedLearnerId(learnerId);

                if (isTeacher && learnerClassroomId) {
                  setSelectedClassroomId(learnerClassroomId);
                }

                setAssessmentPage(1);
                setReportPage(1);
              }}
            >
              <option value="">All Learners</option>
              {learnerOptions.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.legal_name || learner.name} -{" "}
                  {getClassroomName(getLearnerClassroomId(learner))}
                </option>
              ))}
            </select>

            <select
              className="db-input"
              value={selectedPeriodId}
              onChange={(e) => {
                const periodId = e.target.value;
                setSelectedPeriodId(periodId);
                setAssessmentPage(1);
                setReportPage(1);

                const selectedReportPeriod = visiblePeriods.find(
                  (period) => String(period.id) === String(periodId)
                );

                if (selectedReportPeriod?.report_template) {
                  setReportType(
                    selectedReportPeriod.report_template as
                      | "developmental"
                      | "grade-rr"
                  );
                }
              }}
            >
              <option value="">All Terms / Report Periods</option>
              {visiblePeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.title} ({formatPeriodType(period.report_type)} -{" "}
                  {formatReportTemplate(period.report_template || "developmental")}
                  )
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isTeacher && (
        <div
          className="db-card db-card-blue no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
          <div
            onClick={() => setShowTeacherChecklist(!showTeacherChecklist)}
            style={collapsibleHeader}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              Complete Learner Progress Checklist
            </h3>
            <span style={chevron}>{showTeacherChecklist ? "-" : "+"}</span>
          </div>

          {showTeacherChecklist && (
            <div style={{ marginTop: "14px" }}>
              <p style={textStyle}>
                Complete the actual report checklist for this learner. Your
                ratings and remarks will be submitted to the principal for review
                and final report generation.
              </p>

              {!selectedLearnerId || !selectedPeriodId ? (
                <p className="db-helper" style={{ marginTop: "14px" }}>
                  Please select learner and term/report period in the filters
                  above.
                </p>
              ) : (
                <>
                  <TeacherChecklistCapture
                    categories={activeCategories}
                    ratingScale={activeRatingScale}
                    teacherRatings={teacherRatings}
                    onRatingChange={handleTeacherRatingChange}
                  />

                  <textarea
                    className="db-input"
                    rows={3}
                    placeholder="Practitioner remarks"
                    value={teacherObservation}
                    onChange={(event) => {
                      setTeacherObservation(event.target.value);
                      setTeacherComment(event.target.value);
                    }}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      marginTop: "14px",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      className="db-button-primary"
                      onClick={() => saveTeacherChecklist("draft")}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Draft"}
                    </button>

                    <button
                      className="db-button-primary"
                      onClick={() => saveTeacherChecklist("submitted")}
                      disabled={saving}
                    >
                      {saving ? "Submitting..." : "Submit to Principal"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isPrincipalView && (
        <div
          className="db-card db-card-lavender no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
        <div
          onClick={() => setShowAssessments(!showAssessments)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            Practitioner Observations
          </h3>
          <span style={chevron}>{showAssessments ? "-" : "+"}</span>
        </div>

        {showAssessments && (
          <>
            {visibleAssessments.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>
                No practitioner observations found.
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
      )}

      {isPrincipalView && (
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
      )}

      {!isTeacher && (
        <div
          className="db-card db-card-yellow no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
        <div onClick={() => setShowAwards(!showAwards)} style={collapsibleHeader}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Achievement Awards</h3>
          <span style={chevron}>{showAwards ? "-" : "+"}</span>
        </div>

        {showAwards && (
          <>
            <div
            style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
            marginTop: "16px",
          }}
          >
              <select
                className="db-input"
                value={selectedAwardLearnerId}
                onChange={(e) => handleAwardLearnerChange(e.target.value)}
              >
                <option value="">Select Learner</option>

                {learners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.legal_name || learner.name}
                  </option>
                ))}
              </select>

              <input
                className="db-input"
                value={
                  selectedAwardClassroomId
                    ? getClassroomName(selectedAwardClassroomId)
                    : "Class will auto-fill"
                }
                readOnly
              />

              <select
                className="db-input"
                value={selectedAwardTeacherId}
                onChange={(e) => setSelectedAwardTeacherId(e.target.value)}
              >
                <option value="">Select Teacher</option>

                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name || teacher.name || teacher.email}
                  </option>
                ))}
              </select>

              <select
                className="db-input"
                value={selectedAwardPeriodId}
                onChange={(e) => setSelectedAwardPeriodId(e.target.value)}
              >
                <option value="">Select Report Period</option>

                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.title} ({formatPeriodType(period.report_type)} -{" "}
                    {formatReportTemplate(
                      period.report_template || "developmental"
                    )}
                    )
                  </option>
                ))}
              </select>

              <select
                className="db-input"
                value={selectedAwardType}
                onChange={(e) => {
                  setSelectedAwardType(e.target.value);
                  setAwardReason("");
                }}
              >
                <option value="">Select Award</option>

                {certificateTypes.map((award) => (
                  <option key={award} value={award}>
                    {award}
                  </option>
                ))}
              </select>

              <select
                className="db-input"
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                style={{ gridColumn: "1 / -1" }}
                disabled={!selectedAwardType}
              >
                <option value="">
                  {selectedAwardType
                    ? "Select reason for award"
                    : "Select award type first"}
                </option>

                {(certificateReasonOptions[selectedAwardType] || []).map(
                  (reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  )
                )}
              </select>

              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  className="db-button-primary"
                  onClick={createAward}
                  disabled={saving}
                >
                  {saving ? "Creating..." : "Create Award"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              {visibleAwards.map((award) => (
                <div key={award.id} className="db-list-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{getLearnerName(award.learner_id)}</strong>
                      <p style={textStyle}>{award.award_name}</p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                    <button
                      className="db-button-primary"
                      onClick={() => setSelectedAward(award)}
                    >
                      View
                    </button>

                    <button
                      className="db-button-primary"
                      onClick={async () => {
                        setSelectedAward(award);
                        setPendingAwardDownload(true);
                      }}
                    >
                      Download
                    </button>

                    <button
                      className="db-button-primary"
                      style={{ background: "#d9534f" }}
                      onClick={() => deleteCertificate(award)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredAwards.length > pageSize ? (
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  className="db-button-primary"
                  disabled={awardPage === 1}
                  onClick={() => setAwardPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </button>

                <button
                  className="db-button-primary"
                  disabled={awardPage * pageSize >= filteredAwards.length}
                  onClick={() => setAwardPage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
        </div>
      )}

      {!isTeacher && selectedAward && (
        <div
          className="db-card db-card-lavender award-certificate-print-area"
          style={{
            padding: "24px",
            marginBottom: "24px",
            background: "#fff",
          }}
        >
          <div
            style={{
              position: "relative",
              minHeight: "690px",
              border: `24px solid ${primaryColor}`,
              background: "#FFFFFF",
              overflow: "hidden",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "22px",
                border: "1px solid rgba(212, 175, 55, 0.75)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: "120px",
                top: 0,
                width: "170px",
                height: "100%",
                background: secondaryColor,
              }}
            />

            <div
              style={{
                position: "absolute",
                right: "-54px",
                top: "-34px",
                width: "260px",
                height: "88px",
                background: secondaryColor,
                transform: "rotate(45deg)",
                transformOrigin: "center",
              }}
            />

            <div
              style={{
                position: "absolute",
                right: "-54px",
                bottom: "-34px",
                width: "260px",
                height: "88px",
                background: secondaryColor,
                transform: "rotate(-45deg)",
                transformOrigin: "center",
              }}
            />

            {school?.logo_url && (
              <img
                src={school.logo_url}
                alt="School Logo"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "58%",
                  width: "310px",
                  height: "310px",
                  objectFit: "contain",
                  opacity: 0.12,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}

            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: "74px 70px 44px 330px",
                minHeight: "642px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxSizing: "border-box",
              }}
            >
              <div>
                <h1
                  style={{
                    margin: "0",
                    fontSize: "66px",
                    color: "#D4AF37",
                    letterSpacing: "2px",
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  CERTIFICATE
                </h1>

                <h2
                  style={{
                    margin: "10px auto 54px",
                    fontSize: "34px",
                    color: "#111",
                    fontWeight: 400,
                    letterSpacing: "1px",
                  }}
                >
                  {selectedAwardSubtitle}
                </h2>

                <p
                  style={{
                    margin: "0 0 28px",
                    fontSize: "18px",
                    color: "#111",
                    letterSpacing: "4px",
                    fontWeight: 700,
                  }}
                >
                  PROUDLY PRESENTED TO
                </p>

                <h2
                  style={{
                    margin: "0 auto 38px",
                    fontSize: learnerNameSize + 18,
                    color: "#D4AF37",
                    fontWeight: 400,
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                    maxWidth: "820px",
                    lineHeight: 1.05,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                  }}
                >
                  {selectedAwardLearnerName}
                </h2>

                <p
                  style={{
                    margin: "0 auto",
                    maxWidth: "620px",
                    fontSize: "18px",
                    color: "#111",
                    fontWeight: 800,
                    fontStyle: "italic",
                    lineHeight: 1.35,
                  }}
                >
                  FOR {selectedAwardReasonLine}
                  <br />
                  YEAR {selectedAwardYear}
                </p>

                <p
                  style={{
                    marginTop: "34px",
                    fontSize: "16px",
                    color: "#333",
                  }}
                >
                  {school?.school_name || "School Name"}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "90px",
                  alignItems: "end",
                }}
              >
                <div>
                  <p
                    style={{
                      borderBottom: `2px solid #D4AF37`,
                      paddingBottom: "4px",
                      margin: "0 auto 8px",
                      maxWidth: "220px",
                      color: "#111",
                      fontSize: "16px",
                      fontWeight: 700,
                    }}
                  >
                    {getAwardTeacherName(selectedAward.learner_id, selectedAward)}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#111" }}>
                    CLASS TEACHER
                  </p>
                </div>

                <div>
                  <p
                    style={{
                      borderBottom: `2px solid #D4AF37`,
                      paddingBottom: "4px",
                      margin: "0 auto 8px",
                      maxWidth: "220px",
                      color: "#111",
                      fontSize: "16px",
                      fontWeight: 700,
                    }}
                  >
                    {selectedAward.principal_name ||
                      profile?.full_name ||
                      "Principal"}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#111" }}>
                    PRINCIPAL
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="no-print award-certificate-buttons"
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
              onClick={() => setSelectedAward(null)}
            >
              Close Certificate
            </button>

            <button
              className="db-button-primary"
              onClick={downloadAwardCertificate}
            >
              Download / Print Certificate
            </button>
          </div>
        </div>
      )}

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

                <h2 style={{ ...coverTitle, color: primaryColor }}>
                  {reportTitleUpper}
                </h2>

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
                    <strong>Name of Child:</strong>{" "}
                    {selectedLearner.legal_name || selectedLearner.name}
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

                {!isTeacher && (
                  <>
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
                  </>
                )}

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

              {!isTeacher && !generatedReport && (
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

              {!isTeacher && generatedReport && (
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
          .report-print-area *,
          .award-certificate-print-area,
          .award-certificate-print-area * {
            visibility: visible;
          }

          .report-print-area,
          .award-certificate-print-area {
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

function TeacherChecklistCapture({
  categories,
  ratingScale,
  teacherRatings,
  onRatingChange,
}: {
  categories: any[];
  ratingScale: any[];
  teacherRatings: Record<string, string>;
  onRatingChange: (
    categoryKey: string,
    indicatorKey: string,
    level: string
  ) => void;
}) {
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

  return (
    <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
      {categories.map((category: any) => {
        const indicators = getCategoryIndicators(category);

        return (
          <div key={category.key} className="db-list-card">
            <strong>{category.label}</strong>

            {category.description ? (
              <p style={textStyle}>{category.description}</p>
            ) : null}

            {indicators.length === 0 ? (
              <p className="db-helper">No indicators configured.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                {indicators.map((indicator: any) => {
                  const indicatorKey = indicator.key || indicator.label;
                  const selectedLevel =
                    teacherRatings[
                      makeAssessmentKey(category.key, indicatorKey)
                    ] || "";

                  return (
                    <div
                      key={`${category.key}-${indicatorKey}`}
                      style={{
                        borderTop: "1px solid #eee",
                        paddingTop: "10px",
                      }}
                    >
                      <p style={{ ...textStyle, color: "var(--db-text)" }}>
                        {indicator.label}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginTop: "8px",
                        }}
                      >
                        {levels.map((level) => (
                          <label
                            key={`${category.key}-${indicatorKey}-${level}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              color: "var(--db-text-soft)",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            <input
                              type="radio"
                              name={`${category.key}-${indicatorKey}`}
                              checked={selectedLevel === level}
                              onChange={() =>
                                onRatingChange(
                                  category.key,
                                  indicatorKey,
                                  level
                                )
                              }
                            />
                            {level}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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

    return normalizeLevel(getAssessmentValue(assessment));
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

const pillGreen = {
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  height: "fit-content",
};

const pillOrange = {
  background: "#FFF4E5",
  border: "1px solid #F6C981",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  height: "fit-content",
};

const pillGrey = {
  background: "#F1F1F1",
  border: "1px solid #D8D8D8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#555",
  height: "fit-content",
};

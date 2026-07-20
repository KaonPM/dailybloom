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
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { awardDefinitions } from "../lib/award-types";

const reportLevels = ["NP", "PA", "A", "G", "VG"];

const certificateTypes = awardDefinitions.map((award) => award.name);
const certificateReasonOptions = Object.fromEntries(
  awardDefinitions.map((award) => [award.name, award.reasons])
);

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

type ReportType = "developmental" | "grade-rr";
type IdValue = string | number | null | undefined;

type Indicator = {
  key: string;
  label: string;
  name?: string;
  text?: string;
};

type ReportCategory = {
  key: string;
  label: string;
  name?: string;
  description?: string;
  indicators?: Indicator[];
  sections?: { indicators?: Indicator[] }[];
};

type RatingLevel = string | {
  code?: string;
  value?: string;
  level?: string;
  label?: string;
};

type ProfileRow = {
  id: string;
  school_id?: number | null;
  role?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  email?: string | null;
  teacher_name?: string | null;
  classroom_id?: number | null;
  assigned_classroom_id?: number | null;
  classroom?: string | null;
  classroom_name?: string | null;
  assigned_classroom?: string | null;
  assigned_classroom_name?: string | null;
  class?: string | null;
};

type SchoolRow = {
  id?: number | null;
  school_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  address?: string | null;
  contact_number?: string | null;
  phone_number?: string | null;
  telephone?: string | null;
  emis_number?: string | null;
  npo_number?: string | null;
  physical_address?: string | null;
  school_address?: string | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teacher_email?: string | null;
  practitioner_id?: string | null;
};

type LearnerRow = {
  id: string | number;
  name?: string | null;
  classroom_id?: number | null;
  legal_name?: string | null;
  class?: string | null;
  class_name?: string | null;
  classroom?: string | null;
  classroom_name?: string | null;
  assigned_classroom?: string | null;
  assigned_classroom_name?: string | null;
};

type PeriodRow = {
  id: number;
  title?: string | null;
  period_title?: string | null;
  term?: string | null;
  period_type?: string | null;
  report_template?: ReportType | null;
  report_type?: ReportType | null;
  opening_date?: string | null;
  closing_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

type AssessmentRow = {
  id?: number | null;
  school_id?: number | null;
  classroom_id?: number | null;
  teacher_id?: string | null;
  learner_id?: string | number | null;
  report_period_id?: number | null;
  report_type?: ReportType | null;
  status?: string | null;
  category?: string | null;
  indicator_key?: string | null;
  indicator_label?: string | null;
  indicator?: string | null;
  label?: string | null;
  level?: string | null;
  rating?: string | null;
  assessment_level?: string | null;
  selected_level?: string | null;
  selected_rating?: string | null;
  value?: string | null;
  teacher_comment?: string | null;
  principal_comment?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type TeacherReportSummary = {
  learner_id?: IdValue;
  classroom_id?: IdValue;
  report_period_id?: IdValue;
  report_type?: ReportType | null;
  status?: string | null;
  updated_at?: string | null;
  count: number;
};

type GeneratedReportRow = {
  id?: number | null;
  classroom_id?: IdValue;
  learner_id?: IdValue;
  report_period_id?: IdValue;
  report_type?: ReportType | null;
  principal_comment?: string | null;
  opening_date?: string | null;
  closing_date?: string | null;
  report_status?: string | null;
  generated_at?: string | null;
};

type AwardRow = {
  id?: number | null;
  learner_id?: IdValue;
  classroom_id?: IdValue;
  teacher_id?: IdValue;
  report_period_id?: IdValue;
  award_type?: string | null;
  award_name?: string | null;
  name?: string | null;
  teacher_name?: string | null;
  award_reason?: string | null;
  reason?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

function getAssessmentValue(assessment?: AssessmentRow | null) {
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

function getCategoryIndicators(category?: ReportCategory | null): Indicator[] {
  return (
    category?.indicators ||
    category?.sections?.flatMap((section) => section.indicators || []) ||
    []
  );
}

function getAssessmentTimestamp(assessment?: AssessmentRow | null) {
  const value = assessment?.updated_at || assessment?.created_at || "";
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeLatestAssessments(assessments: AssessmentRow[]) {
  const latestByIndicator = new Map<string, AssessmentRow>();

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
      (assessmentHasValue === currentHasValue &&
        getAssessmentTimestamp(assessment) >= getAssessmentTimestamp(current))
    ) {
      latestByIndicator.set(key, assessment);
    }
  });

  return Array.from(latestByIndicator.values());
}

function makeAssessmentKey(categoryKey: string, indicatorKey: string) {
  return `${categoryKey}::${indicatorKey}`;
}

function normalizeMatchValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function ProgressReportsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolRow | null>(null);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [teachers, setTeachers] = useState<ProfileRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [allAssessments, setAllAssessments] = useState<AssessmentRow[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportRow[]>([]);

  const [reportType, setReportType] = useState<"developmental" | "grade-rr">(
    "developmental"
  );

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [reviewAssessments, setReviewAssessments] = useState<AssessmentRow[]>([]);
  const [principalComment, setPrincipalComment] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [generatedReport, setGeneratedReport] = useState<GeneratedReportRow | null>(null);

  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState("quarterly");
  const [newOpeningDate, setNewOpeningDate] = useState("");
  const [newClosingDate, setNewClosingDate] = useState("");
  const [newReportTemplate, setNewReportTemplate] = useState<
    "developmental" | "grade-rr"
  >("developmental");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showPeriodManagement, setShowPeriodManagement] = useState(false);
  const [showTeacherChecklist, setShowTeacherChecklist] = useState(true);
  const [showTeacherSavedReports, setShowTeacherSavedReports] = useState(true);
  const [editingSavedChecklist, setEditingSavedChecklist] = useState(false);
  const [showAssessments, setShowAssessments] = useState(true);
  const [showGeneratedReports, setShowGeneratedReports] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [principalReportTab, setPrincipalReportTab] = useState<
    "awaiting" | "reviewed" | "generated"
  >("awaiting");
  const [periodDefaultApplied, setPeriodDefaultApplied] = useState(false);

  const [expandedAssessmentKey, setExpandedAssessmentKey] = useState<
    string | null
  >(null);
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(
    null
  );

  const [assessmentPage, setAssessmentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [awardPage, setAwardPage] = useState(1);
  const [teacherReportPage, setTeacherReportPage] = useState(1);

  const [teacherObservation, setTeacherObservation] = useState("");
  const [teacherRatings, setTeacherRatings] = useState<Record<string, string>>(
    {}
  );
  const [teacherReportSummaries, setTeacherReportSummaries] = useState<TeacherReportSummary[]>(
    []
  );
  const [teacherSaveAction, setTeacherSaveAction] = useState<
    "draft" | "submitted" | null
  >(null);
  const [pendingDownload, setPendingDownload] = useState(false);

  const [showAwards, setShowAwards] = useState(false);
  const [awards, setAwards] = useState<AwardRow[]>([]);

  const [selectedAwardLearnerId, setSelectedAwardLearnerId] = useState("");
  const [selectedAwardClassroomId, setSelectedAwardClassroomId] = useState("");
  const [selectedAwardTeacherId, setSelectedAwardTeacherId] = useState("");
  const [selectedAwardPeriodId, setSelectedAwardPeriodId] = useState("");
  const [selectedAwardType, setSelectedAwardType] = useState("");
  const [awardReason, setAwardReason] = useState("");
  const [selectedAward, setSelectedAward] = useState<AwardRow | null>(null);
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

  useEffect(() => {
    setEditingSavedChecklist(false);
  }, [selectedLearnerId, selectedPeriodId, reportType]);

  useEffect(() => {
    if (!profile || periodDefaultApplied || selectedPeriodId || periods.length === 0) return;

    const currentPeriod = periods.find((period) => period.status === "open");
    setPeriodDefaultApplied(true);
    if (!currentPeriod) return;

    setSelectedPeriodId(String(currentPeriod.id));
    setReportType(currentPeriod.report_template || "developmental");
    setOpeningDate(currentPeriod.opening_date || "");
    setClosingDate(currentPeriod.closing_date || "");
  }, [profile, periods, selectedPeriodId, periodDefaultApplied]);

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
    } else {
      await fetchTeacherReportSummaries(currentSchoolId, profile.id);
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

    const teacherRows = ((data || []) as ProfileRow[]).filter((item) => {
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

    setAwards(((data || []) as AwardRow[]).filter((award) => !award.deleted_at));
  }

  async function deleteCertificate(award: AwardRow) {
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

  function formatAssessmentStatus(status: string) {
    if (status === "draft") return "Saved Draft";
    if (status === "submitted") return "Submitted to Principal";
    if (status === "reviewed") return "Reviewed by Principal";
    if (status === "locked" || status === "generated") return "Final Report Generated";
    return status || "Saved";
  }

  function assessmentStatusStyle(status: string) {
    if (status === "draft") return pillOrange;
    if (status === "submitted") return pillGreen;
    if (status === "reviewed") return pillGreen;
    if (status === "locked" || status === "generated") return pillGrey;
    return pillGrey;
  }

  async function createReportPeriod() {
    if (!schoolId || !newPeriodTitle.trim()) {
      alert("Please enter a progress report period title.");
      return;
    }

    if (newOpeningDate && newClosingDate && newClosingDate < newOpeningDate) {
      alert("Closing date cannot be before the opening date.");
      return;
    }

    const { error } = await supabase.from("report_periods").insert([
      {
        school_id: schoolId,
        title: newPeriodTitle.trim(),
        report_type: newPeriodType,
        report_template: newReportTemplate,
        opening_date: newOpeningDate || null,
        closing_date: newClosingDate || null,
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
    setNewOpeningDate("");
    setNewClosingDate("");
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

    applyTeacherSavedAssessments(data || []);
  }

  function applyTeacherSavedAssessments(assessments: AssessmentRow[]) {
    const latestAssessments = normalizeLatestAssessments(assessments || []);
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
      latestAssessments.find((assessment) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherRatings(nextRatings);
    setTeacherObservation(observation);
    setTeacherComment(observation);
  }

  async function fetchTeacherReportSummaries(
    currentSchoolId: number,
    teacherId: IdValue
  ) {
    if (!currentSchoolId || !teacherId) {
      setTeacherReportSummaries([]);
      return;
    }

    const { data, error } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("teacher_id", teacherId)
      .in("status", teacherAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const map = new Map<string, TeacherReportSummary>();

    ((data || []) as AssessmentRow[]).forEach((item) => {
      const key = `${item.learner_id || ""}-${item.report_period_id || ""}-${
        item.report_type || "developmental"
      }`;
      const current = map.get(key);
      const currentTime = getAssessmentTimestamp(current);
      const itemTime = getAssessmentTimestamp(item);

      if (!current || itemTime >= currentTime) {
        map.set(key, {
          learner_id: item.learner_id,
          classroom_id: item.classroom_id,
          report_period_id: item.report_period_id,
          report_type: item.report_type || "developmental",
          status: item.status || "draft",
          updated_at: item.updated_at || item.created_at || null,
          count: current?.count || 0,
        });
      }

      const next = map.get(key);
      if (next) {
        next.count = Number(next.count || 0) + 1;
      }
    });

    setTeacherReportSummaries(Array.from(map.values()));
    setTeacherReportPage(1);
  }

  async function openTeacherReportSummary(item: TeacherReportSummary, editMode = false) {
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));
    setReportType(
      (item.report_type || "developmental") as "developmental" | "grade-rr"
    );
    setShowTeacherChecklist(true);
    setShowTeacherSavedReports(true);
    setEditingSavedChecklist(editMode);

    if (schoolId && profile?.id) {
      const { data, error } = await supabase
        .from("learner_assessments")
        .select("*")
        .eq("school_id", schoolId)
        .eq("teacher_id", profile.id)
        .eq("learner_id", item.learner_id)
        .eq("report_period_id", Number(item.report_period_id))
        .eq("report_type", item.report_type || "developmental")
        .in("status", teacherAssessmentStatusFilters)
        .order("updated_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      applyTeacherSavedAssessments(data || []);
    }

    window.requestAnimationFrame(() => {
      document
        .querySelector(".teacher-checklist-card")
        ?.scrollIntoView({ behavior: "smooth" });
    });
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

  async function submitTeacherSavedSummary(item: TeacherReportSummary) {
    if (!schoolId || !profile?.id || !item?.learner_id || !item?.report_period_id) {
      alert("Saved checklist could not be submitted.");
      return;
    }

    const confirmed = confirm(
      `Submit ${getLearnerName(item.learner_id)}'s checklist to the principal?`
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("learner_assessments")
      .update({
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("school_id", schoolId)
      .eq("teacher_id", profile.id)
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("report_type", item.report_type || "developmental")
      .in("status", ["draft", "submitted"]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await fetchTeacherSavedRatings();
    await fetchTeacherReportSummaries(schoolId, profile.id);
    await fetchAllAssessments(schoolId);

    setShowTeacherChecklist(false);
    setShowTeacherSavedReports(true);
    setEditingSavedChecklist(false);
    setSaving(false);

    alert("Checklist submitted to principal.");
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

    const selectedRows = (activeCategories as ReportCategory[]).flatMap((category) => {
      return getCategoryIndicators(category)
        .map((indicator) => {
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
    setTeacherSaveAction(status);

    for (const row of selectedRows) {
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
        setTeacherSaveAction(null);
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
        setTeacherSaveAction(null);
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
        setTeacherSaveAction(null);
        return;
      }
    }

    await fetchTeacherSavedRatings();

    if (schoolId) {
      await fetchAllAssessments(schoolId);
      await fetchTeacherReportSummaries(schoolId, profile.id);
    }

    setShowTeacherChecklist(false);
    setShowTeacherSavedReports(true);
    setEditingSavedChecklist(false);

    setSaving(false);
    setTeacherSaveAction(null);
    alert(
      status === "submitted"
        ? "Report submitted."
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

  async function updatePeriodDates(
    periodId: number,
    nextOpeningDate: string,
    nextClosingDate: string
  ) {
    if (
      nextOpeningDate &&
      nextClosingDate &&
      nextClosingDate < nextOpeningDate
    ) {
      alert("Closing date cannot be before the opening date.");
      return;
    }

    const { error } = await supabase
      .from("report_periods")
      .update({
        opening_date: nextOpeningDate || null,
        closing_date: nextClosingDate || null,
      })
      .eq("id", periodId);

    if (error) {
      alert(error.message);
      return;
    }

    setPeriods((current) =>
      current.map((period) =>
        period.id === periodId
          ? {
              ...period,
              opening_date: nextOpeningDate || null,
              closing_date: nextClosingDate || null,
            }
          : period
      )
    );

    if (String(selectedPeriodId) === String(periodId)) {
      setOpeningDate(nextOpeningDate);
      setClosingDate(nextClosingDate);
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
    setShowAwards(true);
    setAwardPage(1);

    setSaving(false);
    alert("Certificate created.");
  }

  function getClassroomName(classroomId: IdValue) {
    return (
      classrooms.find((c) => String(c.id) === String(classroomId))
        ?.classroom_name || "Class not recorded"
    );
  }

  function getLearnerName(learnerId: IdValue) {
    const learner = learners.find((l) => String(l.id) === String(learnerId));

    return learner?.legal_name || learner?.name || "Learner not recorded";
  }

  function getAwardTeacherName(learnerId: IdValue, award?: AwardRow) {
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

  function getTeacherName(teacherId: IdValue) {
    const teacher = teachers.find((t) => String(t.id) === String(teacherId));

    return (
      teacher?.full_name ||
      teacher?.name ||
      teacher?.email ||
      "Practitioner not recorded"
    );
  }

  function getLearnerClassroomId(learner: LearnerRow | null | undefined) {
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
      .map((item) => String(item).trim().toLowerCase());

    const classroom = classrooms.find(
      (item) =>
        learnerClassNames.includes(
          String(item.classroom_name || "").trim().toLowerCase()
        ) ||
        learnerClassNames.includes(String(item.id || "").trim().toLowerCase())
    );

    return classroom ? String(classroom.id) : "";
  }

  function getClassroomTeacherId(classroomId: IdValue) {
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
      .map((item) => String(item).trim().toLowerCase());

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
      .map((item) => String(item).trim().toLowerCase());

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

  function getPeriodTitle(periodId: IdValue) {
    const period = periods.find((p) => String(p.id) === String(periodId));

    return period
      ? `${period.title} (${formatPeriodType(
          period.report_type
        )} - ${formatReportTemplate(
          period.report_template || "developmental"
        )})`
      : "Period not recorded";
  }

  function getCoverTermLabel(period: PeriodRow | null | undefined) {
    const title = String(period?.title || "").trim();
    const termMatch = title.match(/term\s*\d+/i);

    if (termMatch) {
      return termMatch[0].toUpperCase();
    }

    return title || "REPORT PERIOD";
  }

  const groupedAssessments = useMemo(() => {
    const map = new Map();

    allAssessments.forEach((item) => {
      const key = `${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${
        item.report_period_id
      }-${item.report_type || "developmental"}`;

      if (!map.has(key)) {
        map.set(key, {
          classroom_id: item.classroom_id,
          teacher_id: item.teacher_id,
          learner_id: item.learner_id,
          report_period_id: item.report_period_id,
          report_type: item.report_type || "developmental",
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
    if (["locked", "generated"].includes(String(item.status || ""))) {
      return false;
    }

    if (statusFilter && String(item.status || "") !== statusFilter) {
      return false;
    }

    if (
      profile?.role !== "teacher" &&
      principalReportTab === "awaiting" &&
      String(item.status || "") !== "submitted"
    ) {
      return false;
    }

    if (
      profile?.role !== "teacher" &&
      principalReportTab === "reviewed" &&
      String(item.status || "") !== "reviewed"
    ) {
      return false;
    }

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

    if (selectedPeriodId && savedReportType !== reportType) {
      return false;
    }

    if (
      statusFilter &&
      ![String(item.report_status || "generated"), "generated", "locked"].includes(
        statusFilter
      )
    ) {
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

  const principalReviewQueue = groupedAssessments.filter(
    (item) => !["locked", "generated"].includes(String(item.status || ""))
  );

  function getAssessmentReviewKey(item: AssessmentRow) {
    return `${item.classroom_id}-${item.teacher_id}-${item.learner_id}-${
      item.report_period_id
    }-${item.report_type || "developmental"}`;
  }

  const currentReviewKey =
    selectedClassroomId && selectedTeacherId && selectedLearnerId && selectedPeriodId
      ? `${selectedClassroomId}-${selectedTeacherId}-${selectedLearnerId}-${selectedPeriodId}-${reportType}`
      : "";
  const currentReviewIndex = principalReviewQueue.findIndex(
    (item) => getAssessmentReviewKey(item) === currentReviewKey
  );

  const visibleReports = filteredReports.slice(
    (reportPage - 1) * pageSize,
    reportPage * pageSize
  );

  const uniqueAwards = useMemo<AwardRow[]>(() => {
    const map = new Map<string, AwardRow>();

    awards.forEach((award) => {
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

  const selectedTeacherReportSummary = teacherReportSummaries.find(
    (item) =>
      String(item.learner_id) === String(selectedLearnerId) &&
      String(item.report_period_id) === String(selectedPeriodId) &&
      String(item.report_type || "developmental") === String(reportType)
  );
  const selectedTeacherReportStatus =
    selectedTeacherReportSummary?.status || "draft";
  const selectedTeacherChecklistIsSaved = Boolean(selectedTeacherReportSummary);
  const shouldShowFullTeacherChecklist =
    !selectedTeacherChecklistIsSaved || editingSavedChecklist;
  const teacherReportCanSubmit =
    selectedTeacherChecklistIsSaved &&
    !["submitted", "reviewed", "locked", "generated"].includes(
      String(selectedTeacherReportStatus)
    );
  const teacherReportIsLocked = [
    "reviewed",
    "locked",
    "generated",
  ].includes(String(selectedTeacherReportStatus));
  const filteredTeacherReportSummaries = teacherReportSummaries.filter((item) => {
    if (selectedLearnerId && String(item.learner_id) !== String(selectedLearnerId)) {
      return false;
    }
    if (selectedPeriodId && String(item.report_period_id) !== String(selectedPeriodId)) {
      return false;
    }
    if (statusFilter && String(item.status || "draft") !== statusFilter) {
      return false;
    }
    return true;
  });
  const visibleTeacherReportSummaries = filteredTeacherReportSummaries.slice(
    (teacherReportPage - 1) * pageSize,
    teacherReportPage * pageSize
  );

  async function openAssessmentReview(item: AssessmentRow) {
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedTeacherId(String(item.teacher_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));

    const period = periods.find(
      (periodItem) => String(periodItem.id) === String(item.report_period_id)
    );
    const assessmentReportType =
      item.report_type || period?.report_template || reportType;

    const { data: exactData, error: exactError } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", schoolId)
      .eq("classroom_id", item.classroom_id)
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("teacher_id", item.teacher_id)
      .eq("report_type", assessmentReportType)
      .in("status", principalAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (exactError) {
      alert(exactError.message);
      return;
    }

    let assessmentRows = exactData || [];

    if (assessmentRows.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("learner_assessments")
        .select("*")
        .eq("school_id", schoolId)
        .eq("classroom_id", item.classroom_id)
        .eq("learner_id", item.learner_id)
        .eq("report_period_id", Number(item.report_period_id))
        .eq("teacher_id", item.teacher_id)
        .is("report_type", null)
        .in("status", principalAssessmentStatusFilters)
        .order("updated_at", { ascending: false });

      if (fallbackError) {
        alert(fallbackError.message);
        return;
      }

      assessmentRows = fallbackData || [];
    }

    const resolvedReportType =
      assessmentRows.find((assessment: AssessmentRow) => assessment.report_type)
        ?.report_type || assessmentReportType;

    setReportType(resolvedReportType as "developmental" | "grade-rr");

    const latestAssessments = normalizeLatestAssessments(assessmentRows);

    setReviewAssessments(latestAssessments);

    const observation =
      latestAssessments.find((assessment) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);

    const { data: reportData, error: reportError } = await supabase
      .from("generated_reports")
      .select("*")
      .eq("school_id", schoolId)
      .eq("classroom_id", item.classroom_id)
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("report_type", resolvedReportType)
      .maybeSingle();

    if (reportError) {
      alert(reportError.message);
      return;
    }

    setGeneratedReport(reportData);
    setPrincipalComment(reportData?.principal_comment || "");
    setOpeningDate(reportData?.opening_date || period?.opening_date || "");
    setClosingDate(reportData?.closing_date || period?.closing_date || "");

    window.requestAnimationFrame(() => {
      document
        .querySelector(".report-print-area")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function openAdjacentAssessmentReview(direction: "previous" | "next") {
    if (currentReviewIndex < 0) return;

    const nextIndex =
      direction === "previous" ? currentReviewIndex - 1 : currentReviewIndex + 1;
    const nextItem = principalReviewQueue[nextIndex];

    if (!nextItem) return;

    await openAssessmentReview(nextItem);
  }

  async function openGeneratedReport(item: GeneratedReportRow) {
    const savedReportType = item.report_type || "developmental";

    setReportType(savedReportType);
    setSelectedClassroomId(String(item.classroom_id || ""));
    setSelectedLearnerId(String(item.learner_id || ""));
    setSelectedPeriodId(String(item.report_period_id || ""));

    const { data: exactData, error: exactError } = await supabase
      .from("learner_assessments")
      .select("*")
      .eq("school_id", schoolId)
      .eq("classroom_id", item.classroom_id)
      .eq("learner_id", item.learner_id)
      .eq("report_period_id", Number(item.report_period_id))
      .eq("report_type", savedReportType)
      .in("status", principalAssessmentStatusFilters)
      .order("updated_at", { ascending: false });

    if (exactError) {
      alert(exactError.message);
      return;
    }

    let assessmentRows = exactData || [];

    if (assessmentRows.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("learner_assessments")
        .select("*")
        .eq("school_id", schoolId)
        .eq("classroom_id", item.classroom_id)
        .eq("learner_id", item.learner_id)
        .eq("report_period_id", Number(item.report_period_id))
        .is("report_type", null)
        .in("status", principalAssessmentStatusFilters)
        .order("updated_at", { ascending: false });

      if (fallbackError) {
        alert(fallbackError.message);
        return;
      }

      assessmentRows = fallbackData || [];
    }

    const latestAssessments = normalizeLatestAssessments(assessmentRows);

    setReviewAssessments(latestAssessments);

    const observation =
      latestAssessments.find((assessment) => assessment.teacher_comment)
        ?.teacher_comment || "";

    setTeacherObservation(observation);
    setTeacherComment(observation);
    setGeneratedReport(item);
    setPrincipalComment(item.principal_comment || "");
    const reportPeriod = periods.find(
      (period) => String(period.id) === String(item.report_period_id)
    );
    setOpeningDate(item.opening_date || reportPeriod?.opening_date || "");
    setClosingDate(item.closing_date || reportPeriod?.closing_date || "");

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

    let reportError: { message?: string } | null = null;

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
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                            <label style={labelText}>
                              Opening Date
                              <input
                                className="db-input"
                                type="date"
                                value={period.opening_date || ""}
                                onChange={(event) =>
                                  updatePeriodDates(
                                    period.id,
                                    event.target.value,
                                    period.closing_date || ""
                                  )
                                }
                              />
                            </label>
                            <label style={labelText}>
                              Closing Date
                              <input
                                className="db-input"
                                type="date"
                                value={period.closing_date || ""}
                                onChange={(event) =>
                                  updatePeriodDates(
                                    period.id,
                                    period.opening_date || "",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          </div>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={labelText}>
                Opening Date
                <input className="db-input" type="date" value={newOpeningDate} onChange={(event) => setNewOpeningDate(event.target.value)} />
              </label>
              <label style={labelText}>
                Closing Date
                <input className="db-input" type="date" value={newClosingDate} onChange={(event) => setNewClosingDate(event.target.value)} />
              </label>
            </div>

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Reports</h3>
          <button
            className="db-button-primary"
            style={{ background: "#777" }}
            onClick={() => {
              if (!isTeacher) {
                setSelectedClassroomId("");
                setSelectedTeacherId("");
              }
              setSelectedLearnerId("");
              setSelectedPeriodId("");
              setStatusFilter("");
              setOpeningDate("");
              setClosingDate("");
              setAssessmentPage(1);
              setReportPage(1);
              setTeacherReportPage(1);
            }}
          >
            Clear Filters
          </button>
        </div>

          <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" }}>
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
                setTeacherReportPage(1);
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
                setOpeningDate(selectedReportPeriod?.opening_date || "");
                setClosingDate(selectedReportPeriod?.closing_date || "");
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

            <select
              className="db-input"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setAssessmentPage(1);
                setReportPage(1);
                setTeacherReportPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {isTeacher ? <option value="draft">Draft</option> : null}
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              {!isTeacher ? <option value="generated">Generated</option> : null}
            </select>
          </div>
          {(selectedClassroomId || selectedTeacherId || selectedLearnerId || selectedPeriodId || statusFilter) && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
              {selectedPeriodId ? <span style={pillGreen}>{getPeriodTitle(selectedPeriodId)}</span> : null}
              {selectedClassroomId ? <span style={pillGreen}>{getClassroomName(selectedClassroomId)}</span> : null}
              {selectedTeacherId && !isTeacher ? <span style={pillGreen}>{getTeacherName(selectedTeacherId)}</span> : null}
              {selectedLearnerId ? <span style={pillGreen}>{getLearnerName(selectedLearnerId)}</span> : null}
              {statusFilter ? <span style={pillGreen}>{formatAssessmentStatus(statusFilter)}</span> : null}
            </div>
          )}
      </div>

      {isTeacher && (
        <div
          className="db-card db-card-blue no-print teacher-checklist-card"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
          <div
            onClick={() => setShowTeacherChecklist(!showTeacherChecklist)}
            style={collapsibleHeader}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              Practitioner Report Workspace
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
                  {selectedTeacherChecklistIsSaved && !shouldShowFullTeacherChecklist ? (
                    <div className="db-list-card" style={{ marginTop: "14px" }}>
                      <strong>{getLearnerName(selectedLearnerId)}</strong>

                      <p style={textStyle}>
                        Status:{" "}
                        <span style={assessmentStatusStyle(selectedTeacherReportStatus)}>
                          {formatAssessmentStatus(selectedTeacherReportStatus)}
                        </span>
                      </p>

                      <p style={textStyle}>
                        {getPeriodTitle(selectedPeriodId)}
                      </p>

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
                          onClick={() => setEditingSavedChecklist(true)}
                          disabled={teacherReportIsLocked}
                        >
                          Edit
                        </button>

                        <button
                          className="db-button-primary"
                          onClick={() => setEditingSavedChecklist(true)}
                        >
                          View
                        </button>

                        {teacherReportCanSubmit ? (
                          <button
                            className="db-button-primary"
                            onClick={() => submitTeacherSavedSummary(selectedTeacherReportSummary)}
                            disabled={saving}
                          >
                            Submit to Principal
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <TeacherChecklistCapture
                        categories={activeCategories}
                        ratingScale={activeRatingScale}
                        teacherRatings={teacherRatings}
                        onRatingChange={handleTeacherRatingChange}
                        disabled={teacherReportIsLocked}
                      />

                      {selectedTeacherReportSummary && (
                        <p style={{ ...textStyle, marginTop: "12px" }}>
                          Status:{" "}
                          <span
                            style={assessmentStatusStyle(selectedTeacherReportStatus)}
                          >
                            {formatAssessmentStatus(selectedTeacherReportStatus)}
                          </span>
                        </p>
                      )}

                      <textarea
                        className="db-input"
                        rows={3}
                        placeholder="Practitioner remarks"
                        value={teacherObservation}
                        disabled={teacherReportIsLocked}
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
                          disabled={saving || teacherReportIsLocked}
                        >
                          {teacherSaveAction === "draft" ? "Saving..." : "Save Draft"}
                        </button>

                        <button
                          className="db-button-primary"
                          onClick={() => saveTeacherChecklist("submitted")}
                          disabled={saving || teacherReportIsLocked}
                        >
                          {teacherSaveAction === "submitted"
                            ? "Submitting..."
                            : "Submit to Principal"}
                        </button>

                        {selectedTeacherChecklistIsSaved ? (
                          <button
                            className="db-button-primary"
                            style={{ background: "#777" }}
                            onClick={() => setEditingSavedChecklist(false)}
                          >
                            Collapse
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isTeacher && (
        <div
          className="db-card db-card-lavender no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
          <div
            onClick={() => setShowTeacherSavedReports(!showTeacherSavedReports)}
            style={collapsibleHeader}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              My Saved and Submitted Reports
            </h3>
            <span style={chevron}>{showTeacherSavedReports ? "-" : "+"}</span>
          </div>

          {showTeacherSavedReports && (
            <div style={{ marginTop: "14px" }}>
              {teacherReportSummaries.length === 0 ? (
                <p className="db-helper">
                  No saved draft or submitted progress reports yet.
                </p>
              ) : (
                <>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {visibleTeacherReportSummaries.map((item) => {
                      const status = String(item.status || "draft");
                      const isLocked = [
                        "reviewed",
                        "locked",
                        "generated",
                      ].includes(status);
                      const canSubmitSaved = ![
                        "submitted",
                        "reviewed",
                        "locked",
                        "generated",
                      ].includes(status);

                      return (
                        <div
                          key={`${item.learner_id}-${item.report_period_id}-${item.report_type}`}
                          className="db-list-card"
                          style={{ padding: "12px" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <strong>{getLearnerName(item.learner_id)}</strong>
                              <p style={textStyle}>{getPeriodTitle(item.report_period_id)}</p>
                              <p style={textStyle}>
                                {formatReportTemplate(item.report_type || "developmental")}
                              </p>
                              <span style={assessmentStatusStyle(status)}>
                                {formatAssessmentStatus(status)}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              {!isLocked ? (
                                <button
                                  className="db-button-primary"
                                  style={{ minHeight: "38px", padding: "8px 14px" }}
                                  onClick={() => openTeacherReportSummary(item, true)}
                                >
                                  Edit
                                </button>
                              ) : null}

                              <button
                                className="db-button-primary"
                                style={{
                                  minHeight: "38px",
                                  padding: "8px 14px",
                                  ...(isLocked ? { background: "#777" } : {}),
                                }}
                                onClick={() => openTeacherReportSummary(item, false)}
                              >
                                View
                              </button>

                              {canSubmitSaved ? (
                                <button
                                  className="db-button-primary"
                                  style={{ minHeight: "38px", padding: "8px 14px" }}
                                  onClick={() => submitTeacherSavedSummary(item)}
                                  disabled={saving}
                                >
                                  Submit to Principal
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      className="db-button-primary"
                      disabled={teacherReportPage === 1}
                      onClick={() =>
                        setTeacherReportPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Previous
                    </button>

                    <button
                      className="db-button-primary"
                      disabled={
                        teacherReportPage * pageSize >=
                        filteredTeacherReportSummaries.length
                      }
                      onClick={() => setTeacherReportPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isPrincipalView && (
        <div className="no-print" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          {([
            ["awaiting", "Awaiting Review"],
            ["reviewed", "Reviewed"],
            ["generated", "Generated Reports"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className="db-button-primary"
              style={principalReportTab === value ? undefined : { background: "#777" }}
              onClick={() => {
                setPrincipalReportTab(value);
                setStatusFilter("");
                setAssessmentPage(1);
                setReportPage(1);
                setTeacherReportPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isPrincipalView && principalReportTab !== "generated" && (
        <div
          className="db-card db-card-lavender no-print"
          style={{ padding: "20px", marginBottom: "24px" }}
        >
        <div
          onClick={() => setShowAssessments(!showAssessments)}
          style={collapsibleHeader}
        >
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            {principalReportTab === "reviewed"
              ? "Reviewed Reports"
              : "Reports Awaiting Principal Review"}
          </h3>
          <span style={chevron}>{showAssessments ? "-" : "+"}</span>
        </div>

        {showAssessments && (
          <>
            {visibleAssessments.length === 0 ? (
              <p className="db-helper" style={{ marginTop: "14px" }}>
                No reports found for this view.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {visibleAssessments.map((item) => {
                  const key = getAssessmentReviewKey(item);
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
                          <div>
                            <strong>{getLearnerName(item.learner_id)}</strong>
                            <p style={textStyle}>
                              {getClassroomName(item.classroom_id)} · {getTeacherName(item.teacher_id)}
                            </p>
                            <p style={textStyle}>
                              {getPeriodTitle(item.report_period_id)} · {formatReportTemplate(item.report_type || "developmental")}
                            </p>
                            <span style={assessmentStatusStyle(item.status)}>
                              {formatAssessmentStatus(item.status)}
                            </span>
                          </div>
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
                          <p style={textStyle}>
                            Type:{" "}
                            {formatReportTemplate(
                              item.report_type || "developmental"
                            )}
                          </p>
                          <p style={textStyle}>Observation items: {item.count}</p>

                          <button
                            className="db-button-primary"
                            style={{ marginTop: "10px" }}
                            onClick={() => openAssessmentReview(item)}
                          >
                            {principalReportTab === "reviewed" ? "View Report" : "Review Report"}
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

      {isPrincipalView && principalReportTab === "generated" && (
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
          <div>
            <h3 style={{ ...sectionTitle, margin: 0 }}>Achievement Awards</h3>
            <Link
              href="/achievement-awards"
              className="db-button-primary"
              style={{ display: "inline-block", marginTop: "10px", textDecoration: "none" }}
              onClick={(event) => event.stopPropagation()}
            >
              Open Achievement Awards Module
            </Link>
          </div>
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

            <h4
              style={{
                marginTop: "24px",
                marginBottom: "12px",
                fontSize: "18px",
                fontWeight: 800,
                color: "var(--db-text)",
              }}
            >
              Generated Achievement Awards
            </h4>

            {filteredAwards.length === 0 ? (
              <p className="db-helper">No generated achievement awards yet.</p>
            ) : null}

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
              <div style={bookletPanel}>
                <h3 style={bookletSectionTitle}>National Codes</h3>

                <div style={codesBox}>
                  <strong>Codes / Level of Competence</strong>
                  <br />
                  {reportType === "grade-rr"
                    ? "1 = Not Achieved | 2 = Partially Achieved | 3 = Achieved | 4 = Outstanding Achievement"
                    : "NP = Needs Practice | PA = Partially Achieved | A = Achieved | G = Good | VG = Very Good"}
                </div>

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

              <div style={coverPanel}>
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
                  {getCoverTermLabel(selectedPeriod)}
                </p>
              </div>
            </div>

            <div className="booklet-page">
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

                {(firstPageCategories as ReportCategory[]).map((category) => (
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
                {(secondPageCategories as ReportCategory[]).map((category) => (
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

            <p
              className="no-print"
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
              {!isTeacher && !generatedReport && (
                <>
                  <button
                    className="db-button-primary"
                    disabled={currentReviewIndex <= 0}
                    onClick={() => openAdjacentAssessmentReview("previous")}
                  >
                    Previous Learner
                  </button>

                  <button
                    className="db-button-primary"
                    disabled={
                      currentReviewIndex < 0 ||
                      currentReviewIndex >= principalReviewQueue.length - 1
                    }
                    onClick={() => openAdjacentAssessmentReview("next")}
                  >
                    Next Learner
                  </button>
                </>
              )}

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
  disabled = false,
}: {
  categories: ReportCategory[];
  ratingScale: RatingLevel[];
  teacherRatings: Record<string, string>;
  onRatingChange: (
    categoryKey: string,
    indicatorKey: string,
    level: string
  ) => void;
  disabled?: boolean;
}) {
  function getLevelCode(level: RatingLevel) {
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
      {categories.map((category) => {
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
                {indicators.map((indicator) => {
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
                              disabled={disabled}
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
  categories: ReportCategory[];
  ratingScale: RatingLevel[];
  reviewAssessments: AssessmentRow[];
}) {
  const category = categories.find((item) => item.key === categoryKey);

  const indicators =
    category?.indicators ||
    category?.sections?.flatMap((section) => section.indicators || []) ||
    [];

  const categoryMatchValues = [
    categoryKey,
    category?.key,
    category?.label,
    category?.name,
  ]
    .filter(Boolean)
    .map(normalizeMatchValue);

  const categoryAssessments = reviewAssessments.filter((item) =>
    categoryMatchValues.includes(normalizeMatchValue(item.category))
  );

  function getLevelCode(level: RatingLevel) {
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

  function getIndicatorLevel(indicator: Indicator) {
    const indicatorMatchValues = [
      indicator.key,
      indicator.label,
      indicator.name,
      indicator.text,
    ]
      .filter(Boolean)
      .map(normalizeMatchValue);

    const assessment = categoryAssessments.find((item) => {
      const assessmentMatchValues = [
        item.indicator_key,
        item.indicator_label,
        item.indicator,
        item.label,
      ]
        .filter(Boolean)
        .map(normalizeMatchValue);

      return assessmentMatchValues.some((value) =>
        indicatorMatchValues.includes(value)
      );
    });

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
        {indicators.map((indicator) => {
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

const coverPanel: React.CSSProperties = {
  ...bookletPanel,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
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

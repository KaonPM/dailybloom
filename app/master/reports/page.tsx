"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";

type ReportRow = {
  school: string;
  type: string;
  detail: string;
  value: string;
  status: string;
};

type SchoolOption = {
  id: number;
  school_name: string;
  sponsor_programme_id?: number | null;
};

const reportTypes = [
  "Executive Dashboard Report",

  "Schools Report",
  "School Growth",
  "Learners by School",
  "Teachers by School",
  "School Activity Report",
  "School Usage Report",

  "Revenue Report",
  "Subscriptions Report",
  "Package Breakdown",
  "Overdue Schools",

  "Daily Summaries Report",
  "Broadcast Report",
  "WhatsApp Usage Report",
  "SMS Usage Report",
  "Payment Reminder Report",

  "Progress Report Analytics",
  "Grade RR Progress Reports",
  "Developmental Progress Reports",

  "Sponsored Schools",
  "Sponsor Impact Report",
  "Learners Supported",
  "Teachers Supported",
  "Attendance Impact",
  "Parent Engagement Impact",

  "Platform Overview",
  "Feature Usage",
  "User Activity",
  "Adoption Trends",
  "Active Schools",
  "Active Teachers",
  "Active Parents",
  "Active Learners",

  "WageFlow Enabled Schools",
  "WageFlow Activity",
  "WageFlow Usage Trends",
  "WageFlow Adoption Report",
];

export default function MasterReportsPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState("Executive Dashboard Report");
  const [period, setPeriod] = useState("month");
  const [selectedSchoolId, setSelectedSchoolId] = useState("all");
  const [selectedSponsorId, setSelectedSponsorId] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role !== "master") {
      router.push("/dashboard");
      return;
    }

    await fetchSchools();
    setLoading(false);
  }

  async function fetchSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, sponsor_programme_id")
      .is("deleted_at", null)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSchools(data || []);
  }

  function getDateRange() {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (period === "quarter") {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStartMonth, 1);
      end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    }

    if (period === "semester") {
      const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), semesterStartMonth, 1);
      end = new Date(now.getFullYear(), semesterStartMonth + 6, 0);
    }

    if (period === "year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    if (period === "custom") {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
      };
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }

  function getSchoolName(schoolId: number | null | undefined) {
    if (!schoolId) return "Not linked";
    return schools.find((school) => Number(school.id) === Number(schoolId))?.school_name || `School ID ${schoolId}`;
  }

  function getFilteredSchoolIds() {
    let filtered = schools;

    if (selectedSchoolId !== "all") {
      filtered = filtered.filter((school) => String(school.id) === selectedSchoolId);
    }

    if (selectedSponsorId !== "all") {
      filtered = filtered.filter(
        (school) => String(school.sponsor_programme_id || "") === selectedSponsorId
      );
    }

    return filtered.map((school) => Number(school.id));
  }

  async function runReport() {
    setRunning(true);

    try {
      if (reportType === "Executive Dashboard Report") await runExecutiveDashboardReport();

      if (reportType === "Schools Report") await runSchoolsReport();
      if (reportType === "School Growth") await runSchoolGrowthReport();
      if (reportType === "Learners by School") await runLearnersBySchoolReport();
      if (reportType === "Teachers by School") await runTeachersBySchoolReport();
      if (reportType === "School Activity Report") await runSchoolActivityReport();
      if (reportType === "School Usage Report") await runSchoolUsageReport();

      if (reportType === "Revenue Report") await runRevenueReport();
      if (reportType === "Subscriptions Report") await runSubscriptionsReport();
      if (reportType === "Package Breakdown") await runPackageBreakdownReport();
      if (reportType === "Overdue Schools") await runOverdueSchoolsReport();

      if (reportType === "Daily Summaries Report") await runGenericTableReport("daily_summaries", "Daily Summaries", "created_at");
      if (reportType === "Broadcast Report") await runBroadcastReport();
      if (reportType === "WhatsApp Usage Report") await runGenericTableReport("broadcasts", "WhatsApp Usage", "created_at");
      if (reportType === "SMS Usage Report") await runUnavailableReport("SMS Usage Report", "SMS usage table has not been added yet.");
      if (reportType === "Payment Reminder Report") await runPaymentReminderReport();

      if (reportType === "Progress Report Analytics") await runGenericTableReport("progress_reports", "Progress Reports", "created_at");
      if (reportType === "Grade RR Progress Reports") await runGenericTableReport("progress_reports", "Grade RR Progress Reports", "created_at");
      if (reportType === "Developmental Progress Reports") await runGenericTableReport("progress_reports", "Developmental Progress Reports", "created_at");

      if (reportType === "Sponsored Schools") await runSponsoredSchoolsReport();
      if (reportType === "Sponsor Impact Report") await runSponsorImpactReport();
      if (reportType === "Learners Supported") await runLearnersBySchoolReport();
      if (reportType === "Teachers Supported") await runTeachersBySchoolReport();
      if (reportType === "Attendance Impact") await runGenericTableReport("attendance", "Attendance Impact", "created_at");
      if (reportType === "Parent Engagement Impact") await runGenericTableReport("broadcasts", "Parent Engagement", "created_at");

      if (reportType === "Platform Overview") await runExecutiveDashboardReport();
      if (reportType === "Feature Usage") await runFeatureUsageReport();
      if (reportType === "User Activity") await runGenericTableReport("profiles", "User Activity", "created_at");
      if (reportType === "Adoption Trends") await runSchoolGrowthReport();
      if (reportType === "Active Schools") await runActiveSchoolsReport();
      if (reportType === "Active Teachers") await runTeachersBySchoolReport();
      if (reportType === "Active Parents") await runGenericTableReport("parents", "Active Parents", "created_at");
      if (reportType === "Active Learners") await runLearnersBySchoolReport();

      if (reportType === "WageFlow Enabled Schools") await runWageFlowReport();
      if (reportType === "WageFlow Activity") await runWageFlowReport();
      if (reportType === "WageFlow Usage Trends") await runWageFlowReport();
      if (reportType === "WageFlow Adoption Report") await runWageFlowReport();

      setShowResults(true);
    } finally {
      setRunning(false);
    }
  }

  async function runExecutiveDashboardReport() {
    const schoolIds = getFilteredSchoolIds();

    const totalSchools = schoolIds.length;
    const activeSchools = schools.filter((school) => schoolIds.includes(Number(school.id))).length;

    const learners = await countTable("learners", schoolIds);
    const teachers = await countProfiles("teacher", schoolIds);
    const reminders = await countTable("payment_reminders", schoolIds);
    const broadcasts = await countTable("broadcasts", schoolIds);
    const summaries = await countTable("daily_summaries", schoolIds);
    const progressReports = await countTable("progress_reports", schoolIds);
    const sponsoredSchools = schools.filter(
      (school) => schoolIds.includes(Number(school.id)) && school.sponsor_programme_id
    ).length;

    setRows([
      { school: "All Selected Schools", type: "Executive", detail: "Total Schools", value: String(totalSchools), status: "Current" },
      { school: "All Selected Schools", type: "Executive", detail: "Active Schools", value: String(activeSchools), status: "Current" },
      { school: "All Selected Schools", type: "Executive", detail: "Total Learners", value: String(learners), status: "Current" },
      { school: "All Selected Schools", type: "Executive", detail: "Total Teachers", value: String(teachers), status: "Current" },
      { school: "All Selected Schools", type: "Executive", detail: "Daily Summaries Generated", value: String(summaries), status: "Period" },
      { school: "All Selected Schools", type: "Executive", detail: "Payment Reminders Sent", value: String(reminders), status: "Period" },
      { school: "All Selected Schools", type: "Executive", detail: "Broadcasts Created", value: String(broadcasts), status: "Period" },
      { school: "All Selected Schools", type: "Executive", detail: "Progress Reports Generated", value: String(progressReports), status: "Period" },
      { school: "All Selected Schools", type: "Executive", detail: "Sponsored Schools", value: String(sponsoredSchools), status: "Current" },
    ]);
  }

  async function runSchoolsReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("id, school_name, is_active, billing_status, status, package_name, registration_status, province, district")
      .in("id", schoolIds)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "School",
        detail: `Package: ${school.package_name || "Not set"} | ${school.province || "Province not set"}`,
        value: `Billing: ${school.billing_status || "Not set"}`,
        status: school.registration_status || school.status || "Not set",
      }))
    );
  }

  async function runSchoolGrowthReport() {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("schools")
      .select("id, school_name, created_at, status")
      .in("id", schoolIds)
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "School Growth",
        detail: "School onboarded",
        value: school.created_at ? new Date(school.created_at).toLocaleDateString() : "Not set",
        status: school.status || "Current",
      }))
    );
  }

  async function runLearnersBySchoolReport() {
    await runGroupedCountReport("learners", "Learners", "Active learners");
  }

  async function runTeachersBySchoolReport() {
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("profiles")
      .select("id, school_id")
      .eq("role", "teacher");

    if (schoolIds.length > 0) query = query.in("school_id", schoolIds);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    const schoolMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const schoolName = getSchoolName(item.school_id);
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries()).map(([school, count]) => ({
        school,
        type: "Teachers",
        detail: "Teacher profiles",
        value: String(count),
        status: "Current",
      }))
    );
  }

  async function runSchoolActivityReport() {
    const schoolIds = getFilteredSchoolIds();
    const reminders = await countTable("payment_reminders", schoolIds);
    const broadcasts = await countTable("broadcasts", schoolIds);
    const summaries = await countTable("daily_summaries", schoolIds);

    setRows([
      { school: "All Selected Schools", type: "School Activity", detail: "Payment reminders", value: String(reminders), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Broadcasts", value: String(broadcasts), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Daily summaries", value: String(summaries), status: "Period" },
    ]);
  }

  async function runSchoolUsageReport() {
    await runFeatureUsageReport();
  }

  async function runSubscriptionsReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("school_subscriptions")
      .select("school_id, plan_name, monthly_price, status, next_billing_date")
      .in("school_id", schoolIds)
      .order("next_billing_date", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: getSchoolName(item.school_id),
        type: "Subscription",
        detail: item.plan_name || "No plan",
        value: `R${Number(item.monthly_price || 0).toFixed(2)} | Next billing: ${item.next_billing_date || "Not set"}`,
        status: item.status || "Not set",
      }))
    );
  }

  async function runRevenueReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("school_subscriptions")
      .select("school_id, plan_name, monthly_price, status")
      .in("school_id", schoolIds);

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: getSchoolName(item.school_id),
        type: "Revenue",
        detail: item.plan_name || "No plan",
        value: `Monthly: R${Number(item.monthly_price || 0).toFixed(2)} | Annual: R${(Number(item.monthly_price || 0) * 12).toFixed(2)}`,
        status: item.status || "Not set",
      }))
    );
  }

  async function runPackageBreakdownReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("package_name")
      .in("id", schoolIds);

    if (error) {
      alert(error.message);
      return;
    }

    const packageMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const plan = item.package_name || "No package";
      packageMap.set(plan, (packageMap.get(plan) || 0) + 1);
    });

    setRows(
      Array.from(packageMap.entries()).map(([plan, count]) => ({
        school: "All Selected Schools",
        type: "Package Breakdown",
        detail: plan,
        value: String(count),
        status: "Total schools",
      }))
    );
  }

  async function runOverdueSchoolsReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("school_name, billing_status, package_name")
      .in("id", schoolIds)
      .eq("billing_status", "overdue")
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "Overdue School",
        detail: school.package_name || "No package",
        value: school.billing_status || "overdue",
        status: "Needs follow-up",
      }))
    );
  }

  async function runBroadcastReport() {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("broadcasts")
      .select("id, school_id, title, audience, recipient_count, created_at")
      .in("school_id", schoolIds)
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: getSchoolName(item.school_id),
        type: "Broadcast",
        detail: item.title || "Untitled broadcast",
        value: `Audience: ${item.audience || "Not set"} | Recipients: ${item.recipient_count || 0}`,
        status: item.created_at ? new Date(item.created_at).toLocaleDateString() : "Not set",
      }))
    );
  }

  async function runPaymentReminderReport() {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("payment_reminders")
      .select("id, school_id, scheduled_date, status, created_at")
      .in("school_id", schoolIds)
      .order("scheduled_date", { ascending: false });

    if (startDate) query = query.gte("scheduled_date", startDate);
    if (endDate) query = query.lte("scheduled_date", endDate);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((item: any) => ({
        school: getSchoolName(item.school_id),
        type: "Payment Reminder",
        detail: `Scheduled: ${item.scheduled_date || "Not set"}`,
        value: item.status || "Not set",
        status: "Communication",
      }))
    );
  }

  async function runSponsoredSchoolsReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("school_name, sponsor_programme_id, is_sponsored, province, district")
      .in("id", schoolIds)
      .eq("is_sponsored", true)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "Sponsored School",
        detail: `Sponsor Programme ID: ${school.sponsor_programme_id || "Not linked"}`,
        value: `${school.province || "Province not set"} | ${school.district || "District not set"}`,
        status: school.is_sponsored ? "Sponsored" : "Not sponsored",
      }))
    );
  }

  async function runSponsorImpactReport() {
    const schoolIds = getFilteredSchoolIds();
    const sponsoredSchools = schools.filter(
      (school) => schoolIds.includes(Number(school.id)) && school.sponsor_programme_id
    );

    const learners = await countTable("learners", sponsoredSchools.map((school) => Number(school.id)));
    const teachers = await countProfiles("teacher", sponsoredSchools.map((school) => Number(school.id)));
    const reminders = await countTable("payment_reminders", sponsoredSchools.map((school) => Number(school.id)));
    const broadcasts = await countTable("broadcasts", sponsoredSchools.map((school) => Number(school.id)));

    setRows([
      { school: "Sponsored Schools", type: "Impact", detail: "Schools funded", value: String(sponsoredSchools.length), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Learners supported", value: String(learners), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Teachers supported", value: String(teachers), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Payment reminders", value: String(reminders), status: "Period" },
      { school: "Sponsored Schools", type: "Impact", detail: "Broadcasts", value: String(broadcasts), status: "Period" },
    ]);
  }

  async function runActiveSchoolsReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("school_name, is_active, status, billing_status")
      .in("id", schoolIds)
      .eq("is_active", true)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "Active School",
        detail: `Billing: ${school.billing_status || "Not set"}`,
        value: school.status || "Active",
        status: "Active",
      }))
    );
  }

  async function runFeatureUsageReport() {
    const schoolIds = getFilteredSchoolIds();

    const reminders = await countTable("payment_reminders", schoolIds);
    const broadcasts = await countTable("broadcasts", schoolIds);
    const summaries = await countTable("daily_summaries", schoolIds);
    const progressReports = await countTable("progress_reports", schoolIds);
    const learners = await countTable("learners", schoolIds);
    const teachers = await countProfiles("teacher", schoolIds);

    setRows([
      { school: "All Selected Schools", type: "Feature Usage", detail: "Learners", value: String(learners), status: "Current" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Teachers", value: String(teachers), status: "Current" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Daily summaries", value: String(summaries), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Payment reminders", value: String(reminders), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Broadcasts", value: String(broadcasts), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Progress reports", value: String(progressReports), status: "Period" },
    ]);
  }

  async function runWageFlowReport() {
    const schoolIds = getFilteredSchoolIds();

    const { data, error } = await supabase
      .from("schools")
      .select("school_name, wageflow_enabled, package_name")
      .in("id", schoolIds)
      .eq("wageflow_enabled", true)
      .order("school_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(
      (data || []).map((school: any) => ({
        school: school.school_name || "Unnamed school",
        type: "WageFlow",
        detail: "WageFlow enabled",
        value: school.package_name || "Not set",
        status: "Enabled",
      }))
    );
  }

  async function runGroupedCountReport(tableName: string, type: string, detail: string) {
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from(tableName)
      .select("id, school_id")
      .in("school_id", schoolIds);

    const { data, error } = await query;

    if (error) {
      setRows([
        {
          school: "System",
          type,
          detail: "Report unavailable",
          value: error.message,
          status: "Check table",
        },
      ]);
      return;
    }

    const schoolMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const schoolName = getSchoolName(item.school_id);
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries()).map(([school, count]) => ({
        school,
        type,
        detail,
        value: String(count),
        status: "Current",
      }))
    );
  }

  async function runGenericTableReport(tableName: string, type: string, dateColumn: string) {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from(tableName)
      .select("*")
      .in("school_id", schoolIds);

    if (startDate) query = query.gte(dateColumn, startDate);
    if (endDate) query = query.lte(dateColumn, `${endDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      setRows([
        {
          school: "System",
          type,
          detail: "Report unavailable",
          value: error.message,
          status: "Check table/schema",
        },
      ]);
      return;
    }

    const schoolMap = new Map<string, number>();

    (data || []).forEach((item: any) => {
      const schoolName = getSchoolName(item.school_id);
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries()).map(([school, count]) => ({
        school,
        type,
        detail: "Total records",
        value: String(count),
        status: "Period",
      }))
    );
  }

  async function runUnavailableReport(type: string, message: string) {
    setRows([
      {
        school: "System",
        type,
        detail: message,
        value: "0",
        status: "Pending setup",
      },
    ]);
  }

  async function countTable(tableName: string, schoolIds: number[]) {
    if (schoolIds.length === 0) return 0;

    let query = supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .in("school_id", schoolIds);

    const { count, error } = await query;

    if (error) return 0;
    return count || 0;
  }

  async function countProfiles(role: string, schoolIds: number[]) {
    if (schoolIds.length === 0) return 0;

    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", role)
      .in("school_id", schoolIds);

    if (error) return 0;
    return count || 0;
  }

  function buildFilename(extension: string) {
    return `${reportType
      .toLowerCase()
      .replace(/\s+/g, "-")}-${period}-${new Date()
      .toISOString()
      .split("T")[0]}.${extension}`;
  }

  function exportCsv() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const headers = ["school", "type", "detail", "value", "status"];
    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String((row as any)[header] || "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    downloadBlob(csvRows.join("\n"), "text/csv;charset=utf-8;", buildFilename("csv"));
  }

  function exportExcel() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.school)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.detail)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.status)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>School</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadBlob(html, "application/vnd.ms-excel;charset=utf-8;", buildFilename("xls"));
  }

  function exportPdf() {
    if (rows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.school)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.detail)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.status)}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Could not open print window. Please allow pop-ups and try again.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(reportType)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #2D2A3E;
            }
            h1 {
              margin: 0 0 6px 0;
              font-size: 22px;
            }
            p {
              margin: 0 0 18px 0;
              color: #5B5675;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th,
            td {
              border: 1px solid #D8D8D8;
              padding: 7px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #EAF7FD;
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportType)}</h1>
          <p>Generated by DailyBloom Master Dashboard</p>
          <table>
            <thead>
              <tr>
                <th>School</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function downloadBlob(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function escapeHtml(value: string) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const sponsorOptions = Array.from(
    new Set(
      schools
        .map((school) => school.sponsor_programme_id)
        .filter((value) => value !== null && value !== undefined)
    )
  );

  if (loading) {
    return <p>Loading platform reports...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Platform Reports</h2>
        <p className="db-page-subtitle">
          Generate master-level reports across all DailyBloom schools.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>Report Filters</h3>

        <div style={grid}>
          <div>
            <p style={labelText}>Report Type</p>
            <select
              className="db-input"
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
            >
              {reportTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Period</p>
            <select
              className="db-input"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="month">This Month</option>
              <option value="quarter">Quarter</option>
              <option value="semester">Semester</option>
              <option value="year">Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div>
            <p style={labelText}>School</p>
            <select
              className="db-input"
              value={selectedSchoolId}
              onChange={(event) => setSelectedSchoolId(event.target.value)}
            >
              <option value="all">All Schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Sponsor</p>
            <select
              className="db-input"
              value={selectedSponsorId}
              onChange={(event) => setSelectedSponsorId(event.target.value)}
            >
              <option value="all">All Sponsors</option>
              {sponsorOptions.map((sponsorId) => (
                <option key={String(sponsorId)} value={String(sponsorId)}>
                  Sponsor Programme {String(sponsorId)}
                </option>
              ))}
            </select>
          </div>

          {period === "custom" ? (
            <>
              <div>
                <p style={labelText}>Start Date</p>
                <input
                  className="db-input"
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
              </div>

              <div>
                <p style={labelText}>End Date</p>
                <input
                  className="db-input"
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button
            type="button"
            className="db-button-primary"
            onClick={runReport}
            disabled={running}
          >
            {running ? "Running..." : "Run Report"}
          </button>
        </div>
      </div>

      <div className="db-card db-card-yellow" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={sectionTitle}>Export Center</h3>
        <p style={smallText}>
          Run a report first, then export the result as PDF, Excel or CSV.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="db-button-secondary" onClick={exportPdf}>
            Export PDF
          </button>

          <button type="button" className="db-button-secondary" onClick={exportExcel}>
            Export Excel
          </button>

          <button type="button" className="db-button-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Report Results ({rows.length})</h3>
            <p style={smallText}>
              Current report: {reportType}
            </p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowResults((prev) => !prev)}
          >
            {showResults ? "Hide" : "View Results"}
          </button>
        </div>

        {showResults ? (
          rows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 12 }}>
              No report results yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {rows.map((row, index) => (
                <div key={`${row.school}-${row.type}-${index}`} style={resultRow}>
                  <div>
                    <strong>{row.school}</strong>
                    <p style={smallText}>{row.type}</p>
                  </div>

                  <div>
                    <strong>{row.detail}</strong>
                    <p style={smallText}>{row.value}</p>
                    <p style={smallText}>Status: {row.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const labelText = {
  margin: "0 0 8px 0",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

const resultRow = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};
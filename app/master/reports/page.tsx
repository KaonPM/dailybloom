"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentProfile } from "../../lib/auth";
import { PERMISSIONS } from "../../lib/permissions";
import ExecutiveStakeholderReport from "./components/ExecutiveStakeholderReport";
import { buildExecutivePrintHtml } from "./export-utils";
import { reportGroups } from "./report-config";
import type { ReportRow, StakeholderPresetKey } from "./types";
import responsiveStyles from "../master-responsive.module.css";

type SchoolOption = {
  id: number;
  school_name: string;
  sponsor_programme_id?: number | null;
  is_active?: boolean | null;
  billing_status?: string | null;
  status?: string | null;
  package_name?: string | null;
  registration_status?: string | null;
  province?: string | null;
  district?: string | null;
  is_sponsored?: boolean | null;
};

type SponsorOption = {
  id: number;
  sponsor_name: string;
  programme_name: string;
};

type ReportSourceRow = {
  id?: number | string | null;
  school_id?: number | null;
  school_name?: string | null;
  is_active?: boolean | null;
  billing_status?: string | null;
  status?: string | null;
  package_name?: string | null;
  registration_status?: string | null;
  province?: string | null;
  district?: string | null;
  created_at?: string | null;
  generated_at?: string | null;
  report_type?: string | null;
  plan_name?: string | null;
  monthly_price?: number | string | null;
  next_billing_date?: string | null;
  title?: string | null;
  audience?: string | null;
  recipient_count?: number | null;
  scheduled_date?: string | null;
  sponsor_programme_id?: number | null;
  is_sponsored?: boolean | null;
  wageflow_enabled?: boolean | null;
};

type LearnerIdRow = {
  id?: string | null;
};

type ParentAccessInviteRow = {
  phone?: string | null;
  learner_id?: string | null;
  invite_sent_at?: string | null;
  invite_delivery_status?: string | null;
};

type SmsImpactCounts = {
  paymentReminderCampaigns: number;
  paymentReminderSmsSent: number;
  parentPortalInviteSmsSent: number;
};

type MetricResult<T> = {
  value: T | null;
  warning?: string;
};

type SchoolActivityRow = {
  school_id?: number | null;
};

type SubscriptionValueRow = {
  monthly_price?: number | string | null;
  status?: string | null;
};

type BillingAmountRow = {
  total_amount?: number | string | null;
  amount?: number | string | null;
};

export default function MasterReportsPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState("Executive Dashboard Report");
  const [period, setPeriod] = useState("month");
  const [selectedSchoolId, setSelectedSchoolId] = useState("all");
  const [selectedSponsorId, setSelectedSponsorId] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [sponsors, setSponsors] = useState<SponsorOption[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [stakeholderPreset, setStakeholderPreset] =
    useState<StakeholderPresetKey>("executive");
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      const { profile, error } = await getCurrentProfile();

      if (error || !profile) {
        router.push("/login");
        return;
      }

      if (
        profile.role !== "master" &&
        !(
          profile.role === "master_admin" &&
          Array.isArray(profile.permissions) &&
          profile.permissions.includes(PERMISSIONS.PLATFORM_REPORTS_VIEW)
        )
      ) {
        router.push("/dashboard");
        return;
      }

      const [schoolResult, sponsorResult] = await Promise.all([
        supabase
          .from("schools")
          .select(
            "id, school_name, sponsor_programme_id, is_active, billing_status, status, package_name, registration_status, province, district, is_sponsored"
          )
          .is("deleted_at", null)
          .order("school_name", { ascending: true }),
        supabase
          .from("sponsor_programmes")
          .select("id, sponsor_name, programme_name")
          .order("sponsor_name", { ascending: true }),
      ]);

      if (schoolResult.error) {
        setPageError(
          `School reporting data could not be loaded: ${schoolResult.error.message}`
        );
        setLoading(false);
        return;
      }

      setSchools((schoolResult.data || []) as SchoolOption[]);

      if (sponsorResult.error) {
        setDataWarnings([
          `Sponsor names are unavailable: ${sponsorResult.error.message}`,
        ]);
      } else {
        setSponsors((sponsorResult.data || []) as SponsorOption[]);
      }

      setLoading(false);
    }

    void checkAccess();
  }, [router]);

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

  function getSponsorName(sponsorId: number | null | undefined) {
    if (!sponsorId) return "Not linked";
    const sponsor = sponsors.find(
      (item) => Number(item.id) === Number(sponsorId)
    );
    if (!sponsor) return `Sponsor programme ${sponsorId}`;
    return `${sponsor.sponsor_name} - ${sponsor.programme_name}`;
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
    setPageError("");
    setDataWarnings([]);

    try {
      if (reportType === "Executive Dashboard Report") await runExecutiveDashboardReport();

      if (reportType === "Schools Report") await runSchoolsReport();
      if (reportType === "School Growth") await runSchoolGrowthReport();
      if (reportType === "Learners by School") await runLearnersBySchoolReport();
      if (reportType === "Practitioners by School") await runTeachersBySchoolReport();
      if (reportType === "School Activity Report") await runSchoolActivityReport();
      if (reportType === "School Usage Report") await runSchoolUsageReport();

      if (reportType === "Revenue Report") await runRevenueReport();
      if (reportType === "Subscriptions Report") await runSubscriptionsReport();
      if (reportType === "Package Breakdown") await runPackageBreakdownReport();
      if (reportType === "Overdue Schools") await runOverdueSchoolsReport();

      if (reportType === "Daily Summaries Report") await runGenericTableReport("summaries", "Daily Summaries", "created_at");
      if (reportType === "Broadcast Report") await runBroadcastReport();
      if (reportType === "Payment Reminder Report") await runPaymentReminderReport();
      if (reportType === "SMS Delivery Report") await runSmsDeliveryReport();
      if (reportType === "Homework Activity Report") await runGenericTableReport("homework_assignments", "Homework Activity", "assigned_at");
      if (reportType === "Learner Support Activity Report") await runGenericTableReport("learner_support_updates", "Learner Support Activity", "recorded_at");
      if (reportType === "Achievement Awards Report") await runGenericTableReport("achievement_awards", "Achievement Awards", "created_at");
      if (reportType === "Learner Requirements Report") await runLearnerRequirementsReport();
      if (reportType === "Parent Consent Report") await runGenericTableReport("parent_permission_requests", "Parent Consent", "created_at");
      if (reportType === "Incident Report Activity") await runGenericTableReport("incident_reports", "Incident Report Activity", "created_at");

      if (reportType === "Progress Report Analytics") await runProgressReportAnalytics();
      if (reportType === "Grade R Learner Reports") await runGeneratedReportTypeReport("grade-r", "Grade R Learner Reports");
      if (reportType === "Grade RR Progress Reports") await runGeneratedReportTypeReport("grade-rr", "Grade RR Progress Reports");
      if (reportType === "Developmental Progress Reports") await runGeneratedReportTypeReport("developmental", "Developmental Progress Reports");

      if (reportType === "Sponsored Schools") await runSponsoredSchoolsReport();
      if (reportType === "Sponsor Impact Report") await runSponsorImpactReport();
      if (reportType === "Learners Supported") await runLearnersBySchoolReport();
      if (reportType === "Practitioners Supported") await runTeachersBySchoolReport();
      if (reportType === "Attendance Impact") await runGenericTableReport("attendance", "Attendance Impact", "created_at");
      if (reportType === "Parent Engagement Impact") await runParentEngagementImpactReport();

      if (reportType === "Platform Overview") await runExecutiveDashboardReport();
      if (reportType === "Feature Usage") await runFeatureUsageReport();
      if (reportType === "User Activity") await runGenericTableReport("profiles", "User Activity", "created_at");
      if (reportType === "Adoption Trends") await runSchoolGrowthReport();
      if (reportType === "Active Schools") await runActiveSchoolsReport();
      if (reportType === "Active Practitioners") await runTeachersBySchoolReport();
      if (reportType === "Active Parents") await runGenericTableReport("parents", "Active Parents", "created_at");
      if (reportType === "Active Learners") await runLearnersBySchoolReport();

      if (reportType === "WageFlow Enabled Schools") await runWageFlowReport();
      if (reportType === "WageFlow Activity") await runWageFlowReport();
      if (reportType === "WageFlow Usage Trends") await runWageFlowReport();
      if (reportType === "WageFlow Adoption Report") await runWageFlowReport();

      setShowResults(true);
      setLastRefreshed(
        new Intl.DateTimeFormat("en-ZA", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The report could not be generated.";
      setPageError(message);
      setRows([
        {
          school: "DailyBloom reporting",
          type: "Data quality",
          detail: "Report unavailable",
          value: "Data unavailable",
          status: "Please retry or check the affected data source",
        },
      ]);
      setShowResults(true);
    } finally {
      setRunning(false);
    }
  }

  async function runExecutiveDashboardReport() {
    const schoolIds = getFilteredSchoolIds();
    const selectedSchools = schools.filter((school) =>
      schoolIds.includes(Number(school.id))
    );
    const totalSchools = selectedSchools.length;
    const sponsoredSchools = selectedSchools.filter(
      (school) => school.is_sponsored || school.sponsor_programme_id
    ).length;
    const completeSchools = selectedSchools.filter(
      (school) =>
        school.package_name &&
        school.registration_status &&
        school.province &&
        school.district
    ).length;
    const attentionSchoolRecords = selectedSchools.filter(
      (school) =>
        school.is_active === false ||
        ["overdue", "cancelled"].includes(
          String(school.billing_status || "").toLowerCase()
        ) ||
        ["incomplete", "pending"].includes(
          String(school.registration_status || "").toLowerCase()
        )
    );
    const attentionSchools = attentionSchoolRecords.length;
    const attentionSchoolSummary =
      attentionSchools === 0
        ? "No schools currently flagged"
        : `${attentionSchoolRecords
            .slice(0, 3)
            .map((school) => school.school_name)
            .join(", ")}${
            attentionSchools > 3 ? ` +${attentionSchools - 3} more` : ""
          }`;

    const [
      learners,
      practitioners,
      classrooms,
      attendanceRecords,
      presentAttendance,
      assessments,
      reports,
      supportUpdates,
      resolvedSupport,
      homework,
      awards,
      consentRequests,
      consentResponses,
      incidents,
      resolvedIncidents,
      summaries,
      broadcasts,
      sms,
      activeSchools,
      expectedRevenue,
      invoicedAmount,
      paymentAmount,
    ] = await Promise.all([
      captureMetric("Learners", countTable("learners", schoolIds)),
      captureMetric("Practitioners", countProfiles("teacher", schoolIds)),
      captureMetric("Classrooms", countTable("classrooms", schoolIds)),
      captureMetric(
        "Attendance records",
        countTable("attendance", schoolIds, "attendance_date", true)
      ),
      captureMetric(
        "Present attendance",
        countFilteredTable(
          "attendance",
          schoolIds,
          "attendance_date",
          true,
          "status",
          ["present"]
        )
      ),
      captureMetric(
        "Learner assessments",
        countTable("learner_assessments", schoolIds, "updated_at")
      ),
      captureMetric(
        "Learner reports",
        countTable("generated_reports", schoolIds, "generated_at")
      ),
      captureMetric(
        "Learner support updates",
        countTable("learner_support_updates", schoolIds, "recorded_at")
      ),
      captureMetric(
        "Resolved learner support",
        countFilteredTable(
          "learner_support_updates",
          schoolIds,
          "recorded_at",
          false,
          "support_status",
          ["resolved"]
        )
      ),
      captureMetric(
        "Homework assignments",
        countTable("homework_assignments", schoolIds, "assigned_at")
      ),
      captureMetric(
        "Achievement awards",
        countFilteredTable(
          "achievement_awards",
          schoolIds,
          "issued_at",
          false,
          "workflow_status",
          ["issued"]
        )
      ),
      captureMetric(
        "Parent consent requests",
        countTable("parent_permission_requests", schoolIds, "created_at")
      ),
      captureMetric(
        "Parent consent responses",
        countTable("parent_permission_responses", schoolIds, "responded_at")
      ),
      captureMetric(
        "Incident reports",
        countTable("incident_reports", schoolIds, "incident_date", true)
      ),
      captureMetric(
        "Resolved incidents",
        countFilteredTable(
          "incident_reports",
          schoolIds,
          "incident_date",
          true,
          "status",
          ["resolved", "closed"]
        )
      ),
      captureMetric(
        "Daily summaries",
        countTable("summaries", schoolIds, "created_at")
      ),
      captureMetric(
        "Broadcasts",
        countTable("broadcasts", schoolIds, "created_at")
      ),
      captureMetric("SMS activity", getSmsImpactCounts(schoolIds)),
      captureMetric(
        "Active school coverage",
        getActiveSchoolCount(schoolIds)
      ),
      captureMetric(
        "Expected monthly revenue",
        getExpectedMonthlyRevenue(schoolIds)
      ),
      captureMetric(
        "Invoice value issued",
        getBillingAmount(
          "billing_invoices",
          "total_amount",
          "issue_date",
          schoolIds
        )
      ),
      captureMetric(
        "Payments received",
        getBillingAmount(
          "subscription_payments",
          "amount",
          "payment_date",
          schoolIds
        )
      ),
    ]);

    const warnings = [
      learners,
      practitioners,
      classrooms,
      attendanceRecords,
      presentAttendance,
      assessments,
      reports,
      supportUpdates,
      resolvedSupport,
      homework,
      awards,
      consentRequests,
      consentResponses,
      incidents,
      resolvedIncidents,
      summaries,
      broadcasts,
      sms,
      activeSchools,
      expectedRevenue,
      invoicedAmount,
      paymentAmount,
    ]
      .map((metric) => metric.warning)
      .filter((warning): warning is string => Boolean(warning));

    const attendanceRate = formatRate(
      presentAttendance.value,
      attendanceRecords.value
    );
    const supportResolutionRate = formatRate(
      resolvedSupport.value,
      supportUpdates.value
    );
    const incidentResolutionRate = formatRate(
      resolvedIncidents.value,
      incidents.value
    );
    const adoptionRate = formatRate(activeSchools.value, totalSchools);
    const dataCompletenessRate = formatRate(completeSchools, totalSchools);
    const practitionerRatio =
      learners.value !== null &&
      practitioners.value !== null &&
      practitioners.value > 0
        ? `1 : ${Math.round(learners.value / practitioners.value)}`
        : "Data unavailable";
    const smsValue = sms.value;

    setDataWarnings((current) => [...current, ...warnings]);
    setRows([
      executiveRow(
        "Reach & Capacity",
        "Schools in scope",
        totalSchools,
        "Current"
      ),
      executiveRow(
        "Reach & Capacity",
        "Learners reached",
        learners.value,
        "Current"
      ),
      executiveRow(
        "Reach & Capacity",
        "Practitioners on platform",
        practitioners.value,
        "Current"
      ),
      executiveRow(
        "Reach & Capacity",
        "Classrooms represented",
        classrooms.value,
        "Current"
      ),
      executiveRow(
        "Reach & Capacity",
        "Practitioner-to-learner ratio",
        practitionerRatio,
        "Current"
      ),

      executiveRow(
        "Learning & Readiness",
        "Learner attendance rate",
        attendanceRate.value,
        attendanceRate.status
      ),
      executiveRow(
        "Learning & Readiness",
        "Assessments updated",
        assessments.value,
        "Period"
      ),
      executiveRow(
        "Learning & Readiness",
        "Learner reports generated",
        reports.value,
        "Period"
      ),
      executiveRow(
        "Learning & Readiness",
        "Homework assignments shared",
        homework.value,
        "Period"
      ),
      executiveRow(
        "Learning & Readiness",
        "Achievement awards issued",
        awards.value,
        "Period"
      ),

      executiveRow(
        "Parent Engagement",
        "Daily summaries generated",
        summaries.value,
        "Period"
      ),
      executiveRow(
        "Parent Engagement",
        "Parent communications sent",
        broadcasts.value,
        "Period"
      ),
      executiveRow(
        "Parent Engagement",
        "Parent consent requests",
        consentRequests.value,
        "Period"
      ),
      executiveRow(
        "Parent Engagement",
        "Parent consent responses",
        consentResponses.value,
        "Period"
      ),
      executiveRow(
        "Parent Engagement",
        "Parent portal invitation SMS",
        smsValue?.parentPortalInviteSmsSent ?? null,
        "Period"
      ),

      executiveRow(
        "Safeguarding & Support",
        "Learner support updates",
        supportUpdates.value,
        "Period"
      ),
      executiveRow(
        "Safeguarding & Support",
        "Support resolution rate",
        supportResolutionRate.value,
        supportResolutionRate.status
      ),
      executiveRow(
        "Safeguarding & Support",
        "Incident reports recorded",
        incidents.value,
        "Period"
      ),
      executiveRow(
        "Safeguarding & Support",
        "Incident resolution rate",
        incidentResolutionRate.value,
        incidentResolutionRate.status
      ),

      executiveRow(
        "Adoption & Data Quality",
        "Schools using DailyBloom",
        activeSchools.value,
        adoptionRate.status
      ),
      executiveRow(
        "Adoption & Data Quality",
        "Portfolio adoption rate",
        adoptionRate.value,
        adoptionRate.status
      ),
      executiveRow(
        "Adoption & Data Quality",
        "School profile completeness",
        dataCompletenessRate.value,
        dataCompletenessRate.status
      ),
      executiveRow(
        "Adoption & Data Quality",
        "Schools needing attention",
        attentionSchools,
        attentionSchoolSummary
      ),

      executiveRow(
        "Financial Sustainability",
        "Expected monthly subscription revenue",
        formatCurrency(expectedRevenue.value),
        "Projection - not cash received"
      ),
      executiveRow(
        "Financial Sustainability",
        "Invoice value issued",
        formatCurrency(invoicedAmount.value),
        "Period"
      ),
      executiveRow(
        "Financial Sustainability",
        "Payments received",
        formatCurrency(paymentAmount.value),
        "Period"
      ),
      executiveRow(
        "Financial Sustainability",
        "Payment reminder SMS",
        smsValue?.paymentReminderSmsSent ?? null,
        "Period"
      ),

      executiveRow(
        "Sponsorship & Impact",
        "Sponsored schools",
        sponsoredSchools,
        "Current"
      ),
      executiveRow(
        "Sponsorship & Impact",
        "Sponsored share of portfolio",
        formatRate(sponsoredSchools, totalSchools).value,
        `${sponsoredSchools} of ${totalSchools} schools`
      ),
    ]);
  }

  async function captureMetric<T>(
    label: string,
    promise: Promise<T>
  ): Promise<MetricResult<T>> {
    try {
      return { value: await promise };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown data error";
      return {
        value: null,
        warning: `${label}: ${message}`,
      };
    }
  }

  function executiveRow(
    type: string,
    detail: string,
    value: string | number | null,
    status: string
  ): ReportRow {
    return {
      school: "Selected portfolio",
      type,
      detail,
      value: value === null ? "Data unavailable" : String(value),
      status,
    };
  }

  function getPeriodLabel() {
    const { startDate, endDate } = getDateRange();
    if (!startDate || !endDate) return "Date range not set";

    const formatDate = (value: string) =>
      new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`));

    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }

  function formatRate(
    numerator: number | null,
    denominator: number | null
  ) {
    if (
      numerator === null ||
      denominator === null ||
      denominator === 0
    ) {
      return {
        value: "Data unavailable",
        status: "A reliable denominator is not available",
      };
    }

    return {
      value: `${Math.round((numerator / denominator) * 100)}%`,
      status: `${numerator} of ${denominator}`,
    };
  }

  function formatCurrency(value: number | null) {
    if (value === null) return "Data unavailable";
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(value);
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
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

    ((data || []) as ReportSourceRow[]).forEach((item) => {
      const schoolName = getSchoolName(item.school_id);
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries()).map(([school, count]) => ({
        school,
        type: "Practitioners",
        detail: "Practitioner profiles",
        value: String(count),
        status: "Current",
      }))
    );
  }

  async function runSchoolActivityReport() {
    const schoolIds = getFilteredSchoolIds();
    const [sms, broadcasts, summaries, progressReports] = await Promise.all([
      getSmsImpactCounts(schoolIds),
      countTable("broadcasts", schoolIds, "created_at"),
      countTable("summaries", schoolIds, "created_at"),
      countTable("generated_reports", schoolIds, "generated_at"),
    ]);

    setRows([
      { school: "All Selected Schools", type: "School Activity", detail: "Payment reminder campaigns scheduled", value: String(sms.paymentReminderCampaigns), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Payment reminder SMS sent", value: String(sms.paymentReminderSmsSent), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Parent portal invitation SMS sent", value: String(sms.parentPortalInviteSmsSent), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Broadcasts", value: String(broadcasts), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Daily summaries", value: String(summaries), status: "Period" },
      { school: "All Selected Schools", type: "School Activity", detail: "Learner reports generated", value: String(progressReports), status: "Period" },
    ]);
  }

  async function runLearnerRequirementsReport() {
    const schoolIds = getFilteredSchoolIds();
    const [documents, receivedItems] = await Promise.all([
      countTable("learner_documents", schoolIds, "uploaded_at"),
      countTable("learner_stationery_checklist", schoolIds, "updated_at"),
    ]);

    setRows([
      {
        school: "All Selected Schools",
        type: "Learner Requirements",
        detail: "Learner documents uploaded",
        value: String(documents),
        status: "Period",
      },
      {
        school: "All Selected Schools",
        type: "Learner Requirements",
        detail: "Requirement items updated",
        value: String(receivedItems),
        status: "Period",
      },
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
      ((data || []) as ReportSourceRow[]).map((item) => ({
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
      ((data || []) as ReportSourceRow[]).map((item) => ({
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

    ((data || []) as ReportSourceRow[]).forEach((item) => {
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
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
      ((data || []) as ReportSourceRow[]).map((item) => ({
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
      ((data || []) as ReportSourceRow[]).map((item) => ({
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
        school: school.school_name || "Unnamed school",
        type: "Sponsored School",
        detail: getSponsorName(school.sponsor_programme_id),
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

    const sponsoredSchoolIds = sponsoredSchools.map((school) => Number(school.id));
    const [learners, teachers, sms, broadcasts] = await Promise.all([
      countTable("learners", sponsoredSchoolIds),
      countProfiles("teacher", sponsoredSchoolIds),
      getSmsImpactCounts(sponsoredSchoolIds),
      countTable("broadcasts", sponsoredSchoolIds, "created_at"),
    ]);

    setRows([
      { school: "Sponsored Schools", type: "Impact", detail: "Schools funded", value: String(sponsoredSchools.length), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Learners supported", value: String(learners), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Practitioners supported", value: String(teachers), status: "Current" },
      { school: "Sponsored Schools", type: "Impact", detail: "Payment reminder campaigns scheduled", value: String(sms.paymentReminderCampaigns), status: "Period" },
      { school: "Sponsored Schools", type: "Impact", detail: "Payment reminder SMS sent", value: String(sms.paymentReminderSmsSent), status: "Period" },
      { school: "Sponsored Schools", type: "Impact", detail: "Parent portal invitation SMS sent", value: String(sms.parentPortalInviteSmsSent), status: "Period" },
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
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

    const [sms, broadcasts, summaries, progressReports, learners, teachers] = await Promise.all([
      getSmsImpactCounts(schoolIds),
      countTable("broadcasts", schoolIds, "created_at"),
      countTable("summaries", schoolIds, "created_at"),
      countTable("generated_reports", schoolIds, "generated_at"),
      countTable("learners", schoolIds),
      countProfiles("teacher", schoolIds),
    ]);

    setRows([
      { school: "All Selected Schools", type: "Feature Usage", detail: "Learners", value: String(learners), status: "Current" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Practitioners", value: String(teachers), status: "Current" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Daily summaries", value: String(summaries), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Payment reminder campaigns scheduled", value: String(sms.paymentReminderCampaigns), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Payment reminder SMS sent", value: String(sms.paymentReminderSmsSent), status: "Period" },
      { school: "All Selected Schools", type: "Feature Usage", detail: "Parent portal invitation SMS sent", value: String(sms.parentPortalInviteSmsSent), status: "Period" },
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
      ((data || []) as ReportSourceRow[]).map((school) => ({
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

    const query = supabase
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

    ((data || []) as ReportSourceRow[]).forEach((item) => {
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

  async function runGeneratedReportTypeReport(reportSubtype: string, type: string) {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("generated_reports")
      .select("id, school_id, report_type, generated_at")
      .in("school_id", schoolIds)
      .eq("report_type", reportSubtype)
      .order("generated_at", { ascending: false });

    if (startDate) query = query.gte("generated_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("generated_at", `${endDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      setRows([{ school: "System", type, detail: "Report unavailable", value: error.message, status: "Check report data" }]);
      return;
    }

    const schoolMap = new Map<string, number>();
    ((data || []) as ReportSourceRow[]).forEach((item) => {
      const schoolName = getSchoolName(item.school_id);
      schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
    });

    setRows(
      Array.from(schoolMap.entries()).map(([school, count]) => ({
        school,
        type,
        detail: "Generated learner reports",
        value: String(count),
        status: "Period",
      }))
    );
  }

  async function runSmsDeliveryReport() {
    const sms = await getSmsImpactCounts(getFilteredSchoolIds());

    setRows([
      {
        school: "All Selected Schools",
        type: "SMS Delivery",
        detail: "Payment reminder campaigns scheduled",
        value: String(sms.paymentReminderCampaigns),
        status: "Period",
      },
      {
        school: "All Selected Schools",
        type: "SMS Delivery",
        detail: "Payment reminder SMS sent",
        value: String(sms.paymentReminderSmsSent),
        status: "Period",
      },
      {
        school: "All Selected Schools",
        type: "SMS Delivery",
        detail: "Parent portal invitation SMS sent",
        value: String(sms.parentPortalInviteSmsSent),
        status: "Period",
      },
    ]);
  }

  async function runParentEngagementImpactReport() {
    const schoolIds = getFilteredSchoolIds();
    const [broadcasts, sms] = await Promise.all([
      countTable("broadcasts", schoolIds, "created_at"),
      getSmsImpactCounts(schoolIds),
    ]);

    setRows([
      {
        school: "All Selected Schools",
        type: "Parent Engagement",
        detail: "Broadcasts created",
        value: String(broadcasts),
        status: "Period",
      },
      {
        school: "All Selected Schools",
        type: "Parent Engagement",
        detail: "Payment reminder SMS sent",
        value: String(sms.paymentReminderSmsSent),
        status: "Period",
      },
      {
        school: "All Selected Schools",
        type: "Parent Engagement",
        detail: "Parent portal invitation SMS sent",
        value: String(sms.parentPortalInviteSmsSent),
        status: "Period",
      },
    ]);
  }

  async function runProgressReportAnalytics() {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from("generated_reports")
      .select("id, school_id, report_type, generated_at")
      .in("school_id", schoolIds)
      .order("generated_at", { ascending: false });

    if (startDate) query = query.gte("generated_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("generated_at", `${endDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      setRows([{ school: "System", type: "Progress Report Analytics", detail: "Report unavailable", value: error.message, status: "Check report data" }]);
      return;
    }

    const counts = new Map<string, number>();
    ((data || []) as ReportSourceRow[]).forEach((item) => {
      const reportLabel = item.report_type === "grade-r"
        ? "Grade R"
        : item.report_type === "grade-rr"
          ? "Grade RR"
          : "Developmental";
      const key = `${getSchoolName(item.school_id)}|${reportLabel}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    setRows(
      Array.from(counts.entries()).map(([key, count]) => {
        const [school, reportLabel] = key.split("|");
        return {
          school,
          type: "Progress Reports",
          detail: `${reportLabel} learner reports`,
          value: String(count),
          status: "Period",
        };
      })
    );
  }

  async function runGenericTableReport(tableName: string, type: string, dateColumn: string, dateOnly = false) {
    const { startDate, endDate } = getDateRange();
    const schoolIds = getFilteredSchoolIds();

    let query = supabase
      .from(tableName)
      .select("*")
      .in("school_id", schoolIds);

    if (startDate) query = query.gte(dateColumn, startDate);
    if (endDate) query = query.lte(dateColumn, dateOnly ? endDate : `${endDate}T23:59:59`);

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

    ((data || []) as ReportSourceRow[]).forEach((item) => {
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

  async function countTable(tableName: string, schoolIds: number[], dateColumn?: string, dateOnly = false) {
    if (schoolIds.length === 0) return 0;

    let query = supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .in("school_id", schoolIds);

    if (dateColumn) {
      const { startDate, endDate } = getDateRange();
      if (startDate) query = query.gte(dateColumn, startDate);
      if (endDate) query = query.lte(dateColumn, dateOnly ? endDate : `${endDate}T23:59:59`);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`${tableName}: ${error.message}`);
    }
    return count || 0;
  }

  async function countFilteredTable(
    tableName: string,
    schoolIds: number[],
    dateColumn: string,
    dateOnly: boolean,
    filterColumn: string,
    filterValues: string[]
  ) {
    if (schoolIds.length === 0) return 0;

    let query = supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .in("school_id", schoolIds)
      .in(filterColumn, filterValues);

    const { startDate, endDate } = getDateRange();
    if (startDate) query = query.gte(dateColumn, startDate);
    if (endDate) {
      query = query.lte(
        dateColumn,
        dateOnly ? endDate : `${endDate}T23:59:59`
      );
    }

    const { count, error } = await query;
    if (error) {
      throw new Error(`${tableName}: ${error.message}`);
    }
    return count || 0;
  }

  async function countProfiles(role: string, schoolIds: number[]) {
    if (schoolIds.length === 0) return 0;

    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", role)
      .in("school_id", schoolIds);

    if (error) {
      throw new Error(`profiles: ${error.message}`);
    }
    return count || 0;
  }

  async function getActiveSchoolCount(schoolIds: number[]) {
    if (schoolIds.length === 0) return 0;

    const { startDate, endDate } = getDateRange();
    const activitySources = [
      { table: "attendance", dateColumn: "attendance_date", dateOnly: true },
      { table: "summaries", dateColumn: "created_at", dateOnly: false },
      { table: "broadcasts", dateColumn: "created_at", dateOnly: false },
      { table: "generated_reports", dateColumn: "generated_at", dateOnly: false },
    ];

    const results = await Promise.all(
      activitySources.map(async (source) => {
        let query = supabase
          .from(source.table)
          .select("school_id")
          .in("school_id", schoolIds);

        if (startDate) query = query.gte(source.dateColumn, startDate);
        if (endDate) {
          query = query.lte(
            source.dateColumn,
            source.dateOnly ? endDate : `${endDate}T23:59:59`
          );
        }

        const { data, error } = await query;
        if (error) {
          throw new Error(`${source.table}: ${error.message}`);
        }
        return (data || []) as SchoolActivityRow[];
      })
    );

    const activeSchoolIds = new Set(
      results
        .flat()
        .map((row) => row.school_id)
        .filter((schoolId): schoolId is number => schoolId !== null && schoolId !== undefined)
    );
    return activeSchoolIds.size;
  }

  async function getExpectedMonthlyRevenue(schoolIds: number[]) {
    if (schoolIds.length === 0) return 0;

    const { data, error } = await supabase
      .from("school_subscriptions")
      .select("monthly_price, status")
      .in("school_id", schoolIds)
      .in("status", ["active", "trial"]);

    if (error) {
      throw new Error(`school_subscriptions: ${error.message}`);
    }

    return ((data || []) as SubscriptionValueRow[]).reduce(
      (total, subscription) =>
        total + Number(subscription.monthly_price || 0),
      0
    );
  }

  async function getBillingAmount(
    tableName: "billing_invoices" | "subscription_payments",
    amountColumn: "total_amount" | "amount",
    dateColumn: "issue_date" | "payment_date",
    schoolIds: number[]
  ) {
    if (schoolIds.length === 0) return 0;

    const { startDate, endDate } = getDateRange();
    let query = supabase
      .from(tableName)
      .select(amountColumn)
      .in("school_id", schoolIds);

    if (startDate) query = query.gte(dateColumn, startDate);
    if (endDate) query = query.lte(dateColumn, endDate);

    const { data, error } = await query;
    if (error) {
      throw new Error(`${tableName}: ${error.message}`);
    }

    return ((data || []) as BillingAmountRow[]).reduce(
      (total, row) =>
        total + Number(row.total_amount ?? row.amount ?? 0),
      0
    );
  }

  function isInSelectedDateRange(value?: string | null) {
    if (!value) return false;

    const { startDate, endDate } = getDateRange();
    const date = value.slice(0, 10);

    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  }

  async function getSmsImpactCounts(schoolIds: number[]): Promise<SmsImpactCounts> {
    if (schoolIds.length === 0) {
      return {
        paymentReminderCampaigns: 0,
        paymentReminderSmsSent: 0,
        parentPortalInviteSmsSent: 0,
      };
    }

    const { startDate, endDate } = getDateRange();

    let campaignQuery = supabase
      .from("payment_reminders")
      .select("id", { count: "exact", head: true })
      .in("school_id", schoolIds);

    let reminderSmsQuery = supabase
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .in("school_id", schoolIds)
      .eq("status", "sent")
      .not("reminder_id", "is", null);

    if (startDate) {
      campaignQuery = campaignQuery.gte("scheduled_date", startDate);
      reminderSmsQuery = reminderSmsQuery.gte("sent_at", `${startDate}T00:00:00`);
    }

    if (endDate) {
      campaignQuery = campaignQuery.lte("scheduled_date", endDate);
      reminderSmsQuery = reminderSmsQuery.lte("sent_at", `${endDate}T23:59:59`);
    }

    const [campaignResult, reminderSmsResult, learnersResult] = await Promise.all([
      campaignQuery,
      reminderSmsQuery,
      supabase.from("learners").select("id").in("school_id", schoolIds),
    ]);

    if (campaignResult.error) {
      throw new Error(
        `payment_reminders: ${campaignResult.error.message}`
      );
    }
    if (reminderSmsResult.error) {
      throw new Error(`message_logs: ${reminderSmsResult.error.message}`);
    }
    if (learnersResult.error) {
      throw new Error(`learners: ${learnersResult.error.message}`);
    }

    const learnerIds = ((learnersResult.data || []) as LearnerIdRow[])
      .map((learner) => learner.id)
      .filter((id): id is string => Boolean(id));

    if (learnerIds.length === 0) {
      return {
        paymentReminderCampaigns: campaignResult.count || 0,
        paymentReminderSmsSent: reminderSmsResult.count || 0,
        parentPortalInviteSmsSent: 0,
      };
    }

    const { data: parentAccessRows, error: parentAccessError } = await supabase
      .from("parent_access")
      .select("phone, learner_id, invite_sent_at, invite_delivery_status")
      .in("learner_id", learnerIds);

    if (parentAccessError) {
      throw new Error(`parent_access: ${parentAccessError.message}`);
    }

    const sentInvites = new Set(
      ((parentAccessRows || []) as ParentAccessInviteRow[])
        .filter(
          (row) =>
            row.invite_delivery_status === "sent" &&
            isInSelectedDateRange(row.invite_sent_at)
        )
        .map((row) => `${row.phone || "unknown"}|${row.invite_sent_at}`)
    );

    return {
      paymentReminderCampaigns: campaignResult.count || 0,
      paymentReminderSmsSent: reminderSmsResult.count || 0,
      parentPortalInviteSmsSent: sentInvites.size,
    };
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

    const headers: (keyof ReportRow)[] = ["school", "type", "detail", "value", "status"];
    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] || "");
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

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Could not open print window. Please allow pop-ups and try again.");
      return;
    }

    if (reportType === "Executive Dashboard Report") {
      printWindow.document.write(
        buildExecutivePrintHtml({
          rows,
          preset: stakeholderPreset,
          periodLabel: getPeriodLabel(),
          lastRefreshed: lastRefreshed || "Not recorded",
          unavailableIndicatorCount: dataWarnings.length,
        })
      );
      printWindow.document.close();
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
          Generate operational and stakeholder-ready reports across DailyBloom
          schools.
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
              {reportGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.reports.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </optgroup>
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
                  {getSponsorName(Number(sponsorId))}
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

      {pageError ? (
        <div
          role="alert"
          style={{
            marginBottom: 18,
            border: "1px solid #E8A9B8",
            background: "#FFF1F4",
            color: "#8B324A",
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <strong>Reporting data needs attention</strong>
          <p style={{ margin: "5px 0 0", fontSize: 13 }}>{pageError}</p>
        </div>
      ) : null}

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
            className="db-collapse-action db-section-toggle"
            onClick={() => setShowResults((prev) => !prev)}
          >
            {showResults ? "Close" : "Open results"}
          </button>
        </div>

        {showResults ? (
          rows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 12 }}>
              No report results yet.
            </p>
          ) : reportType === "Executive Dashboard Report" ? (
            <ExecutiveStakeholderReport
              rows={rows}
              preset={stakeholderPreset}
              onPresetChange={setStakeholderPreset}
              periodLabel={getPeriodLabel()}
              lastRefreshed={lastRefreshed || "Run the report to refresh"}
              warnings={dataWarnings}
            />
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {rows.map((row, index) => (
                <div
                  key={`${row.school}-${row.type}-${index}`}
                  className={responsiveStyles.reportResultRow}
                  style={resultRow}
                >
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
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};

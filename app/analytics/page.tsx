"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";

type LearnerRow = {
  id: string;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
  created_at?: string | null;
};

type TeacherRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

type AttendanceRow = {
  id: number;
  learner_id?: string | null;
  learner_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
};

type TeacherAttendanceRow = {
  id: number;
  school_id?: number | null;
  teacher_id?: string | null;
  attendance_date?: string | null;
  status?: string | null;
};

type PaymentRow = {
  id: number;
  learner_name?: string | null;
  amount?: number | null;
  status?: string | null;
  payment_month?: number | null;
  payment_year?: number | null;
  payment_date?: string | null;
};

type SummaryRow = {
  id: number;
  learner_name?: string | null;
  whatsapp_sent?: boolean | null;
  created_at?: string | null;
};

type RequirementRow = {
  id: number;
  learner_id?: string | null;
  received?: boolean | null;
};

type DocumentRow = {
  id: number;
  learner_id?: string | null;
  document_type?: string | null;
  file_url?: string | null;
};

type ChartRow = {
  month: string;
  value: number;
};

const requiredDocuments = [
  "Birth Certificate",
  "Immunisation Card",
  "Parent / Guardian ID",
  "Contract",
];

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttendanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    setSchoolId(context.schoolId);

    const [
      learnersResult,
      teachersResult,
      attendanceResult,
      teacherAttendanceResult,
      paymentsResult,
      summariesResult,
      requirementsResult,
      documentsResult,
    ] = await Promise.all([
      supabase
        .from("learners")
        .select("id, name, class, classroom_id, date_of_birth, created_at")
        .eq("school_id", context.schoolId)
        .or("is_deleted.is.null,is_deleted.eq.false"),

      supabase
        .from("profiles")
        .select("id, full_name, name, email")
        .eq("school_id", context.schoolId)
        .eq("role", "teacher"),

      supabase
        .from("attendance")
        .select("id, learner_id, learner_name, status, attendance_date")
        .eq("school_id", context.schoolId),

      supabase
        .from("teacher_attendance")
        .select("id, school_id, teacher_id, attendance_date, status")
        .eq("school_id", context.schoolId),

      supabase
        .from("payments")
        .select(
          "id, learner_name, amount, status, payment_month, payment_year, payment_date"
        )
        .eq("school_id", context.schoolId),

      supabase
        .from("summaries")
        .select("id, learner_name, whatsapp_sent, created_at")
        .eq("school_id", context.schoolId),

      supabase
        .from("learner_stationery_checklist")
        .select("id, learner_id, received")
        .eq("school_id", context.schoolId),

      supabase
        .from("learner_documents")
        .select("id, learner_id, document_type, file_url")
        .eq("school_id", context.schoolId),
    ]);

    if (learnersResult.error) alert(learnersResult.error.message);
    if (teachersResult.error) alert(teachersResult.error.message);
    if (attendanceResult.error) alert(attendanceResult.error.message);
    if (teacherAttendanceResult.error) alert(teacherAttendanceResult.error.message);
    if (paymentsResult.error) alert(paymentsResult.error.message);
    if (summariesResult.error) alert(summariesResult.error.message);
    if (requirementsResult.error) alert(requirementsResult.error.message);
    if (documentsResult.error) alert(documentsResult.error.message);

    setLearners((learnersResult.data || []) as LearnerRow[]);
    setTeachers((teachersResult.data || []) as TeacherRow[]);
    setAttendance((attendanceResult.data || []) as AttendanceRow[]);
    setTeacherAttendance(
      (teacherAttendanceResult.data || []) as TeacherAttendanceRow[]
    );
    setPayments((paymentsResult.data || []) as PaymentRow[]);
    setSummaries((summariesResult.data || []) as SummaryRow[]);
    setRequirements((requirementsResult.data || []) as RequirementRow[]);
    setDocuments((documentsResult.data || []) as DocumentRow[]);

    setLoading(false);
  }

  const analytics = useMemo(() => {
    const todayDate = new Date().toISOString().split("T")[0];

    const totalLearners = learners.length;
    const totalTeachers = teachers.length;

    const presentCount = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "present"
    ).length;

    const absentCount = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "absent"
    ).length;

    const totalAttendanceRecords = presentCount + absentCount;

    const learnerAttendanceRate =
      totalAttendanceRecords > 0
        ? Math.round((presentCount / totalAttendanceRecords) * 100)
        : 0;

    const teacherPresentCount = teacherAttendance.filter(
      (item) => String(item.status || "").toLowerCase() === "present"
    ).length;

    const teacherAbsentCount = teacherAttendance.filter(
      (item) => String(item.status || "").toLowerCase() === "absent"
    ).length;

    const totalTeacherAttendanceRecords =
      teacherPresentCount + teacherAbsentCount;

    const teacherAttendanceRate =
      totalTeacherAttendanceRecords > 0
        ? Math.round((teacherPresentCount / totalTeacherAttendanceRecords) * 100)
        : 0;

    const teachersPresentToday = teacherAttendance.filter(
      (item) =>
        item.attendance_date === todayDate &&
        String(item.status || "").toLowerCase() === "present"
    ).length;

    const teachersAbsentToday = teacherAttendance.filter(
      (item) =>
        item.attendance_date === todayDate &&
        String(item.status || "").toLowerCase() === "absent"
    ).length;

    const paidPayments = payments.filter(
      (item) => String(item.status || "").toLowerCase() === "paid"
    );

    const unpaidPayments = payments.filter((item) =>
      ["pending", "partial", "overdue"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const totalCollected = paidPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalOutstanding = unpaidPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const collectionRate =
      payments.length > 0
        ? Math.round((paidPayments.length / payments.length) * 100)
        : 0;

    const sentSummaries = summaries.filter((item) => item.whatsapp_sent).length;

    const summarySendRate =
      summaries.length > 0
        ? Math.round((sentSummaries / summaries.length) * 100)
        : 0;

    const outstandingStationery = requirements.filter(
      (item) => item.received === false
    ).length;

    const missingDocuments = learners.reduce((sum, learner) => {
      const learnerDocuments = documents.filter(
        (document) => document.learner_id === learner.id
      );

      const missing = requiredDocuments.filter((requiredDocument) => {
        return !learnerDocuments.some(
          (document) =>
            document.document_type === requiredDocument && document.file_url
        );
      });

      return sum + missing.length;
    }, 0);

    const documentCompletionRate =
      learners.length > 0
        ? Math.max(
            0,
            Math.round(
              ((learners.length * requiredDocuments.length - missingDocuments) /
                (learners.length * requiredDocuments.length)) *
                100
            )
          )
        : 0;

    const schoolHealthScore = Math.round(
      (
        learnerAttendanceRate +
        teacherAttendanceRate +
        collectionRate +
        summarySendRate +
        documentCompletionRate
      ) / 5
    );

    return {
      totalLearners,
      totalTeachers,
      learnerAttendanceRate,
      teacherAttendanceRate,
      teachersPresentToday,
      teachersAbsentToday,
      schoolHealthScore,
      collectionRate,
      summarySendRate,
      documentCompletionRate,
      totalCollected,
      totalOutstanding,
      outstandingStationery,
      missingDocuments,
      learnerAbsentCount: absentCount,
      teacherAbsentCount,
      unpaidCount: unpaidPayments.length,
    };
  }, [
    learners,
    teachers,
    attendance,
    teacherAttendance,
    payments,
    summaries,
    requirements,
    documents,
  ]);

  const learnerAttendanceTrend = useMemo(() => {
    return buildAttendanceTrend(attendance, "attendance_date");
  }, [attendance]);

  const teacherAttendanceTrend = useMemo(() => {
    return buildAttendanceTrend(teacherAttendance, "attendance_date");
  }, [teacherAttendance]);

  const feeCollectionTrend = useMemo(() => {
    const monthMap = new Map<string, { paid: number; total: number }>();

    payments.forEach((payment) => {
      const monthKey = getMonthKey(
        payment.payment_date ||
          `${payment.payment_year || new Date().getFullYear()}-${String(
            payment.payment_month || 1
          ).padStart(2, "0")}-01`
      );

      if (!monthKey) return;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { paid: 0, total: 0 });
      }

      const entry = monthMap.get(monthKey);

      if (!entry) return;

      entry.total += 1;

      if (String(payment.status || "").toLowerCase() === "paid") {
        entry.paid += 1;
      }
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, value]) => ({
        month: formatMonthLabel(month),
        value: value.total > 0 ? Math.round((value.paid / value.total) * 100) : 0,
      }));
  }, [payments]);

  const learnerGrowthTrend = useMemo(() => {
    const months = getLastSixMonthKeys();

    return months.map((monthKey) => {
      const total = learners.filter((learner) => {
        if (!learner.created_at) return false;
        return getMonthKey(learner.created_at) <= monthKey;
      }).length;

      return {
        month: formatMonthLabel(monthKey),
        value: total,
      };
    });
  }, [learners]);

  if (loading) {
    return <p>Loading school analytics...</p>;
  }

  return (
    <SubscriptionGuard schoolId={schoolId} featureKey="advanced_school_analytics">
      <div>
        <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 className="db-page-title">School Analytics</h2>
          <p className="db-page-subtitle">
            View school health, learner attendance, teacher attendance, payments,
            parent communication and learner requirement insights.
          </p>
        </div>

        <div
          className="db-card db-card-lavender"
          style={{ padding: 20, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>School Health Score</h3>
          <p style={healthScore}>{analytics.schoolHealthScore}%</p>
          <p style={smallText}>
            Based on learner attendance, teacher attendance, fee collection,
            parent communication and document completion.
          </p>
        </div>

        <div style={grid}>
          <InsightCard title="Learners" value={analytics.totalLearners} helper="Active learners" />
          <InsightCard title="Teachers" value={analytics.totalTeachers} helper="Active teachers" />
          <InsightCard title="Learner Attendance Rate" value={`${analytics.learnerAttendanceRate}%`} helper="Learner present vs absent records" />
          <InsightCard title="Teacher Attendance Rate" value={`${analytics.teacherAttendanceRate}%`} helper="Teacher present vs absent records" />
          <InsightCard title="Teachers Present Today" value={analytics.teachersPresentToday} helper="Marked present today" />
          <InsightCard title="Teachers Absent Today" value={analytics.teachersAbsentToday} helper="Marked absent today" />
          <InsightCard title="Collection Rate" value={`${analytics.collectionRate}%`} helper="Paid payment records" />
          <InsightCard title="Daily Summary Send Rate" value={`${analytics.summarySendRate}%`} helper="Summaries marked as sent" />
          <InsightCard title="Document Completion" value={`${analytics.documentCompletionRate}%`} helper="Required documents uploaded" />
          <InsightCard title="Fees Collected" value={`R${analytics.totalCollected.toFixed(2)}`} helper="Paid records total" />
          <InsightCard title="Outstanding Fees" value={`R${analytics.totalOutstanding.toFixed(2)}`} helper="Pending, partial and overdue records" />
          <InsightCard title="Unpaid Records" value={analytics.unpaidCount} helper="Payment records needing follow-up" />
          <InsightCard title="Learner Absence Records" value={analytics.learnerAbsentCount} helper="Total learner absent records" />
          <InsightCard title="Teacher Absence Records" value={analytics.teacherAbsentCount} helper="Total teacher absence records" />
          <InsightCard title="Outstanding Stationery" value={analytics.outstandingStationery} helper="Items not yet received" />
          <InsightCard title="Missing Documents" value={analytics.missingDocuments} helper="Required learner documents missing" />
        </div>

        <div className="db-card db-card-blue" style={{ padding: 18, marginTop: 18 }}>
          <h3 style={sectionTitle}>Attendance Trends</h3>

          <div style={chartGrid}>
            <AnalyticsChart
              title="Learner Attendance Trend"
              data={learnerAttendanceTrend}
              suffix="%"
            />

            <AnalyticsChart
              title="Teacher Attendance Trend"
              data={teacherAttendanceTrend}
              suffix="%"
            />
          </div>
        </div>

        <div className="db-card db-card-green" style={{ padding: 18, marginTop: 18 }}>
          <h3 style={sectionTitle}>Financial Trend</h3>

          <AnalyticsChart
            title="Fee Collection Rate"
            data={feeCollectionTrend}
            suffix="%"
            chartType="bar"
          />
        </div>

        <div className="db-card db-card-yellow" style={{ padding: 18, marginTop: 18 }}>
          <h3 style={sectionTitle}>School Growth</h3>

          <AnalyticsChart
            title="Learner Growth Trend"
            data={learnerGrowthTrend}
          />
        </div>

        <div
          className="db-card db-card-yellow"
          style={{ padding: 18, marginTop: 18 }}
        >
          <h3 style={sectionTitle}>Areas Needing Attention</h3>

          <ul style={listStyle}>
            {analytics.teachersAbsentToday > 0 && (
              <li>{analytics.teachersAbsentToday} teacher(s) absent today.</li>
            )}

            {analytics.missingDocuments > 0 && (
              <li>{analytics.missingDocuments} learner document(s) still missing.</li>
            )}

            {analytics.outstandingStationery > 0 && (
              <li>{analytics.outstandingStationery} stationery item(s) still outstanding.</li>
            )}

            {analytics.unpaidCount > 0 && (
              <li>{analytics.unpaidCount} payment record(s) need follow-up.</li>
            )}

            {analytics.learnerAbsentCount > 0 && (
              <li>{analytics.learnerAbsentCount} learner absence record(s) captured.</li>
            )}

            {analytics.teacherAbsentCount > 0 && (
              <li>{analytics.teacherAbsentCount} teacher absence record(s) captured.</li>
            )}

            {analytics.schoolHealthScore >= 80 && (
              <li>The school is performing well overall.</li>
            )}
          </ul>
        </div>
      </div>
    </SubscriptionGuard>
  );
}

function InsightCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="db-card db-card-blue" style={{ padding: 16 }}>
      <strong>{title}</strong>
      <p style={cardValue}>{value}</p>
      <p style={smallText}>{helper}</p>
    </div>
  );
}

function AnalyticsChart({
  title,
  data,
  suffix = "",
  chartType = "line",
}: {
  title: string;
  data: ChartRow[];
  suffix?: string;
  chartType?: "line" | "bar";
}) {
  return (
    <div style={chartCard}>
      <strong>{title}</strong>

      {data.length === 0 ? (
        <p style={smallText}>No trend data available yet.</p>
      ) : (
        <div style={{ width: "100%", height: 260, marginTop: 12 }}>
          <ResponsiveContainer>
            {chartType === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}${suffix}`} />
                <Bar dataKey="value" />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}${suffix}`} />
                <Line type="monotone" dataKey="value" strokeWidth={2} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function buildAttendanceTrend(
  rows: Array<{ status?: string | null; attendance_date?: string | null }>,
  dateKey: "attendance_date"
) {
  const monthMap = new Map<string, { present: number; absent: number }>();

  rows.forEach((row) => {
    const monthKey = getMonthKey(row[dateKey] || "");

    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { present: 0, absent: 0 });
    }

    const entry = monthMap.get(monthKey);

    if (!entry) return;

    const status = String(row.status || "").toLowerCase();

    if (status === "present") entry.present += 1;
    if (status === "absent") entry.absent += 1;
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, value]) => {
      const total = value.present + value.absent;

      return {
        month: formatMonthLabel(month),
        value: total > 0 ? Math.round((value.present / total) * 100) : 0,
      };
    });
}

function getMonthKey(dateValue: string) {
  if (!dateValue) return "";

  const dateOnly = String(dateValue).split("T")[0];

  if (dateOnly.length < 7) return "";

  return dateOnly.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) return monthKey;

  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
}

function getLastSixMonthKeys() {
  const months: string[] = [];
  const today = new Date();

  for (let index = 5; index >= 0; index--) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    months.push(`${year}-${month}`);
  }

  return months;
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const chartGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
};

const chartCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 16,
  padding: 16,
};

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 800 as const,
};

const healthScore = {
  margin: "8px 0",
  fontSize: 46,
  fontWeight: 900,
  color: "#2D2A3E",
};

const cardValue = {
  margin: "8px 0 0 0",
  fontSize: 28,
  fontWeight: 800,
  color: "#2D2A3E",
};

const smallText = {
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
  lineHeight: 1.4,
};

const listStyle = {
  margin: 0,
  paddingLeft: 20,
  color: "#2D2A3E",
  lineHeight: 1.8,
};
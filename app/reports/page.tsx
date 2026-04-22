"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
};

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  date_of_birth?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
};

type AttendanceItem = {
  id: number;
  learner_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
  school_id?: number | null;
};

type SummaryItem = {
  id: number;
  learner_name?: string | null;
  mood?: string | null;
  health_safety?: string | null;
  meals?: string | null;
  rest?: string | null;
  today_highlight?: string | null;
  teacher_notes?: string | null;
  created_at?: string | null;
  school_id?: number | null;
};

type PaymentItem = {
  id: number;
  learner_name?: string | null;
  amount?: number | null;
  payment_date?: string | null;
  status?: string | null;
  payment_month?: number | null;
  payment_year?: number | null;
  parent_phone?: string | null;
  school_id?: number | null;
};

type ActivityItem = {
  id: number;
  school_id?: number | null;
  activity_date?: string | null;
  classroom?: string | null;
  subject?: string | null;
  activity_note?: string | null;
  created_at?: string | null;
};

type ReportRow = Record<string, string | number | null>;

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayString = `${yyyy}-${mm}-${dd}`;

  const [reportType, setReportType] = useState("attendance");
  const [startDate, setStartDate] = useState(todayString);
  const [endDate, setEndDate] = useState(todayString);
  const [selectedClassroom, setSelectedClassroom] = useState("");

  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error || !context.schoolId) {
      router.push("/login");
      return;
    }

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchClassrooms(context.schoolId),
      fetchLearners(context.schoolId),
      fetchAttendance(context.schoolId),
      fetchSummaries(context.schoolId),
      fetchPayments(context.schoolId),
      fetchActivities(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (!error) {
      setClassrooms((data || []) as ClassroomItem[]);
    }
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, date_of_birth, parent_phone, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (!error) {
      setLearners((data || []) as LearnerItem[]);
    }
  }

  async function fetchAttendance(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, learner_name, status, attendance_date, school_id")
      .eq("school_id", currentSchoolId)
      .order("attendance_date", { ascending: false });

    if (!error) {
      setAttendance((data || []) as AttendanceItem[]);
    }
  }

  async function fetchSummaries(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("summaries")
      .select(
        "id, learner_name, mood, health_safety, meals, rest, today_highlight, teacher_notes, created_at, school_id"
      )
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (!error) {
      setSummaries((data || []) as SummaryItem[]);
    }
  }

  async function fetchPayments(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, learner_name, amount, payment_date, status, payment_month, payment_year, parent_phone, school_id"
      )
      .eq("school_id", currentSchoolId)
      .order("payment_date", { ascending: false });

    if (!error) {
      setPayments((data || []) as PaymentItem[]);
    }
  }

  async function fetchActivities(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, school_id, activity_date, classroom, subject, activity_note, created_at")
      .eq("school_id", currentSchoolId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error) {
      setActivities((data || []) as ActivityItem[]);
    }
  }

  function learnerMatchesClassroom(learnerName?: string | null) {
    if (!selectedClassroom) return true;

    const learner = learners.find(
      (item) =>
        String(item.name || "").trim().toLowerCase() ===
        String(learnerName || "").trim().toLowerCase()
    );

    return (
      String(learner?.class || "").trim().toLowerCase() ===
      selectedClassroom.trim().toLowerCase()
    );
  }

  function activityMatchesClassroom(classroom?: string | null) {
    if (!selectedClassroom) return true;
    return String(classroom || "").trim().toLowerCase() === selectedClassroom.trim().toLowerCase();
  }

  function isDateWithinRange(dateValue?: string | null, includeTime = false) {
    if (!dateValue) return false;

    const raw = includeTime ? dateValue.slice(0, 10) : dateValue;
    return raw >= startDate && raw <= endDate;
  }

  function generateReport() {
    setGenerating(true);

    let reportRows: ReportRow[] = [];

    if (reportType === "attendance") {
      reportRows = attendance
        .filter((item) => isDateWithinRange(item.attendance_date))
        .filter((item) => learnerMatchesClassroom(item.learner_name))
        .map((item) => {
          const learner = learners.find(
            (l) =>
              String(l.name || "").trim().toLowerCase() ===
              String(item.learner_name || "").trim().toLowerCase()
          );

          return {
            Date: item.attendance_date || "",
            Learner: item.learner_name || "",
            Classroom: learner?.class || "",
            Status: item.status || "",
          };
        });
    }

    if (reportType === "summaries") {
      reportRows = summaries
        .filter((item) => isDateWithinRange(item.created_at, true))
        .filter((item) => learnerMatchesClassroom(item.learner_name))
        .map((item) => {
          const learner = learners.find(
            (l) =>
              String(l.name || "").trim().toLowerCase() ===
              String(item.learner_name || "").trim().toLowerCase()
          );

          return {
            Date: item.created_at ? item.created_at.slice(0, 10) : "",
            Learner: item.learner_name || "",
            Classroom: learner?.class || "",
            "Health & Safety": item.health_safety || "",
            Meals: item.meals || "",
            Rest: item.rest || "",
            Mood: item.mood || "",
            "Today's Highlight": item.today_highlight || "",
            "Teacher Notes": item.teacher_notes || "",
          };
        });
    }

    if (reportType === "payments") {
      reportRows = payments
        .filter((item) => isDateWithinRange(item.payment_date))
        .filter((item) => learnerMatchesClassroom(item.learner_name))
        .map((item) => {
          const learner = learners.find(
            (l) =>
              String(l.name || "").trim().toLowerCase() ===
              String(item.learner_name || "").trim().toLowerCase()
          );

          return {
            Date: item.payment_date || "",
            Learner: item.learner_name || "",
            Classroom: learner?.class || "",
            Amount:
              item.amount !== null && item.amount !== undefined
                ? Number(item.amount).toFixed(2)
                : "",
            Status: item.status || "",
            Month: item.payment_month || "",
            Year: item.payment_year || "",
          };
        });
    }

    if (reportType === "incidents") {
      reportRows = summaries
        .filter((item) => isDateWithinRange(item.created_at, true))
        .filter((item) => learnerMatchesClassroom(item.learner_name))
        .filter((item) => {
          const value = String(item.health_safety || "").trim().toLowerCase();
          return value && value !== "no incident";
        })
        .map((item) => {
          const learner = learners.find(
            (l) =>
              String(l.name || "").trim().toLowerCase() ===
              String(item.learner_name || "").trim().toLowerCase()
          );

          return {
            Date: item.created_at ? item.created_at.slice(0, 10) : "",
            Learner: item.learner_name || "",
            Classroom: learner?.class || "",
            Incident: item.health_safety || "",
            Mood: item.mood || "",
            "Teacher Notes": item.teacher_notes || "",
          };
        });
    }

    if (reportType === "activities") {
      reportRows = activities
        .filter((item) => isDateWithinRange(item.activity_date))
        .filter((item) => activityMatchesClassroom(item.classroom))
        .map((item) => ({
          Date: item.activity_date || "",
          Classroom: item.classroom || "",
          Subject: item.subject || "",
          Activity: item.activity_note || "",
        }));
    }

    setRows(reportRows);
    setGenerating(false);
  }

  function exportCsv() {
    if (!rows.length) {
      alert("Generate a report first.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${reportType}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const reportSummaryText = useMemo(() => {
    if (!rows.length) return "No report generated yet.";
    return `${rows.length} record${rows.length === 1 ? "" : "s"} found.`;
  }, [rows]);

  if (loading) {
    return <p>Loading reports...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Reports Center</h2>
        <p className="db-page-subtitle">
          Generate school-wide reports over a date range and export them to CSV.
        </p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Report Filters</h3>

        <select
          className="db-input"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
        >
          <option value="attendance">Attendance Report</option>
          <option value="summaries">Summaries Report</option>
          <option value="payments">Payments Report</option>
          <option value="incidents">Incidents Report</option>
          <option value="activities">Activities Report</option>
        </select>

        <input
          className="db-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <input
          className="db-input"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <select
          className="db-input"
          value={selectedClassroom}
          onChange={(e) => setSelectedClassroom(e.target.value)}
        >
          <option value="">All Classrooms</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.classroom_name || ""}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="db-button-primary"
            onClick={generateReport}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Report"}
          </button>

          <button
            className="db-button-secondary"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Report Results</h3>
          <p style={{ margin: 0, color: "var(--db-text-soft)" }}>{reportSummaryText}</p>
        </div>

        {rows.length === 0 ? (
          <p className="db-helper">Choose filters and generate a report.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#FFFFFF",
                border: "1px solid #F0E3D8",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <thead>
                <tr style={{ background: "#FFF8F2" }}>
                  {Object.keys(rows[0]).map((header) => (
                    <th
                      key={header}
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom: "1px solid #F0E3D8",
                        color: "#2D2A3E",
                        fontSize: "14px",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {Object.keys(rows[0]).map((header) => (
                      <td
                        key={header}
                        style={{
                          padding: "12px",
                          borderBottom: "1px solid #F7EEE7",
                          color: "#5B5675",
                          fontSize: "14px",
                          verticalAlign: "top",
                        }}
                      >
                        {String(row[header] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
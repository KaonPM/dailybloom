"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type Learner = {
  id: number;
  name: string;
  class?: string | null;
};

type ReportRow = {
  date: string;
  learner: string;
  classroom: string;
  type: string;
  detail: string;
  extra: string;
};

const reportTypes = [
  "Learner Attendance",
  "Teacher Attendance",
  "Learner Register",
  "Daily Summaries",
  "Classroom Activities",
  "Events",
  "Health & Safety Incidents",
  "Payments",
  "Outstanding Fees",
];

const scopeOptions = ["Entire School", "Classroom", "Learner"];

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [teacherClassroom, setTeacherClassroom] = useState("");

  const [learners, setLearners] = useState<Learner[]>([]);
  const [reportType, setReportType] = useState("Learner Attendance");
  const [scope, setScope] = useState("Entire School");
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [selectedLearner, setSelectedLearner] = useState("");

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [showReportResults, setShowReportResults] = useState(false);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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

    const { profile } = await getCurrentProfile();

    const currentRole = String(profile?.role || "");
    const currentTeacherClass =
      currentRole === "teacher" && profile?.classroom_name
        ? String(profile.classroom_name)
        : "";

    setRole(currentRole);
    setTeacherClassroom(currentTeacherClass);
    setSchoolId(context.schoolId);

    await fetchLearners(context.schoolId, currentTeacherClass);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number, teacherClass: string) {
    let query = supabase
      .from("learners")
      .select("id, name, class")
      .eq("school_id", currentSchoolId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("name", { ascending: true });

    if (teacherClass) {
      query = query.eq("class", teacherClass);
      setScope("Classroom");
      setSelectedClassroom(teacherClass);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  const classrooms = useMemo(() => {
    const unique = new Set<string>();

    learners.forEach((learner) => {
      if (learner.class) unique.add(learner.class);
    });

    return Array.from(unique).sort();
  }, [learners]);

  const scopedLearners = useMemo(() => {
    if (scope === "Learner" && selectedLearner) {
      return learners.filter((learner) => learner.name === selectedLearner);
    }

    if (scope === "Classroom" && selectedClassroom) {
      return learners.filter((learner) => learner.class === selectedClassroom);
    }

    return learners;
  }, [learners, scope, selectedClassroom, selectedLearner]);

  const scopedLearnerNames = useMemo(() => {
    return scopedLearners.map((learner) => learner.name);
  }, [scopedLearners]);

  function getLearnerClass(learnerName: string) {
    const match = learners.find(
      (learner) =>
        String(learner.name || "").trim().toLowerCase() ===
        String(learnerName || "").trim().toLowerCase()
    );

    return match?.class || "Unassigned";
  }

  function isWithinRange(dateValue: string) {
    if (!dateValue) return false;

    const dateOnly = dateValue.split("T")[0];

    return dateOnly >= fromDate && dateOnly <= toDate;
  }

  function isInScopeByLearner(learnerName: string) {
    if (scope === "Entire School") return true;

    return scopedLearnerNames
      .map((name) => String(name).trim().toLowerCase())
      .includes(String(learnerName).trim().toLowerCase());
  }

  function isInScopeByClass(classValue: string) {
    if (scope === "Entire School") return true;

    if (scope === "Classroom") {
      return String(classValue || "").trim() === selectedClassroom;
    }

    return true;
  }

  async function runReport() {
    if (!schoolId) return;

    if (fromDate > toDate) {
      alert("From date cannot be after To date.");
      return;
    }

    if (scope === "Classroom" && !selectedClassroom) {
      alert("Please select a classroom.");
      return;
    }

    if (scope === "Learner" && !selectedLearner) {
      alert("Please select a learner.");
      return;
    }

    setRunning(true);

    if (reportType === "Learner Attendance") await runAttendanceReport();
    if (reportType === "Teacher Attendance") await runTeacherAttendanceReport();
    if (reportType === "Learner Register") await runLearnerRegisterReport();
    if (reportType === "Daily Summaries") await runSummariesReport();
    if (reportType === "Classroom Activities") await runActivitiesReport();
    if (reportType === "Health & Safety Incidents") await runIncidentsReport();
    if (reportType === "Payments") await runPaymentsReport();
    if (reportType === "Outstanding Fees") await runOutstandingFeesReport();
    if (reportType === "Events") await runEventsReport();

    setShowReportResults(true);
    setRunning(false);
  }

  async function runAttendanceReport() {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", schoolId)
      .gte("attendance_date", fromDate)
      .lte("attendance_date", toDate)
      .order("attendance_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => isInScopeByLearner(item.learner_name))
      .map((item: any) => ({
        date: item.attendance_date || "",
        learner: item.learner_name || "",
        classroom: getLearnerClass(item.learner_name),
        type: "Learner Attendance",
        detail: item.status || "",
        extra: "",
      }));

    setReportRows(rows);
  }

  async function runTeacherAttendanceReport() {
    const { data, error } = await supabase
      .from("teacher_attendance")
      .select("*")
      .eq("school_id", schoolId)
      .gte("attendance_date", fromDate)
      .lte("attendance_date", toDate)
      .order("attendance_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || []).map((item: any) => ({
      date: item.attendance_date || "",
      learner: item.teacher_name || "Unnamed teacher",
      classroom: "Staff",
      type: "Teacher Attendance",
      detail: item.status || "",
      extra: item.notes || "",
    }));

    setReportRows(rows);
  }

  async function runLearnerRegisterReport() {
    let query = supabase
      .from("learners")
      .select(
        `
        id,
        name,
        legal_name,
        class,
        date_of_birth,
        gender,
        guardian_name,
        parent_phone,
        parent_email,
        receiving_school,
        is_deleted
      `
      )
      .eq("school_id", schoolId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("name", { ascending: true });

    if (scope === "Classroom" && selectedClassroom) {
      query = query.eq("class", selectedClassroom);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => {
        if (scope === "Learner" && selectedLearner) {
          return item.name === selectedLearner;
        }

        return true;
      })
      .map((item: any) => ({
       date: "",
       learner: item.name || item.legal_name || "Unnamed learner",
       classroom: item.class || "Unassigned",
       type: "Learner Register",
       detail: `DOB: ${item.date_of_birth || "Not added"} | Gender: ${
       item.gender || "Not added"
      }`,
       extra: `Guardian: ${item.guardian_name || "Not added"} | Phone: ${
       item.parent_phone || "Not added"
      } | Email: ${item.parent_email || "Not added"} | Receiving School: ${
       item.receiving_school || "Not added"
      }`,
      }));

    setReportRows(rows);
  }

  async function runSummariesReport() {
    const { data, error } = await supabase
      .from("summaries")
      .select("*")
      .eq("school_id", schoolId)
      .gte("created_at", `${fromDate} 00:00:00`)
      .lte("created_at", `${toDate} 23:59:59`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => isInScopeByLearner(item.learner_name))
      .map((item: any) => ({
        date: item.created_at ? item.created_at.split("T")[0] : "",
        learner: item.learner_name || "",
        classroom: getLearnerClass(item.learner_name),
        type: "Daily Summary",
        detail: `Mood: ${item.mood || "N/A"} | Meals: ${
          item.meals || "N/A"
        } | Rest: ${item.rest || "N/A"}`,
        extra: item.teacher_notes || "",
      }));

    setReportRows(rows);
  }

  async function runPaymentsReport() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => {
        const dateValue =
          item.payment_date ||
          item.created_at ||
          `${item.payment_year || new Date().getFullYear()}-${String(
            item.payment_month || 1
          ).padStart(2, "0")}-01`;

        return (
          isWithinRange(String(dateValue)) &&
          isInScopeByLearner(item.learner_name)
        );
      })
      .map((item: any) => ({
        date:
          item.payment_date ||
          item.created_at?.split("T")[0] ||
          `${item.payment_year || ""}-${String(item.payment_month || "").padStart(
            2,
            "0"
          )}`,
        learner: item.learner_name || "",
        classroom: getLearnerClass(item.learner_name),
        type: "Payment",
        detail: item.status || "No status",
        extra: item.amount ? `Amount: ${item.amount}` : "",
      }));

    setReportRows(rows);
  }

  async function runOutstandingFeesReport() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("school_id", schoolId);

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => {
        const status = String(item.status || "").trim().toLowerCase();

        const dateValue =
          item.payment_date ||
          item.created_at ||
          `${item.payment_year || new Date().getFullYear()}-${String(
            item.payment_month || 1
          ).padStart(2, "0")}-01`;

        return (
          status !== "paid" &&
          isWithinRange(String(dateValue)) &&
          isInScopeByLearner(item.learner_name)
        );
      })
      .map((item: any) => ({
        date:
          item.payment_date ||
          item.created_at?.split("T")[0] ||
          `${item.payment_year || ""}-${String(item.payment_month || "").padStart(
            2,
            "0"
          )}`,
        learner: item.learner_name || "",
        classroom: getLearnerClass(item.learner_name),
        type: "Outstanding Fee",
        detail: item.status || "Unpaid",
        extra: item.amount ? `Amount: ${item.amount}` : "",
      }));

    setReportRows(rows);
  }

  async function runIncidentsReport() {
    const { data, error } = await supabase
      .from("summaries")
      .select("*")
      .eq("school_id", schoolId)
      .gte("created_at", `${fromDate} 00:00:00`)
      .lte("created_at", `${toDate} 23:59:59`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => isInScopeByLearner(item.learner_name))
      .filter((item: any) => {
        const value = String(item.health_safety || "").trim().toLowerCase();
        return value && value !== "no incident";
      })
      .map((item: any) => ({
        date: item.created_at ? item.created_at.split("T")[0] : "",
        learner: item.learner_name || "",
        classroom: getLearnerClass(item.learner_name),
        type: "Health & Safety Incident",
        detail: item.health_safety || "",
        extra: item.teacher_notes || "",
      }));

    setReportRows(rows);
  }

  async function runActivitiesReport() {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("school_id", schoolId)
      .gte("activity_date", fromDate)
      .lte("activity_date", toDate)
      .order("activity_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || [])
      .filter((item: any) => {
        const classValue = item.class_name || item.classroom || "";
        return isInScopeByClass(classValue);
      })
      .map((item: any) => ({
        date: item.activity_date || "",
        learner: scope === "Learner" ? selectedLearner : "Class activity",
        classroom: item.class_name || item.classroom || "All classes",
        type: "Classroom Activity",
        detail: `${item.subject || "No subject"} | ${item.title || "No title"}`,
        extra: item.description || "",
      }));

    setReportRows(rows);
  }

  async function runEventsReport() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("school_id", schoolId)
      .gte("event_date", fromDate)
      .lte("event_date", toDate)
      .order("event_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows: ReportRow[] = (data || []).map((item: any) => ({
      date: item.event_date || "",
      learner: "School Event",
      classroom: item.classroom || item.class_name || "Entire School",
      type: "Event",
      detail: item.title || item.event_name || "Untitled event",
      extra: item.description || item.notes || "",
    }));

    setReportRows(rows);
  }

  function exportCsv() {
    if (reportRows.length === 0) {
      alert("No report results to export.");
      return;
    }

    const headers = ["date", "learner", "classroom", "type", "detail", "extra"];

    const csvRows = [
      headers.join(","),
      ...reportRows.map((row) =>
        headers
          .map((header) => {
            const value = String((row as any)[header] || "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `${reportType
      .toLowerCase()
      .replace(/\s+/g, "-")}-report-${fromDate}-to-${toDate}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p>Loading reports...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Reports</h2>
        <p className="db-page-subtitle">
          Filter reports by school, classroom, learner, type, and date range.
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
              onChange={(e) => setReportType(e.target.value)}
            >
              {reportTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelText}>Report Scope</p>
            <select
              className="db-input"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelectedClassroom("");
                setSelectedLearner("");
              }}
              disabled={role === "teacher"}
            >
              {scopeOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          {scope === "Classroom" ? (
            <div>
              <p style={labelText}>Classroom</p>
              <select
                className="db-input"
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                disabled={role === "teacher"}
              >
                <option value="">Select classroom</option>
                {classrooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === "Learner" ? (
            <div>
              <p style={labelText}>Learner</p>
              <select
                className="db-input"
                value={selectedLearner}
                onChange={(e) => setSelectedLearner(e.target.value)}
              >
                <option value="">Select learner</option>
                {learners.map((learner) => (
                  <option key={learner.id} value={learner.name}>
                    {learner.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <p style={labelText}>From</p>
            <input
              type="date"
              className="db-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>To</p>
            <input
              type="date"
              className="db-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            type="button"
            className="db-button-primary"
            onClick={runReport}
            disabled={running}
          >
            {running ? "Running..." : "Run Report"}
          </button>

          <button type="button" className="db-button-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>Report Results ({reportRows.length})</h3>
            <p style={smallText}>
              Open only when you need to review the report output.
            </p>
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowReportResults((prev) => !prev)}
          >
            {showReportResults ? "Hide" : "View Results"}
          </button>
        </div>

        {showReportResults ? (
          reportRows.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 12 }}>
              No report results yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {reportRows.map((row, index) => (
                <div key={`${row.type}-${index}`} style={resultRow}>
                  <div>
                    <strong>{row.date}</strong>
                    <p style={smallText}>
                      {row.learner} | {row.classroom}
                    </p>
                  </div>

                  <div>
                    <strong>{row.type}</strong>
                    <p style={smallText}>{row.detail}</p>
                    {row.extra ? <p style={smallText}>{row.extra}</p> : null}
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
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  gridTemplateColumns: "180px 1fr",
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type Learner = {
  id: number;
  name: string;
  class: string;
};

type AttendanceRow = {
  id?: number;
  school_id?: number;
  learner_name?: string;
  status?: string;
  attendance_date?: string;
  created_at?: string;
};

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];

  const [learners, setLearners] = useState<Learner[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState("");

  const [attendance, setAttendance] = useState<Record<string, string>>({});

  const [selectedLearnerName, setSelectedLearnerName] = useState("");
  const [learnerHistoryRows, setLearnerHistoryRows] = useState<AttendanceRow[]>([]);
  const [classHistoryRows, setClassHistoryRows] = useState<AttendanceRow[]>([]);

  const [learnerFromDate, setLearnerFromDate] = useState(today);
  const [learnerToDate, setLearnerToDate] = useState(today);

  const [classFromDate, setClassFromDate] = useState(today);
  const [classToDate, setClassToDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile } = await getCurrentProfile();

    if (!profile) {
      setLoading(false);
      return;
    }

    const currentSchoolId = Number(profile.school_id);
    const currentClassroom = String(profile.classroom_name || "");

    setSchoolId(currentSchoolId);
    setClassroomName(currentClassroom);

    const { data, error } = await supabase
      .from("learners")
      .select("id,name,class")
      .eq("school_id", currentSchoolId)
      .eq("class", currentClassroom)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLearners((data || []) as Learner[]);
    await loadTodayAttendance(currentSchoolId);

    setLoading(false);
  }

  async function loadTodayAttendance(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("attendance_date", today);

    if (error) {
      alert(error.message);
      return;
    }

    const map: Record<string, string> = {};

    (data || []).forEach((row: AttendanceRow) => {
      if (row.learner_name && row.status) {
        map[row.learner_name] = row.status;
      }
    });

    setAttendance(map);
  }

  function mark(name: string, status: "present" | "absent") {
    setAttendance((prev) => ({
      ...prev,
      [name]: prev[name] === status ? "" : status,
    }));
  }

  async function saveAttendance() {
    if (!schoolId) return;

    const rows = learners
      .filter((learner) => attendance[learner.name])
      .map((learner) => ({
        school_id: schoolId,
        learner_name: learner.name,
        status: attendance[learner.name],
        attendance_date: today,
      }));

    if (rows.length === 0) {
      alert("Please mark at least one learner.");
      return;
    }

    setSaving(true);

    const learnerNames = rows.map((row) => row.learner_name);

    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("school_id", schoolId)
      .eq("attendance_date", today)
      .in("learner_name", learnerNames);

    if (deleteError) {
      alert(deleteError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("attendance").insert(rows);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await loadTodayAttendance(schoolId);

    setSaving(false);
    alert("Attendance saved.");
  }

  async function viewLearnerHistory(learnerName: string) {
    if (!schoolId) return;

    setSelectedLearnerName(learnerName);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", schoolId)
      .eq("learner_name", learnerName)
      .gte("attendance_date", learnerFromDate)
      .lte("attendance_date", learnerToDate)
      .order("attendance_date", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLearnerHistoryRows((data || []) as AttendanceRow[]);
  }

  async function viewClassHistory() {
    if (!schoolId) return;

    const learnerNames = learners.map((learner) => learner.name);

    if (learnerNames.length === 0) {
      alert("No learners found for this class.");
      return;
    }

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", schoolId)
      .in("learner_name", learnerNames)
      .gte("attendance_date", classFromDate)
      .lte("attendance_date", classToDate)
      .order("attendance_date", { ascending: false })
      .order("learner_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassHistoryRows((data || []) as AttendanceRow[]);
  }

  function exportCsv(filename: string, rows: AttendanceRow[]) {
    if (rows.length === 0) {
      alert("No records to export.");
      return;
    }

    const headers = ["learner_name", "status", "attendance_date"];

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

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const presentCount = Object.values(attendance).filter(
    (status) => status === "present"
  ).length;

  const absentCount = Object.values(attendance).filter(
    (status) => status === "absent"
  ).length;

  const unmarkedCount = Math.max(learners.length - presentCount - absentCount, 0);

  if (loading) {
    return <p>Loading attendance...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Attendance</h2>
        <p className="db-page-subtitle">
          Today: {today} | Classroom: {classroomName || "Not assigned"}
        </p>
      </div>

      <div
        className="db-card db-card-blue"
        style={{
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          <MiniStat label="Present" value={presentCount} />
          <MiniStat label="Absent" value={absentCount} />
          <MiniStat label="Unmarked" value={unmarkedCount} />
          <MiniStat label="Learners" value={learners.length} />
        </div>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 120px",
            gap: 8,
            marginBottom: 10,
            fontWeight: 700,
            color: "#5B5675",
          }}
        >
          <div>Learner</div>
          <div style={{ textAlign: "center" }}>Present</div>
          <div style={{ textAlign: "center" }}>Absent</div>
          <div style={{ textAlign: "right" }}>History</div>
        </div>

        {learners.length === 0 ? (
          <p className="db-helper">
            No learners found for this teacher classroom.
          </p>
        ) : (
          learners.map((learner) => (
            <div
              key={learner.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 120px",
                gap: 8,
                padding: 10,
                border: "1px solid #F0E3D8",
                borderRadius: 12,
                marginBottom: 8,
                background: "#FFFDFB",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{learner.name}</strong>
                <p style={smallText}>{learner.class}</p>
              </div>

              <button
                type="button"
                onClick={() => mark(learner.name, "present")}
                style={tickButton(attendance[learner.name] === "present")}
              >
                {attendance[learner.name] === "present" ? "✓" : ""}
              </button>

              <button
                type="button"
                onClick={() => mark(learner.name, "absent")}
                style={tickButton(attendance[learner.name] === "absent")}
              >
                {attendance[learner.name] === "absent" ? "✓" : ""}
              </button>

              <button
                type="button"
                onClick={() => viewLearnerHistory(learner.name)}
                className="db-button-secondary"
                style={{
                  minHeight: 36,
                  padding: "8px 10px",
                  fontSize: 12,
                }}
              >
                View
              </button>
            </div>
          ))
        )}

        <button
          type="button"
          onClick={saveAttendance}
          disabled={saving}
          className="db-button-primary"
          style={{ width: "100%", marginTop: 10 }}
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      <div
        className="db-card db-card-yellow"
        style={{ padding: 16, marginTop: 18 }}
      >
        <h3 style={sectionTitle}>Learner Attendance History</h3>

        <p style={smallText}>
          {selectedLearnerName
            ? `Learner: ${selectedLearnerName}`
            : "Click View next to a learner to load their attendance."}
        </p>

        <div style={dateGrid}>
          <div>
            <p style={labelText}>From</p>
            <input
              type="date"
              className="db-input"
              value={learnerFromDate}
              onChange={(e) => setLearnerFromDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>To</p>
            <input
              type="date"
              className="db-input"
              value={learnerToDate}
              onChange={(e) => setLearnerToDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() =>
              selectedLearnerName
                ? viewLearnerHistory(selectedLearnerName)
                : alert("Select a learner first.")
            }
          >
            View Learner Attendance
          </button>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() =>
              exportCsv(
                `${selectedLearnerName || "learner"}-attendance.csv`,
                learnerHistoryRows
              )
            }
          >
            Export Learner CSV
          </button>
        </div>

        {learnerHistoryRows.length === 0 ? (
          <p className="db-helper">No learner history loaded.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {learnerHistoryRows.map((row) => (
              <div key={row.id} style={recordRow}>
                <strong>{row.attendance_date}</strong>
                <span>{row.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="db-card db-card-green"
        style={{ padding: 16, marginTop: 18 }}
      >
        <h3 style={sectionTitle}>Class Attendance History</h3>
        <p style={smallText}>
          View and export attendance for the whole {classroomName || "class"} class.
        </p>

        <div style={dateGrid}>
          <div>
            <p style={labelText}>From</p>
            <input
              type="date"
              className="db-input"
              value={classFromDate}
              onChange={(e) => setClassFromDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>To</p>
            <input
              type="date"
              className="db-input"
              value={classToDate}
              onChange={(e) => setClassToDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={viewClassHistory}
          >
            View Class Attendance
          </button>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() =>
              exportCsv(`${classroomName || "class"}-attendance.csv`, classHistoryRows)
            }
          >
            Export Class CSV
          </button>
        </div>

        {classHistoryRows.length === 0 ? (
          <p className="db-helper">No class history loaded.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {classHistoryRows.map((row) => (
              <div key={row.id} style={recordRow}>
                <strong>{row.learner_name}</strong>
                <span>
                  {row.attendance_date} - {row.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#FFFDFB",
        border: "1px solid #F0E3D8",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <p style={labelText}>{label}</p>
      <h3
        style={{
          margin: "4px 0 0 0",
          color: "#2D2A3E",
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        {value}
      </h3>
    </div>
  );
}

function tickButton(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 34,
    borderRadius: 10,
    border: active ? "1px solid #7CCCF3" : "1px solid #E7DACE",
    background: active ? "#EAF7FD" : "#FFFFFF",
    color: active ? "#2D2A3E" : "#B0A8BA",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
  };
}

const sectionTitle = {
  margin: "0 0 10px 0",
  color: "#2D2A3E",
  fontSize: 20,
  fontWeight: 700 as const,
};

const smallText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const labelText = {
  margin: 0,
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 700,
};

const dateGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
  margin: "12px 0",
};

const recordRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
  textTransform: "capitalize" as const,
};
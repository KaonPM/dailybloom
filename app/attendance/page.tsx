"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type Learner = {
  id: number;
  name: string;
  class?: string | null;
  classroom_id?: number | null;
};

type Classroom = {
  id: number;
  classroom_name?: string | null;
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

  const [allLearners, setAllLearners] = useState<Learner[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [teacherClassroom, setTeacherClassroom] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState("");

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

  useEffect(() => {
    if (schoolId) {
      loadTodayAttendance(schoolId);
      setSelectedLearnerName("");
      setLearnerHistoryRows([]);
      setClassHistoryRows([]);
    }
  }, [selectedClassroom, schoolId]);

  async function loadPage() {
    const { profile } = await getCurrentProfile();

    if (!profile || !profile.school_id) {
      setLoading(false);
      return;
    }

    const currentSchoolId = Number(profile.school_id);
    const currentRole = String(profile.role || "");
    const currentTeacherClassroom = String(profile.classroom_name || "");

    setSchoolId(currentSchoolId);
    setRole(currentRole);
    setTeacherClassroom(currentTeacherClassroom);

    if (currentRole === "teacher") {
      setSelectedClassroom(currentTeacherClassroom);
    }

    await Promise.all([
      loadClassrooms(currentSchoolId),
      loadLearners(currentSchoolId),
      loadTodayAttendance(currentSchoolId),
    ]);

    setLoading(false);
  }

  async function loadClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms((data || []) as Classroom[]);
  }

  async function loadLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, classroom_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setAllLearners((data || []) as Learner[]);
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

  const visibleLearners = useMemo(() => {
    if (role === "teacher") {
      return allLearners.filter((learner) => learner.class === teacherClassroom);
    }

    if (selectedClassroom) {
      return allLearners.filter((learner) => learner.class === selectedClassroom);
    }

    return allLearners;
  }, [allLearners, role, teacherClassroom, selectedClassroom]);

  function mark(name: string, status: "present" | "absent") {
    setAttendance((prev) => ({
      ...prev,
      [name]: prev[name] === status ? "" : status,
    }));
  }

  async function saveAttendance() {
    if (!schoolId) return;

    const rows = visibleLearners
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

    const learnerNames = visibleLearners.map((learner) => learner.name);

    if (learnerNames.length === 0) {
      alert("No learners found for this view.");
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

  const presentCount = visibleLearners.filter(
    (learner) => attendance[learner.name] === "present"
  ).length;

  const absentCount = visibleLearners.filter(
    (learner) => attendance[learner.name] === "absent"
  ).length;

  const unmarkedCount = Math.max(visibleLearners.length - presentCount - absentCount, 0);

  const viewLabel =
    role === "teacher"
      ? teacherClassroom || "Assigned classroom"
      : selectedClassroom || "Entire school";

  if (loading) {
    return <p>Loading attendance...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Attendance</h2>
        <p className="db-page-subtitle">
          Today: {today} | View: {viewLabel}
        </p>
      </div>

      {role !== "teacher" ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <p style={labelText}>Select Classroom Optional</p>

          <select
            className="db-input"
            value={selectedClassroom}
            onChange={(e) => setSelectedClassroom(e.target.value)}
          >
            <option value="">Entire School</option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.classroom_name || ""}>
                {room.classroom_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
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
          <MiniStat label="Learners" value={visibleLearners.length} />
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

        {visibleLearners.length === 0 ? (
          <p className="db-helper">No learners found for this view.</p>
        ) : (
          visibleLearners.map((learner) => (
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
                <p style={smallText}>{learner.class || "Unassigned"}</p>
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

      {selectedLearnerName ? (
        <div className="db-card db-card-yellow" style={{ padding: 16, marginTop: 18 }}>
          <h3 style={sectionTitle}>Learner Attendance History</h3>

          <p style={smallText}>Learner: {selectedLearnerName}</p>

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
              onClick={() => viewLearnerHistory(selectedLearnerName)}
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

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => {
                setSelectedLearnerName("");
                setLearnerHistoryRows([]);
              }}
            >
              Close
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
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16, marginTop: 18 }}>
        <h3 style={sectionTitle}>Attendance History</h3>
        <p style={smallText}>View and export attendance for {viewLabel}.</p>

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
            View Attendance
          </button>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() =>
              exportCsv(
                `${viewLabel.replaceAll(" ", "-").toLowerCase()}-attendance.csv`,
                classHistoryRows
              )
            }
          >
            Export CSV
          </button>
        </div>

        {classHistoryRows.length === 0 ? (
          <p className="db-helper">No attendance history loaded.</p>
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
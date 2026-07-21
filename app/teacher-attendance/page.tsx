"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type TeacherRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  school_id?: number | null;
};

type AttendanceRow = {
  id?: string | number;
  school_id: number;
  teacher_id: string;
  teacher_name: string;
  attendance_date: string;
  status: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

const attendanceStatuses = [
  "Present",
  "Absent",
  "Sick Leave",
  "Annual Leave",
  "Family Responsibility Leave",
  "Late Arrival",
  "Early Departure",
];

export default function TeacherAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().slice(0, 10);

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>(
    {}
  );
  const [openTeacherIds, setOpenTeacherIds] = useState<Record<string, boolean>>(
    {}
  );

  const [historyRows, setHistoryRows] = useState<AttendanceRow[]>([]);
  const [historyFromDate, setHistoryFromDate] = useState(today);
  const [historyToDate, setHistoryToDate] = useState(today);

  const [loading, setLoading] = useState(true);
  const [savingTeacherId, setSavingTeacherId] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      router.push("/login");
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
      return;
    }

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

    await Promise.all([
      fetchTeachers(),
      fetchAttendance(context.schoolId, today),
    ]);

    setLoading(false);
  }

  async function fetchTeachers() {
    const { data, error } = await supabase.rpc(
      "get_school_teachers_for_attendance"
    );

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers((data || []) as TeacherRow[]);
  }

  async function fetchAttendance(currentSchoolId: number, date: string) {
    const { data, error } = await supabase
      .from("teacher_attendance")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("attendance_date", date);

    if (error) {
      alert(error.message);
      return;
    }

    const mapped: Record<string, AttendanceRow> = {};

    (data || []).forEach((row: AttendanceRow) => {
      mapped[row.teacher_id] = row;
    });

    setAttendance(mapped);
  }

  function getTeacherAttendance(teacher: TeacherRow): AttendanceRow {
    return (
      attendance[teacher.id] || {
        school_id: Number(schoolId),
        teacher_id: teacher.id,
        teacher_name: teacher.full_name || teacher.email || "Unnamed teacher",
        attendance_date: today,
        status: "",
        notes: "",
      }
    );
  }

  function updateLocalAttendance(
    teacher: TeacherRow,
    field: "status" | "notes",
    value: string
  ) {
    const current = getTeacherAttendance(teacher);

    setAttendance((prev) => ({
      ...prev,
      [teacher.id]: {
        ...current,
        [field]: value,
      },
    }));
  }

  async function saveTeacherAttendance(teacher: TeacherRow) {
    if (!schoolId) return;

    const record = getTeacherAttendance(teacher);

    if (!record.status) {
      alert("Please select an attendance status.");
      return;
    }

    setSavingTeacherId(teacher.id);

    const payload = {
      school_id: schoolId,
      teacher_id: teacher.id,
      teacher_name: teacher.full_name || teacher.email || "Unnamed teacher",
      attendance_date: today,
      status: record.status,
      notes: record.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("teacher_attendance").upsert(
      [payload],
      {
        onConflict: "school_id,teacher_id,attendance_date",
      }
    );

    if (error) {
      alert(error.message);
      setSavingTeacherId(null);
      return;
    }

    await fetchAttendance(schoolId, today);

    setOpenTeacherIds((prev) => ({
      ...prev,
      [teacher.id]: false,
    }));

    setSavingTeacherId(null);
    alert("Teacher attendance saved.");
  }

  async function markAllPresent() {
    if (!schoolId) return;

    if (teachers.length === 0) {
      alert("No teachers found for this school.");
      return;
    }

    const confirmed = confirm(`Mark all teachers as Present for ${today}?`);

    if (!confirmed) return;

    const payload = teachers.map((teacher) => ({
      school_id: schoolId,
      teacher_id: teacher.id,
      teacher_name: teacher.full_name || teacher.email || "Unnamed teacher",
      attendance_date: today,
      status: "Present",
      notes: null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("teacher_attendance").upsert(
      payload,
      {
        onConflict: "school_id,teacher_id,attendance_date",
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    await fetchAttendance(schoolId, today);

    const collapsedTeachers = teachers.reduce<Record<string, boolean>>(
      (acc, teacher) => {
        acc[teacher.id] = false;
        return acc;
      },
      {}
    );

    setOpenTeacherIds((prev) => ({
      ...prev,
      ...collapsedTeachers,
    }));

    alert("All teachers marked present.");
  }

  async function viewAttendanceHistory() {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("teacher_attendance")
      .select("*")
      .eq("school_id", schoolId)
      .gte("attendance_date", historyFromDate)
      .lte("attendance_date", historyToDate)
      .order("attendance_date", { ascending: false })
      .order("teacher_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setHistoryRows((data || []) as AttendanceRow[]);
  }

  function exportCsv(filename: string, rows: AttendanceRow[]) {
    if (rows.length === 0) {
      alert("No records to export.");
      return;
    }

    const headers: (keyof AttendanceRow)[] = [
      "teacher_name",
      "status",
      "notes",
      "attendance_date",
    ];

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

  const summary = useMemo(() => {
    const values = Object.values(attendance);

    return {
      present: values.filter((item) => item.status === "Present").length,
      absent: values.filter((item) => item.status === "Absent").length,
      leave: values.filter((item) =>
        ["Sick Leave", "Annual Leave", "Family Responsibility Leave"].includes(
          item.status
        )
      ).length,
      late: values.filter((item) =>
        ["Late Arrival", "Early Departure"].includes(item.status)
      ).length,
    };
  }, [attendance]);

  if (loading) {
    return <p>Loading teacher attendance...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Teacher Attendance</h2>
        <p className="db-page-subtitle">Today: {today}</p>
      </div>

      <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
        <div style={summaryGrid}>
          <MiniStat label="Present" value={summary.present} />
          <MiniStat label="Absent" value={summary.absent} />
          <MiniStat label="Leave" value={summary.leave} />
          <MiniStat label="Late / Early" value={summary.late} />
        </div>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <div style={sectionHeader}>
          <h3 style={sectionTitle}>Attendance</h3>

          <button
            type="button"
            className="db-button-secondary"
            onClick={markAllPresent}
          >
            Mark All Present
          </button>
        </div>

        {teachers.length === 0 ? (
          <p className="db-helper">No teachers found for this school.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {teachers.map((teacher) => {
              const record = getTeacherAttendance(teacher);
              const isOpen =
                openTeacherIds[teacher.id] === undefined
                  ? !record.id
                  : openTeacherIds[teacher.id];

              return (
                <div key={teacher.id} className="db-list-card">
                  <div style={teacherRow}>
                    <div>
                      <strong style={{ fontSize: 16 }}>
                        {teacher.full_name || "Unnamed teacher"}
                      </strong>

                      {!isOpen && record.notes ? (
                        <p style={smallText}>{record.notes}</p>
                      ) : null}
                    </div>

                    <div style={teacherActions}>
                      <div style={statusPill(record.status)}>
                        {record.status || "Not marked"}
                      </div>

                      {record.id ? (
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() =>
                            setOpenTeacherIds((prev) => ({
                              ...prev,
                              [teacher.id]: !isOpen,
                            }))
                          }
                        >
                          {isOpen ? "Collapse" : "Edit"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isOpen ? (
                    <>
                      <div style={grid2}>
                        <div>
                          <p style={labelText}>Status</p>

                          <div style={statusButtonGroup}>
                            {attendanceStatuses.map((status) => {
                              const isSelected = record.status === status;

                              return (
                                <button
                                  key={status}
                                  type="button"
                                  className={
                                    isSelected
                                      ? "db-button-primary"
                                      : "db-button-secondary"
                                  }
                                  style={statusButton}
                                  onClick={() =>
                                    updateLocalAttendance(
                                      teacher,
                                      "status",
                                      status
                                    )
                                  }
                                >
                                  {status === "Late Arrival"
                                    ? "Late"
                                    : status === "Early Departure"
                                    ? "Early"
                                    : status}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p style={labelText}>Notes</p>
                          <input
                            className="db-input"
                            placeholder="Optional note"
                            value={record.notes || ""}
                            onChange={(event) =>
                              updateLocalAttendance(
                                teacher,
                                "notes",
                                event.target.value
                              )
                            }
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="db-button-primary"
                        style={{ width: "100%", marginTop: 10 }}
                        onClick={() => saveTeacherAttendance(teacher)}
                        disabled={savingTeacherId === teacher.id}
                      >
                        {savingTeacherId === teacher.id
                          ? "Saving..."
                          : "Save Attendance"}
                      </button>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="db-card db-card-green"
        style={{ padding: 16, marginTop: 18 }}
      >
        <h3 style={sectionTitle}>Attendance History</h3>
        <p style={smallText}>View and export teacher attendance records.</p>

        <div style={dateGrid}>
          <div>
            <p style={labelText}>From</p>
            <input
              type="date"
              className="db-input"
              value={historyFromDate}
              onChange={(e) => setHistoryFromDate(e.target.value)}
            />
          </div>

          <div>
            <p style={labelText}>To</p>
            <input
              type="date"
              className="db-input"
              value={historyToDate}
              onChange={(e) => setHistoryToDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="db-button-secondary"
            onClick={viewAttendanceHistory}
          >
            View Attendance
          </button>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() =>
              exportCsv("teacher-attendance.csv", historyRows)
            }
          >
            Export CSV
          </button>
        </div>

        {historyRows.length === 0 ? (
          <p className="db-helper">No attendance history loaded.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {historyRows.map((row) => (
              <div key={row.id} style={recordRow}>
                <strong>{row.teacher_name}</strong>
                <span>
                  {row.attendance_date} - {row.status}
                  {row.notes ? ` - ${row.notes}` : ""}
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
  marginBottom: 10,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginTop: 10,
};

const statusButtonGroup = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const statusButton = {
  minHeight: 38,
  padding: "8px 12px",
};

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
  margin: "6px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const teacherRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
};

const teacherActions = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap" as const,
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
};

function statusPill(status: string) {
  let background = "#FFFDFB";
  let border = "#F0E3D8";

  if (status === "Present") {
    background = "#EAF8ED";
    border = "#CDEFD4";
  }

  if (
    status === "Absent" ||
    status === "Sick Leave" ||
    status === "Annual Leave" ||
    status === "Family Responsibility Leave"
  ) {
    background = "#FFF7D9";
    border = "#F3E4A3";
  }

  if (status === "Late Arrival" || status === "Early Departure") {
    background = "#EAF7FD";
    border = "#CBEAF7";
  }

  return {
    background,
    border: `1px solid ${border}`,
    color: "#2D2A3E",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  };
}

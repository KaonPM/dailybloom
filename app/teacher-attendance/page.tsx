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
  id?: string;
  school_id: number;
  teacher_id: string;
  teacher_name: string;
  attendance_date: string;
  status: string;
  notes?: string | null;
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

  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [savingTeacherId, setSavingTeacherId] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (schoolId) {
      fetchAttendance(schoolId, selectedDate);
    }
  }, [selectedDate, schoolId]);

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
      fetchAttendance(context.schoolId, selectedDate),
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
        attendance_date: selectedDate,
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
      attendance_date: selectedDate,
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

    await fetchAttendance(schoolId, selectedDate);
    setSavingTeacherId(null);
  }

  async function markAllPresent() {
    if (!schoolId) return;

    if (teachers.length === 0) {
      alert("No teachers found for this school.");
      return;
    }

    const confirmed = confirm(
      `Mark all teachers as Present for ${selectedDate}?`
    );

    if (!confirmed) return;

    const payload = teachers.map((teacher) => ({
      school_id: schoolId,
      teacher_id: teacher.id,
      teacher_name: teacher.full_name || teacher.email || "Unnamed teacher",
      attendance_date: selectedDate,
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

    await fetchAttendance(schoolId, selectedDate);
    alert("All teachers marked present.");
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
        <p className="db-page-subtitle">
          Record daily staff attendance for school management and reporting.
        </p>
      </div>

      <div
        className="db-card db-card-blue"
        style={{ padding: 16, marginBottom: 18 }}
      >
        <div style={topRow}>
          <div>
            <p style={labelText}>Attendance Date</p>
            <input
              className="db-input"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={markAllPresent}
            style={{ minHeight: 44, alignSelf: "end" }}
          >
            Mark All Present
          </button>
        </div>
      </div>

      <div style={summaryGrid}>
        <div className="db-card db-card-green" style={summaryCard}>
          <span style={summaryLabel}>Present</span>
          <strong style={summaryNumber}>{summary.present}</strong>
        </div>

        <div className="db-card db-card-yellow" style={summaryCard}>
          <span style={summaryLabel}>Absent</span>
          <strong style={summaryNumber}>{summary.absent}</strong>
        </div>

        <div className="db-card db-card-lavender" style={summaryCard}>
          <span style={summaryLabel}>Leave</span>
          <strong style={summaryNumber}>{summary.leave}</strong>
        </div>

        <div className="db-card db-card-blue" style={summaryCard}>
          <span style={summaryLabel}>Late / Early</span>
          <strong style={summaryNumber}>{summary.late}</strong>
        </div>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Teachers ({teachers.length})</h3>

        {teachers.length === 0 ? (
          <p className="db-helper">No teachers found for this school.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {teachers.map((teacher) => {
              const record = getTeacherAttendance(teacher);

              return (
                <div key={teacher.id} className="db-list-card">
                  <div style={teacherRow}>
                    <div>
                      <strong style={{ fontSize: 16 }}>
                        {teacher.full_name || "Unnamed teacher"}
                      </strong>

                      <p style={smallText}>
                        {teacher.email || "No email added"}
                      </p>
                    </div>

                    <div style={statusPill(record.status)}>
                      {record.status || "Not marked"}
                    </div>
                  </div>

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
                                updateLocalAttendance(teacher, "status", status)
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
                    style={{ marginTop: 10 }}
                    onClick={() => saveTeacherAttendance(teacher)}
                    disabled={savingTeacherId === teacher.id}
                  >
                    {savingTeacherId === teacher.id ? "Saving..." : "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const topRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  alignItems: "end",
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 18,
};

const summaryCard = {
  padding: 14,
  minHeight: 90,
};

const summaryLabel = {
  display: "block",
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 800,
};

const summaryNumber = {
  display: "block",
  marginTop: 6,
  color: "#2D2A3E",
  fontSize: 28,
  fontWeight: 800,
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { getCurrentProfile } from "../lib/auth";

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  school_id?: number | null;
};

type AttendanceItem = {
  id: number;
  school_id?: number | null;
  learner_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
  created_at?: string | null;
};

type AttendanceStatus = "present" | "absent" | "";

export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState<string | null>(null);

  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>([]);
  const [recentRecords, setRecentRecords] = useState<AttendanceItem[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayString);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [selectedLearnerName, setSelectedLearnerName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (schoolId) {
      fetchAttendanceForDate(schoolId, selectedDate);
    }
  }, [selectedDate, schoolId]);

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

    const teacherClass =
      profile?.role === "teacher" && profile?.classroom_name
        ? String(profile.classroom_name)
        : null;

    setSchoolId(context.schoolId);
    setClassroomName(teacherClass);

    await Promise.all([
      fetchLearners(context.schoolId, teacherClass),
      fetchAttendanceForDate(context.schoolId, selectedDate),
      fetchRecentRecords(context.schoolId, teacherClass),
    ]);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number, teacherClass: string | null) {
    let query = supabase
      .from("learners")
      .select("id, name, class, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (teacherClass) {
      query = query.eq("class", teacherClass);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  async function fetchAttendanceForDate(currentSchoolId: number, dateValue: string) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("attendance_date", dateValue)
      .order("learner_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const records = (data || []) as AttendanceItem[];
    setAttendanceRecords(records);

    const nextMap: Record<string, AttendanceStatus> = {};

    records.forEach((record) => {
      const name = String(record.learner_name || "");
      const status = String(record.status || "").toLowerCase();

      if (status === "present" || status === "absent") {
        nextMap[name] = status as AttendanceStatus;
      }
    });

    setAttendanceMap(nextMap);
  }

  async function fetchRecentRecords(currentSchoolId: number, teacherClass: string | null) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("attendance_date", { ascending: false })
      .limit(80);

    if (error) {
      alert(error.message);
      return;
    }

    let records = (data || []) as AttendanceItem[];

    if (teacherClass) {
      records = records.filter((record) => {
        const learner = learners.find(
          (item) =>
            String(item.name || "").trim().toLowerCase() ===
            String(record.learner_name || "").trim().toLowerCase()
        );

        return String(learner?.class || "") === teacherClass;
      });
    }

    setRecentRecords(records);
  }

  function markAttendance(learnerName: string, status: AttendanceStatus) {
    setAttendanceMap((prev) => ({
      ...prev,
      [learnerName]: prev[learnerName] === status ? "" : status,
    }));
  }

  async function saveAttendance() {
    if (!schoolId) {
      alert("School context is missing.");
      return;
    }

    const rowsToSave = learners
      .map((learner) => {
        const learnerName = String(learner.name || "").trim();
        const status = attendanceMap[learnerName];

        if (!learnerName || !status) return null;

        return {
          school_id: Number(schoolId),
          learner_name: learnerName,
          status,
          attendance_date: selectedDate,
        };
      })
      .filter(Boolean);

    if (rowsToSave.length === 0) {
      alert("Please mark at least one learner as present or absent.");
      return;
    }

    setSaving(true);

    const learnerNames = rowsToSave.map((row: any) => row.learner_name);

    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("school_id", Number(schoolId))
      .eq("attendance_date", selectedDate)
      .in("learner_name", learnerNames);

    if (deleteError) {
      alert(deleteError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("attendance")
      .insert(rowsToSave as any[]);

    if (insertError) {
      alert(insertError.message);
      setSaving(false);
      return;
    }

    await Promise.all([
      fetchAttendanceForDate(Number(schoolId), selectedDate),
      fetchRecentRecords(Number(schoolId), classroomName),
    ]);

    setSaving(false);
    alert("Attendance saved.");
  }

  const presentCount = useMemo(() => {
    return Object.values(attendanceMap).filter((status) => status === "present").length;
  }, [attendanceMap]);

  const absentCount = useMemo(() => {
    return Object.values(attendanceMap).filter((status) => status === "absent").length;
  }, [attendanceMap]);

  const unmarkedCount = Math.max(learners.length - presentCount - absentCount, 0);

  const selectedLearnerHistory = useMemo(() => {
    if (!selectedLearnerName) return [];

    return recentRecords
      .filter(
        (record) =>
          String(record.learner_name || "").trim().toLowerCase() ===
          selectedLearnerName.trim().toLowerCase()
      )
      .slice(0, 10);
  }, [selectedLearnerName, recentRecords]);

  if (loading) {
    return <p>Loading attendance...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{
          padding: "18px 20px",
          marginBottom: "18px",
        }}
      >
        <h2 className="db-page-title">Attendance</h2>
        <p className="db-page-subtitle">
          Mark daily attendance quickly with compact tick-style rows.
        </p>

        {classroomName ? (
          <p style={smallMutedText}>Classroom view: {classroomName}</p>
        ) : null}
      </div>

      <div
        className="db-card db-card-blue"
        style={{
          padding: "16px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "10px",
            alignItems: "end",
          }}
        >
          <div>
            <p style={labelText}>Attendance Date</p>
            <input
              className="db-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          <MiniStat label="Present" value={presentCount} />
          <MiniStat label="Absent" value={absentCount} />
          <MiniStat label="Unmarked" value={unmarkedCount} />
        </div>
      </div>

      <div
        className="db-card db-card-lavender"
        style={{
          padding: "16px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 130px",
            gap: "8px",
            alignItems: "center",
            marginBottom: "10px",
            color: "#6D6888",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <span>Learner</span>
          <span style={{ textAlign: "center" }}>Present</span>
          <span style={{ textAlign: "center" }}>Absent</span>
          <span style={{ textAlign: "right" }}>History</span>
        </div>

        {learners.length === 0 ? (
          <p className="db-helper">No learners found for this school or classroom.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {learners.map((learner) => {
              const learnerName = learner.name || "Unnamed learner";
              const selectedStatus = attendanceMap[learnerName] || "";

              return (
                <div
                  key={learner.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 90px 130px",
                    gap: "8px",
                    alignItems: "center",
                    background: "#FFFDFB",
                    border: "1px solid #F0E3D8",
                    borderRadius: "14px",
                    padding: "10px",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: "#2D2A3E",
                        fontSize: "14px",
                        fontWeight: 700,
                      }}
                    >
                      {learnerName}
                    </strong>
                    <span style={smallMutedText}>
                      {learner.class || "Unassigned"}
                    </span>
                  </div>

                  <TickButton
                    active={selectedStatus === "present"}
                    label="✓"
                    onClick={() => markAttendance(learnerName, "present")}
                  />

                  <TickButton
                    active={selectedStatus === "absent"}
                    label="✓"
                    onClick={() => markAttendance(learnerName, "absent")}
                  />

                  <button
                    type="button"
                    className="db-button-secondary"
                    onClick={() =>
                      setSelectedLearnerName(
                        selectedLearnerName === learnerName ? null : learnerName
                      )
                    }
                    style={{
                      minHeight: "36px",
                      padding: "8px 10px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="db-button-primary"
          onClick={saveAttendance}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: "14px",
          }}
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      {selectedLearnerName ? (
        <div
          className="db-card db-card-green"
          style={{
            padding: "16px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <h3 style={sectionTitle}>{selectedLearnerName} Attendance</h3>

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => setSelectedLearnerName(null)}
            >
              Close
            </button>
          </div>

          {selectedLearnerHistory.length === 0 ? (
            <p className="db-helper">No saved attendance history found yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {selectedLearnerHistory.map((record) => (
                <div key={record.id} style={recordRow}>
                  <strong>{record.attendance_date || "No date"}</strong>
                  <span>{record.status || "No status"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        className="db-card db-card-yellow"
        style={{
          padding: "16px",
        }}
      >
        <h3 style={sectionTitle}>Saved Attendance Records</h3>

        {attendanceRecords.length === 0 ? (
          <p className="db-helper">No saved records for the selected date.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {attendanceRecords.map((record) => (
              <div key={record.id} style={recordRow}>
                <strong>{record.learner_name || "Unnamed learner"}</strong>
                <span>{record.status || "No status"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TickButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "34px",
        borderRadius: "10px",
        border: active ? "1px solid #7CCCF3" : "1px solid #E7DACE",
        background: active ? "#EAF7FD" : "#FFFFFF",
        color: active ? "#2D2A3E" : "#B0A8BA",
        fontWeight: 800,
        cursor: "pointer",
        fontSize: "15px",
      }}
    >
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#FFFDFB",
        border: "1px solid #F0E3D8",
        borderRadius: "14px",
        padding: "12px",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#6D6888",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {label}
      </p>
      <h3
        style={{
          margin: "4px 0 0 0",
          color: "#2D2A3E",
          fontSize: "24px",
          fontWeight: 800,
        }}
      >
        {value}
      </h3>
    </div>
  );
}

const sectionTitle = {
  margin: 0,
  color: "#2D2A3E",
  fontSize: "20px",
  fontWeight: 700 as const,
};

const smallMutedText = {
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: "12px",
};

const labelText = {
  margin: "0 0 6px 0",
  color: "#6D6888",
  fontSize: "13px",
  fontWeight: 700,
};

const recordRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "10px 12px",
  color: "#2D2A3E",
  textTransform: "capitalize" as const,
};
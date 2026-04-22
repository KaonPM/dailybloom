"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  school_id?: number | null;
};

type AttendanceItem = {
  id: number;
  learner_name?: string | null;
  status?: string | null;
  attendance_date?: string | null;
  school_id?: number | null;
};

export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");
  const classroomParam = searchParams.get("classroom");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayDate = `${yyyy}-${mm}-${dd}`;

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
      fetchLearners(context.schoolId),
      fetchTodayAttendance(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  async function fetchTodayAttendance(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, learner_name, status, attendance_date, school_id")
      .eq("school_id", currentSchoolId)
      .eq("attendance_date", todayDate)
      .order("learner_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const history = (data || []) as AttendanceItem[];
    setAttendanceHistory(history);

    const nextMap: Record<string, string> = {};
    history.forEach((item) => {
      const key = String(item.learner_name || "").trim().toLowerCase();
      if (key) {
        nextMap[key] = String(item.status || "").toLowerCase();
      }
    });

    setAttendanceMap(nextMap);
  }

  const filteredLearners = useMemo(() => {
    if (!classroomParam) return learners;

    const target = classroomParam.trim().toLowerCase();
    return learners.filter(
      (learner) => String(learner.class || "").trim().toLowerCase() === target
    );
  }, [learners, classroomParam]);

  const presentCount = useMemo(() => {
    return filteredLearners.filter((learner) => {
      const key = String(learner.name || "").trim().toLowerCase();
      return attendanceMap[key] === "present";
    }).length;
  }, [filteredLearners, attendanceMap]);

  const absentCount = useMemo(() => {
    return filteredLearners.filter((learner) => {
      const key = String(learner.name || "").trim().toLowerCase();
      return attendanceMap[key] === "absent";
    }).length;
  }, [filteredLearners, attendanceMap]);

  function updateAttendance(learnerName: string, status: string) {
    const key = learnerName.trim().toLowerCase();
    setAttendanceMap((prev) => ({
      ...prev,
      [key]: status,
    }));
  }

  async function saveAttendance() {
    if (!schoolId) return;

    setSaving(true);

    const rows = filteredLearners.map((learner) => {
      const key = String(learner.name || "").trim().toLowerCase();
      return {
        learner_name: learner.name || "",
        status: attendanceMap[key] || "present",
        attendance_date: todayDate,
        school_id: Number(schoolId),
      };
    });

    const learnerNames = filteredLearners.map((learner) => learner.name).filter(Boolean);

    if (learnerNames.length > 0) {
      const { error: deleteError } = await supabase
        .from("attendance")
        .delete()
        .eq("school_id", Number(schoolId))
        .eq("attendance_date", todayDate)
        .in("learner_name", learnerNames);

      if (deleteError) {
        alert(deleteError.message);
        setSaving(false);
        return;
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("attendance").insert(rows);

      if (insertError) {
        alert(insertError.message);
        setSaving(false);
        return;
      }
    }

    await fetchTodayAttendance(Number(schoolId));
    setSaving(false);
    alert("Attendance saved successfully");
  }

  const backToClassroomHref =
    classroomParam && schoolParam
      ? `/classrooms?school=${schoolParam}`
      : classroomParam
      ? "/classrooms"
      : null;

  if (loading) {
    return <p>Loading attendance...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">
          {classroomParam ? `${classroomParam} Attendance` : "Attendance"}
        </h2>
        <p className="db-page-subtitle">
          {classroomParam
            ? `Take attendance for ${classroomParam} on ${todayDate}.`
            : `Take attendance for today, ${todayDate}.`}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <StatCard label="Learners" value={filteredLearners.length} />
        <StatCard label="Present" value={presentCount} />
        <StatCard label="Absent" value={absentCount} />
      </div>

      <div className="db-card db-card-blue" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <h3 style={sectionTitle}>Today Attendance</h3>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {backToClassroomHref ? (
              <Link href={backToClassroomHref} className="db-button-secondary">
                Back to Classrooms
              </Link>
            ) : null}

            <button
              className="db-button-primary"
              onClick={saveAttendance}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>

        {filteredLearners.length === 0 ? (
          <p className="db-helper">
            {classroomParam
              ? "No learners found for this classroom."
              : "No learners found."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredLearners.map((learner) => {
              const learnerName = learner.name || "";
              const key = learnerName.trim().toLowerCase();
              const selectedStatus = attendanceMap[key] || "present";

              return (
                <div key={learner.id} className="db-list-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "17px" }}>
                        {learner.name || "Unnamed learner"}
                      </strong>
                      <p style={textStyle}>
                        Classroom: {learner.class || "Not assigned"}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => updateAttendance(learnerName, "present")}
                        style={{
                          ...choiceButton,
                          background:
                            selectedStatus === "present" ? "#EAF7FD" : "#FFFFFF",
                          border:
                            selectedStatus === "present"
                              ? "1px solid #CBEAF7"
                              : "1px solid #E5D7CB",
                        }}
                      >
                        Present
                      </button>

                      <button
                        type="button"
                        onClick={() => updateAttendance(learnerName, "absent")}
                        style={{
                          ...choiceButton,
                          background:
                            selectedStatus === "absent" ? "#F8E8F0" : "#FFFFFF",
                          border:
                            selectedStatus === "absent"
                              ? "1px solid #EBC9D8"
                              : "1px solid #E5D7CB",
                        }}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Saved Attendance Records</h3>

        {attendanceHistory.length === 0 ? (
          <p className="db-helper">No attendance saved for today yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {attendanceHistory
              .filter((item) => {
                if (!classroomParam) return true;
                const learner = learners.find(
                  (l) =>
                    String(l.name || "").trim().toLowerCase() ===
                    String(item.learner_name || "").trim().toLowerCase()
                );
                return (
                  String(learner?.class || "").trim().toLowerCase() ===
                  classroomParam.trim().toLowerCase()
                );
              })
              .map((item) => (
                <div key={item.id} className="db-list-card">
                  <strong style={{ fontSize: "17px" }}>
                    {item.learner_name || "Unnamed learner"}
                  </strong>
                  <p style={textStyle}>Status: {item.status || "Not set"}</p>
                  <p style={textStyle}>
                    Date: {item.attendance_date || "Not set"}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="db-card" style={{ padding: "18px" }}>
      <p style={{ margin: 0, color: "var(--db-text-soft)", fontSize: "14px", fontWeight: 700 }}>
        {label}
      </p>
      <h2
        style={{
          margin: "8px 0 0 0",
          color: "var(--db-text)",
          fontSize: "30px",
          fontWeight: 800,
        }}
      >
        {value}
      </h2>
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

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
};

const choiceButton = {
  minWidth: "92px",
  padding: "10px 12px",
  borderRadius: "12px",
  fontWeight: 700,
  cursor: "pointer",
  color: "#2D2A3E",
};
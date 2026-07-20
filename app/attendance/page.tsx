"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type Learner = {
  id: string;
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
  learner_id?: string | null;
  learner_name?: string;
  status?: string;
  absence_reason?: string | null;
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
  const [openClassroom, setOpenClassroom] = useState("");

  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});

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
  }, [openClassroom, schoolId]);

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
      setOpenClassroom(currentTeacherClassroom);
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
    const reasonMap: Record<string, string> = {};

    (data || []).forEach((row: AttendanceRow) => {
      if (row.learner_name && row.status) {
        map[row.learner_name] = row.status;
        reasonMap[row.learner_name] = row.absence_reason || "";
      }
    });

    setAttendance(map);
    setAbsenceReasons(reasonMap);
  }

  function getLearnersForClassroom(classroomName: string) {
    return allLearners.filter((learner) => learner.class === classroomName);
  }

  const visibleLearners = useMemo(() => {
    if (role === "teacher") {
      return allLearners.filter((learner) => learner.class === teacherClassroom);
    }

    if (openClassroom) {
      return allLearners.filter((learner) => learner.class === openClassroom);
    }

    return allLearners;
  }, [allLearners, role, teacherClassroom, openClassroom]);

  const classroomStats = useMemo(() => {
    return classrooms.map((room) => {
      const roomName = room.classroom_name || "Unassigned";
      const learners = getLearnersForClassroom(roomName);

      const present = learners.filter(
        (learner) => attendance[learner.name] === "present"
      ).length;

      const absent = learners.filter(
        (learner) => attendance[learner.name] === "absent"
      ).length;

      return {
        roomName,
        learners,
        total: learners.length,
        present,
        absent,
        unmarked: Math.max(learners.length - present - absent, 0),
      };
    });
  }, [classrooms, allLearners, attendance]);

  function mark(name: string, status: "present" | "absent") {
    setAttendance((prev) => ({
      ...prev,
      [name]: prev[name] === status ? "" : status,
    }));

    if (status === "present") {
      setAbsenceReasons((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  }

  function updateAbsenceReason(name: string, reason: string) {
    setAbsenceReasons((prev) => ({
      ...prev,
      [name]: reason,
    }));
  }

  function markAllForClassroom(classroomName: string, status: "present" | "absent") {
    const learners = getLearnersForClassroom(classroomName);

    setAttendance((prev) => {
      const updated = { ...prev };

      learners.forEach((learner) => {
        updated[learner.name] = status;
      });

      return updated;
    });

    if (status === "present") {
      setAbsenceReasons((prev) => {
        const updated = { ...prev };

        learners.forEach((learner) => {
          updated[learner.name] = "";
        });

        return updated;
      });
    }
  }

  function clearClassroom(classroomName: string) {
    const learners = getLearnersForClassroom(classroomName);

    setAttendance((prev) => {
      const updated = { ...prev };

      learners.forEach((learner) => {
        updated[learner.name] = "";
      });

      return updated;
    });

    setAbsenceReasons((prev) => {
      const updated = { ...prev };

      learners.forEach((learner) => {
        updated[learner.name] = "";
      });

      return updated;
    });
  }

  function markAllVisible(status: "present" | "absent") {
    setAttendance((prev) => {
      const updated = { ...prev };

      visibleLearners.forEach((learner) => {
        updated[learner.name] = status;
      });

      return updated;
    });

    if (status === "present") {
      setAbsenceReasons((prev) => {
        const updated = { ...prev };

        visibleLearners.forEach((learner) => {
          updated[learner.name] = "";
        });

        return updated;
      });
    }
  }

  async function saveAttendance(
    learnersToSave = visibleLearners,
    classroomToCollapse = ""
  ) {
    if (!schoolId) return;

    const rows = learnersToSave
      .filter((learner) => attendance[learner.name])
      .map((learner) => ({
        school_id: schoolId,
        learner_id: learner.id,
        learner_name: learner.name,
        status: attendance[learner.name],
        absence_reason:
          attendance[learner.name] === "absent"
            ? absenceReasons[learner.name] || ""
            : "",
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

    if (classroomToCollapse && openClassroom === classroomToCollapse) {
      setOpenClassroom("");
    }

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

    const headers: (keyof AttendanceRow)[] = [
      "learner_name",
      "status",
      "absence_reason",
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

  const presentCount = visibleLearners.filter(
    (learner) => attendance[learner.name] === "present"
  ).length;

  const absentCount = visibleLearners.filter(
    (learner) => attendance[learner.name] === "absent"
  ).length;

  const unmarkedCount = Math.max(
    visibleLearners.length - presentCount - absentCount,
    0
  );

  const viewLabel =
    role === "teacher"
      ? teacherClassroom || "Assigned classroom"
      : openClassroom || "Entire school";

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

      <div
        className="db-card db-card-blue"
        style={{ padding: 16, marginBottom: 18 }}
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
          <MiniStat label="Learners" value={visibleLearners.length} />
        </div>
      </div>

      {role !== "teacher" ? (
        <div className="db-card db-card-lavender" style={{ padding: 16 }}>
          <h3 style={sectionTitle}>Classroom Attendance</h3>

          {classroomStats.length === 0 ? (
            <p className="db-helper">No classrooms found.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {classroomStats.map((item) => {
                const active = openClassroom === item.roomName;

                return (
                  <div key={item.roomName}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenClassroom(active ? "" : item.roomName);
                        setSelectedLearnerName("");
                        setLearnerHistoryRows([]);
                      }}
                      style={{
                        width: "100%",
                        display: "grid",
                        gridTemplateColumns: "1fr 90px 90px 100px 90px",
                        gap: 8,
                        alignItems: "center",
                        background: active ? "#EAF7FD" : "#FFFDFB",
                        border: active
                          ? "1px solid #CBEAF7"
                          : "1px solid #F0E3D8",
                        borderRadius: 14,
                        padding: "10px 12px",
                        color: "#2D2A3E",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <strong>{item.roomName}</strong>
                      <span style={pillBlue}>{item.total} learners</span>
                      <span style={pillGreen}>{item.present} present</span>
                      <span style={pillRed}>{item.absent} absent</span>
                      <span style={pillNeutral}>{item.unmarked} open</span>
                    </button>

                    {active ? (
                      <div
                        style={{
                          background: "#FFFDFB",
                          border: "1px solid #F0E3D8",
                          borderRadius: 14,
                          padding: 12,
                          marginTop: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 10,
                          }}
                        >
                          <button
                            type="button"
                            className="db-button-secondary"
                            onClick={() =>
                              markAllForClassroom(item.roomName, "present")
                            }
                          >
                            Select All Present
                          </button>

                          <button
                            type="button"
                            className="db-button-secondary"
                            onClick={() =>
                              markAllForClassroom(item.roomName, "absent")
                            }
                          >
                            Select All Absent
                          </button>

                          <button
                            type="button"
                            className="db-button-secondary"
                            onClick={() => clearClassroom(item.roomName)}
                          >
                            Clear
                          </button>
                        </div>

                        <AttendanceList
                          learners={item.learners}
                          attendance={attendance}
                          absenceReasons={absenceReasons}
                          mark={mark}
                          updateAbsenceReason={updateAbsenceReason}
                          viewLearnerHistory={viewLearnerHistory}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            saveAttendance(item.learners, item.roomName)
                          }
                          disabled={saving}
                          className="db-button-primary"
                          style={{ width: "100%", marginTop: 10 }}
                        >
                          {saving
                            ? "Saving..."
                            : `Save ${item.roomName} Attendance`}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="db-card db-card-lavender" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              className="db-button-secondary"
              onClick={() => markAllVisible("present")}
            >
              Select All Present
            </button>

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => markAllVisible("absent")}
            >
              Select All Absent
            </button>
          </div>

          <AttendanceList
            learners={visibleLearners}
            attendance={attendance}
            absenceReasons={absenceReasons}
            mark={mark}
            updateAbsenceReason={updateAbsenceReason}
            viewLearnerHistory={viewLearnerHistory}
          />

          <button
            type="button"
            onClick={() => saveAttendance(visibleLearners)}
            disabled={saving}
            className="db-button-primary"
            style={{ width: "100%", marginTop: 10 }}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      )}

      {selectedLearnerName ? (
        <div
          className="db-card db-card-yellow"
          style={{ padding: 16, marginTop: 18 }}
        >
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
                  <span>
                    {row.status}
                    {row.absence_reason ? ` - ${row.absence_reason}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        className="db-card db-card-green"
        style={{ padding: 16, marginTop: 18 }}
      >
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
                  {row.absence_reason ? ` - ${row.absence_reason}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceList({
  learners,
  attendance,
  absenceReasons,
  mark,
  updateAbsenceReason,
  viewLearnerHistory,
}: {
  learners: Learner[];
  attendance: Record<string, string>;
  absenceReasons: Record<string, string>;
  mark: (name: string, status: "present" | "absent") => void;
  updateAbsenceReason: (name: string, reason: string) => void;
  viewLearnerHistory: (name: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 70px 70px 90px",
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
        <p className="db-helper">No learners found for this view.</p>
      ) : (
        learners.map((learner) => (
          <div
            key={learner.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 70px 90px",
              gap: 8,
              padding: 8,
              border: "1px solid #F0E3D8",
              borderRadius: 12,
              marginBottom: 7,
              background: "#FFFFFF",
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
                minHeight: 34,
                padding: "7px 8px",
                fontSize: 12,
              }}
            >
              View
            </button>

            {attendance[learner.name] === "absent" ? (
              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <select
                  className="db-input"
                  value={absenceReasons[learner.name] || ""}
                  onChange={(e) =>
                    updateAbsenceReason(learner.name, e.target.value)
                  }
                >
                  <option value="">Select absence reason</option>
                  <option value="Sick">Sick</option>
                  <option value="Family responsibility">
                    Family responsibility
                  </option>
                  <option value="Transport issue">Transport issue</option>
                  <option value="Weather">Weather</option>
                  <option value="No reason provided">No reason provided</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            ) : null}
          </div>
        ))
      )}
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

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  textAlign: "center" as const,
};

const pillGreen = {
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  textAlign: "center" as const,
};

const pillRed = {
  background: "#FDEDED",
  border: "1px solid #F3CACA",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  textAlign: "center" as const,
};

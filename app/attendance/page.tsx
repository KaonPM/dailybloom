"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type Learner = {
  id: number;
  name: string;
  class: string;
};

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];

  const [learners, setLearners] = useState<Learner[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [historyName, setHistoryName] = useState("");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile } = await getCurrentProfile();

    if (!profile) return;

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

    if (!error) {
      setLearners((data || []) as Learner[]);
    }

    await loadTodayAttendance(currentSchoolId);
  }

  async function loadTodayAttendance(currentSchoolId: number) {
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", currentSchoolId)
      .eq("attendance_date", today);

    const map: Record<string, string> = {};

    (data || []).forEach((row: any) => {
      map[row.learner_name] = row.status;
    });

    setAttendance(map);
  }

  function mark(name: string, status: string) {
    setAttendance((prev) => ({
      ...prev,
      [name]: status,
    }));
  }

  async function saveAttendance() {
    if (!schoolId) return;

    const rows = learners
      .filter((l) => attendance[l.name])
      .map((l) => ({
        school_id: schoolId,
        learner_name: l.name,
        status: attendance[l.name],
        attendance_date: today,
      }));

    if (rows.length === 0) {
      alert("Please mark at least one learner.");
      return;
    }

    await supabase
      .from("attendance")
      .delete()
      .eq("school_id", schoolId)
      .eq("attendance_date", today);

    const { error } = await supabase.from("attendance").insert(rows);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Attendance saved.");
  }

  async function viewHistory(name: string) {
    if (!schoolId) return;

    setHistoryName(name);

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("school_id", schoolId)
      .eq("learner_name", name)
      .gte("attendance_date", fromDate)
      .lte("attendance_date", toDate)
      .order("attendance_date", { ascending: false });

    setHistoryRows(data || []);
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Attendance</h2>
        <p className="db-page-subtitle">
          Today: {today} | {classroomName}
        </p>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 120px",
            gap: 8,
            marginBottom: 10,
            fontWeight: 700,
          }}
        >
          <div>Learner</div>
          <div>Present</div>
          <div>Absent</div>
          <div>History</div>
        </div>

        {learners.map((learner) => (
          <div
            key={learner.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px 120px",
              gap: 8,
              padding: 10,
              border: "1px solid #eee",
              borderRadius: 12,
              marginBottom: 8,
            }}
          >
            <div>{learner.name}</div>

            <button
              onClick={() => mark(learner.name, "present")}
              className="db-button-secondary"
            >
              {attendance[learner.name] === "present" ? "✓" : ""}
            </button>

            <button
              onClick={() => mark(learner.name, "absent")}
              className="db-button-secondary"
            >
              {attendance[learner.name] === "absent" ? "✓" : ""}
            </button>

            <button
              onClick={() => viewHistory(learner.name)}
              className="db-button-secondary"
            >
              View
            </button>
          </div>
        ))}

        <button
          onClick={saveAttendance}
          className="db-button-primary"
          style={{ width: "100%", marginTop: 10 }}
        >
          Save Attendance
        </button>
      </div>

      <div
        className="db-card db-card-yellow"
        style={{ padding: 16, marginTop: 18 }}
      >
        <h3>{historyName ? `${historyName} History` : "Attendance History"}</h3>

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            type="date"
            className="db-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className="db-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          {historyName ? (
            <button
              className="db-button-secondary"
              onClick={() => viewHistory(historyName)}
            >
              Refresh
            </button>
          ) : null}
        </div>

        {historyRows.map((row) => (
          <div
            key={row.id}
            style={{
              padding: 10,
              border: "1px solid #eee",
              borderRadius: 10,
              marginBottom: 8,
            }}
          >
            {row.attendance_date} - {row.status}
          </div>
        ))}
      </div>
    </div>
  );
}
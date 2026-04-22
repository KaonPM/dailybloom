"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { resolveSchoolContext } from "../../lib/school-context";

type Classroom = {
  id: number;
  classroom_name?: string | null;
  age_group?: string | null;
  capacity?: number | null;
  school_id?: number | null;
};

type Teacher = {
  id: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  classroom_name?: string | null;
};

type Learner = {
  id: number;
  name?: string | null;
  class?: string | null;
  date_of_birth?: string | null;
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
  notes?: string | null;
  teacher_notes?: string | null;
  created_at?: string | null;
  school_id?: number | null;
};

export default function ClassroomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");
  const classroomId = Number(params?.id);

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error || !context.schoolId) {
      router.push("/login");
      return;
    }

    const currentSchoolId = context.schoolId;

    const { data: room, error: roomError } = await supabase
      .from("classrooms")
      .select("*")
      .eq("id", classroomId)
      .eq("school_id", currentSchoolId)
      .single();

    if (roomError || !room) {
      router.push(
        schoolParam ? `/classrooms?school=${currentSchoolId}` : "/classrooms"
      );
      return;
    }

    setClassroom(room);

    const roomName = room.classroom_name || "";

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayDate = `${yyyy}-${mm}-${dd}`;

    const [teachersRes, learnersRes, attendanceRes, summariesRes] =
      await Promise.all([
        supabase
          .from("teachers")
          .select("*")
          .eq("school_id", currentSchoolId)
          .eq("classroom_name", roomName)
          .order("full_name", { ascending: true }),

        supabase
          .from("learners")
          .select("id, name, class, date_of_birth")
          .eq("school_id", currentSchoolId)
          .eq("class", roomName)
          .order("name", { ascending: true }),

        supabase
          .from("attendance")
          .select("id, learner_name, status, attendance_date, school_id")
          .eq("school_id", currentSchoolId)
          .eq("attendance_date", todayDate)
          .order("learner_name", { ascending: true }),

        supabase
          .from("summaries")
          .select("id, learner_name, notes, teacher_notes, created_at, school_id")
          .eq("school_id", currentSchoolId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const learnersData = (learnersRes.data || []) as Learner[];
    const learnerNames = new Set(
      learnersData.map((item) => String(item.name || "").trim().toLowerCase())
    );

    const attendanceData = ((attendanceRes.data || []) as AttendanceItem[]).filter(
      (item) => learnerNames.has(String(item.learner_name || "").trim().toLowerCase())
    );

    const summariesData = ((summariesRes.data || []) as SummaryItem[]).filter(
      (item) => learnerNames.has(String(item.learner_name || "").trim().toLowerCase())
    );

    setTeachers((teachersRes.data || []) as Teacher[]);
    setLearners(learnersData);
    setAttendance(attendanceData);
    setSummaries(summariesData);
    setLoading(false);
  }

  const attendanceStats = useMemo(() => {
    const present = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "present"
    ).length;
    const absent = attendance.filter(
      (item) => String(item.status || "").toLowerCase() === "absent"
    ).length;

    return { present, absent };
  }, [attendance]);

  if (loading) {
    return <p>Loading classroom...</p>;
  }

  if (!classroom) {
    return <p>Classroom not found.</p>;
  }

  const backHref = schoolParam ? `/classrooms?school=${schoolParam}` : "/classrooms";
  const roomName = classroom.classroom_name || "Classroom";
  const encodedRoom = encodeURIComponent(roomName);

  const learnersHref = schoolParam
    ? `/children?school=${schoolParam}&classroom=${encodedRoom}&action=add`
    : `/children?classroom=${encodedRoom}&action=add`;

  const teachersHref = schoolParam
    ? `/teachers?school=${schoolParam}&classroom=${encodedRoom}&action=add`
    : `/teachers?classroom=${encodedRoom}&action=add`;

  const attendanceHref = schoolParam
    ? `/attendance?school=${schoolParam}&classroom=${encodedRoom}`
    : `/attendance?classroom=${encodedRoom}`;

  const summariesHref = schoolParam
    ? `/summaries?school=${schoolParam}&classroom=${encodedRoom}&action=add`
    : `/summaries?classroom=${encodedRoom}&action=add`;

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#FFF8F2",
        paddingBottom: "24px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,#F8E8F0 0%, #FFF8F2 100%)",
          border: "1px solid #EBC9D8",
          borderRadius: "28px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 10px 24px rgba(45, 42, 62, 0.06)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 700,
            color: "#6D6888",
          }}
        >
          Classroom Overview
        </p>

        <h1
          style={{
            margin: "8px 0 0 0",
            fontSize: "34px",
            fontWeight: 800,
            color: "#2D2A3E",
          }}
        >
          {roomName}
        </h1>

        <p
          style={{
            marginTop: "10px",
            marginBottom: 0,
            color: "#5B5675",
            lineHeight: 1.6,
          }}
        >
          Age Group: {classroom.age_group || "Not added"} | Capacity:{" "}
          {classroom.capacity ?? "Not added"}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <StatCard label="Teachers" value={teachers.length} />
        <StatCard label="Learners" value={learners.length} />
        <StatCard label="Present Today" value={attendanceStats.present} />
        <StatCard label="Absent Today" value={attendanceStats.absent} />
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #F0E3D8",
          borderRadius: "24px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 8px 20px rgba(45, 42, 62, 0.05)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            color: "#2D2A3E",
            fontSize: "22px",
            fontWeight: 800,
          }}
        >
          Quick Actions
        </h3>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "14px",
          }}
        >
          <Link href={learnersHref} style={primaryButton}>
            Add Learner
          </Link>

          <Link href={teachersHref} style={secondaryButton}>
            Add Teacher
          </Link>

          <Link href={attendanceHref} style={secondaryButton}>
            Take Attendance
          </Link>

          <Link href={summariesHref} style={secondaryButton}>
            Write Summary
          </Link>

          <Link href={backHref} style={backButton}>
            Back to Classrooms
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <Panel title="Teachers">
          {teachers.length === 0 ? (
            <EmptyText text="No teachers assigned." />
          ) : (
            teachers.map((teacher) => (
              <MiniCard key={teacher.id}>
                <strong>{teacher.full_name || "Unnamed teacher"}</strong>
                <p style={miniText}>{teacher.email || "No email"}</p>
                <p style={miniText}>{teacher.phone || "No phone"}</p>
              </MiniCard>
            ))
          )}
        </Panel>

        <Panel title="Learners">
          {learners.length === 0 ? (
            <EmptyText text="No learners assigned." />
          ) : (
            learners.map((learner) => (
              <MiniCard key={learner.id}>
                <strong>{learner.name || "Unnamed learner"}</strong>
                <p style={miniText}>
                  DOB: {learner.date_of_birth || "Not added"}
                </p>
              </MiniCard>
            ))
          )}
        </Panel>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))",
          gap: "14px",
        }}
      >
        <Panel title="Today Attendance">
          {attendance.length === 0 ? (
            <EmptyText text="No attendance recorded for today." />
          ) : (
            attendance.map((item) => (
              <MiniCard key={item.id}>
                <strong>{item.learner_name || "Unnamed learner"}</strong>
                <p style={miniText}>Status: {item.status || "Not set"}</p>
                <p style={miniText}>
                  Date: {item.attendance_date || "Not set"}
                </p>
              </MiniCard>
            ))
          )}
        </Panel>

        <Panel title="Recent Summaries">
          {summaries.length === 0 ? (
            <EmptyText text="No recent summaries found." />
          ) : (
            summaries.slice(0, 8).map((item) => (
              <MiniCard key={item.id}>
                <strong>{item.learner_name || "Unnamed learner"}</strong>
                <p style={miniText}>
                  {item.teacher_notes || item.notes || "No note added"}
                </p>
                <p style={miniText}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : "No timestamp"}
                </p>
              </MiniCard>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
        borderRadius: "22px",
        padding: "18px",
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
      }}
    >
      <p style={{ margin: 0, color: "#5B5675", fontSize: "14px", fontWeight: 700 }}>
        {label}
      </p>
      <h2
        style={{
          margin: "8px 0 0 0",
          fontSize: "28px",
          color: "#2D2A3E",
          fontWeight: 800,
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
        borderRadius: "24px",
        padding: "18px",
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.05)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: "12px",
          color: "#2D2A3E",
          fontSize: "20px",
          fontWeight: 800,
        }}
      >
        {title}
      </h3>

      <div style={{ display: "grid", gap: "10px" }}>{children}</div>
    </div>
  );
}

function MiniCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFDFB",
        border: "1px solid #F0E3D8",
        borderRadius: "14px",
        padding: "12px",
      }}
    >
      {children}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p style={{ margin: 0, color: "#6D6888" }}>{text}</p>;
}

const miniText = {
  margin: "4px 0 0 0",
  fontSize: "13px",
  color: "#6D6888",
  lineHeight: 1.5,
};

const primaryButton = {
  background: "#7CCCF3",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};

const secondaryButton = {
  background: "#FFF3C4",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};

const backButton = {
  background: "#F8E8F0",
  color: "#2D2A3E",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "14px",
};
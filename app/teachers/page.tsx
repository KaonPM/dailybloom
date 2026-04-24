"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type TeacherItem = {
  id: number;
  school_id?: number | null;
  full_name?: string | null;
  email?: string | null;
  classroom_name?: string | null;
  created_at?: string | null;
};

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
};

export default function TeachersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [classroomName, setClassroomName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchTeachers(context.schoolId),
      fetchClassrooms(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchTeachers(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers((data || []) as TeacherItem[]);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms((data || []) as ClassroomItem[]);
  }

  async function createTeacherLogin() {
    if (!schoolId) {
      alert("School context is missing.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !temporaryPassword.trim()) {
      alert("Please complete teacher name, email, and temporary password.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/create-teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim(),
        password: temporaryPassword.trim(),
        school_id: Number(schoolId),
        classroom_name: classroomName || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not create teacher login.");
      setSaving(false);
      return;
    }

    setFullName("");
    setEmail("");
    setTemporaryPassword("");
    setClassroomName("");

    await fetchTeachers(Number(schoolId));

    setSaving(false);
    alert("Teacher login created successfully.");
  }

  if (loading) {
    return <p>Loading teachers...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Teachers</h2>
        <p className="db-page-subtitle">
          Create teacher logins, assign teachers to classes, and manage teacher access.
        </p>
      </div>

      <div className="db-card db-card-green" style={{ padding: "20px", marginBottom: "24px" }}>
        <h3 style={sectionTitle}>Create Teacher Login</h3>

        <input
          className="db-input"
          placeholder="Teacher Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className="db-input"
          placeholder="Teacher Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="db-input"
          placeholder="Temporary Password"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
        />

        <select
          className="db-input"
          value={classroomName}
          onChange={(e) => setClassroomName(e.target.value)}
        >
          <option value="">Assign Classroom Optional</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.classroom_name || ""}>
              {classroom.classroom_name}
            </option>
          ))}
        </select>

        <button
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={createTeacherLogin}
          disabled={saving}
        >
          {saving ? "Creating..." : "Create Teacher Login"}
        </button>
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Teacher List ({teachers.length})</h3>

        {teachers.length === 0 ? (
          <p className="db-helper">No teachers created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {teachers.map((teacher) => (
              <div key={teacher.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>
                  {teacher.full_name || "Unnamed teacher"}
                </strong>
                <p style={textStyle}>Email: {teacher.email || "Not added"}</p>
                <p style={textStyle}>
                  Classroom: {teacher.classroom_name || "Not assigned"}
                </p>
                <p style={metaTextStyle}>
                  Created:{" "}
                  {teacher.created_at
                    ? new Date(teacher.created_at).toLocaleString()
                    : "No timestamp"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "#8A84A3",
  fontSize: "12px",
};
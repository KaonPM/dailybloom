"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type TeacherRow = {
  id: string;
  school_id?: number | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  classroom_name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
};

export default function TeachersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(
    null
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      .from("profiles")
      .select(
        "id, school_id, full_name, email, role, classroom_name, is_active, created_at"
      )
      .eq("school_id", currentSchoolId)
      .eq("role", "teacher")
      .order("full_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers((data || []) as TeacherRow[]);
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

    setClassrooms((data || []) as ClassroomRow[]);
  }

  function getClassroomName(room: ClassroomRow) {
    return room.classroom_name || "Unnamed classroom";
  }

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setClassroomName("");
    setEditingId(null);
  }

  function startEdit(teacher: TeacherRow) {
    setEditingId(teacher.id);
    setFullName(teacher.full_name || "");
    setEmail(teacher.email || "");
    setPassword("");
    setClassroomName(teacher.classroom_name || "");
    setSelectedTeacher(teacher);
    setShowForm(true);
  }

  async function saveTeacher() {
    if (!schoolId) return;

    if (!fullName.trim() || !email.trim()) {
      alert("Please complete full name and email.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          classroom_name: classroomName || null,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      resetForm();
      setShowForm(false);
      await fetchTeachers(schoolId);

      setSaving(false);
      alert("Teacher updated.");
      return;
    }

    if (!password.trim()) {
      alert("Please add a temporary password.");
      setSaving(false);
      return;
    }

    let createResponse: Response;

    try {
      createResponse = await fetch("/api/create-teacher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school_id: schoolId,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          classroom_name: classroomName || null,
        }),
      });
    } catch {
      alert("Could not reach the teacher creation service.");
      setSaving(false);
      return;
    }

    let result: any = {};

    try {
      result = await createResponse.json();
    } catch {
      alert("Teacher creation returned an invalid response.");
      setSaving(false);
      return;
    }

    if (!createResponse.ok) {
      alert(result.error || "Could not create teacher.");
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchTeachers(schoolId);

    setSaving(false);
    alert("Teacher created.");
  }

  async function toggleTeacherStatus(teacher: TeacherRow) {
    const nextValue = teacher.is_active === false ? true : false;

    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: nextValue,
      })
      .eq("id", teacher.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (schoolId) {
      await fetchTeachers(schoolId);
    }
  }

  if (loading) {
    return <p>Loading teachers...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">Teachers</h2>
            <p className="db-page-subtitle">
              Manage teachers, classroom assignments, and access.
            </p>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              resetForm();
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? "Close" : "Add Teacher"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>
            {editingId ? "Edit Teacher" : "Add Teacher"}
          </h3>

          <div style={grid2}>
            <div>
              <p style={labelText}>Full Name</p>
              <input
                className="db-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Teacher full name"
              />
            </div>

            <div>
              <p style={labelText}>Email</p>
              <input
                className="db-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@email.com"
              />
            </div>
          </div>

          {!editingId ? (
            <div style={{ marginTop: 10 }}>
              <p style={labelText}>Temporary Password</p>
              <input
                type="password"
                className="db-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary password"
              />
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <p style={labelText}>Assign Classroom</p>
            <select
              className="db-input"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
            >
              <option value="">Select classroom</option>

              {classrooms.map((room) => {
                const roomName = getClassroomName(room);

                return (
                  <option key={room.id} value={roomName}>
                    {roomName}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={saveTeacher}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Teacher"
              : "Create Teacher"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Teachers ({teachers.length})</h3>

        {teachers.length === 0 ? (
          <p className="db-helper">No teachers added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {teachers.map((teacher) => {
              const active = selectedTeacher?.id === teacher.id;

              return (
                <div key={teacher.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacher(active ? null : teacher)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1fr 140px",
                      gap: 8,
                      alignItems: "center",
                      background: active ? "#EAF7FD" : "#FFFDFB",
                      border: active
                        ? "1px solid #CBEAF7"
                        : "1px solid #F0E3D8",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "#2D2A3E",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <strong>{teacher.full_name || "Unnamed teacher"}</strong>

                    <span
                      style={teacher.is_active === false ? pillRed : pillGreen}
                    >
                      {teacher.is_active === false ? "Inactive" : "Active"}
                    </span>
                  </button>

                  {active ? (
                    <div
                      style={{
                        background: "#FFFDFB",
                        border: "1px solid #F0E3D8",
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                      }}
                    >
                      <p style={smallText}>
                        Email: {teacher.email || "No email"}
                      </p>

                      <p style={smallText}>
                        Classroom: {teacher.classroom_name || "Not assigned"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => startEdit(teacher)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => toggleTeacherStatus(teacher)}
                        >
                          {teacher.is_active === false
                            ? "Activate"
                            : "Deactivate"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const pillGreen = {
  background: "#EAF8EE",
  border: "1px solid #CDEED8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  textAlign: "center" as const,
};

const pillRed = {
  background: "#FDEDED",
  border: "1px solid #F3CACA",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  textAlign: "center" as const,
};
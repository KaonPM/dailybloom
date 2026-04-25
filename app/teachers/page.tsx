"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

export default function TeachersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classroomName, setClassroomName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initPage();
  }, []);

  useEffect(() => {
    if (schoolId) {
      loadTeachers(schoolId);
      loadClassrooms(schoolId);
    }
  }, [schoolId]);

  async function initPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (!context.schoolId) {
      router.push("/dashboard");
      return;
    }

    setSchoolId(context.schoolId);
    setLoading(false);
  }

  async function loadTeachers(id: number) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "teacher")
      .eq("school_id", id)
      .order("full_name", { ascending: true });

    if (!error) {
      setTeachers(data || []);
    }
  }

  async function loadClassrooms(id: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", id)
      .order("classroom_name");

    if (!error) {
      setClassrooms(data || []);
    }
  }

  async function createTeacher() {
    if (!schoolId) return;

    setSaving(true);

    const response = await fetch("/api/create-teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: schoolId,
        full_name: fullName,
        email,
        password,
        classroom_name: classroomName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not create teacher");
      setSaving(false);
      return;
    }

    setFullName("");
    setEmail("");
    setPassword("");
    setClassroomName("");
    setShowForm(false);

    await loadTeachers(schoolId);

    setSaving(false);
    alert("Teacher created");
  }

  if (loading) return <p>Loading teachers...</p>;

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
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
            className="db-button-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Close" : "Add Teacher"}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <input
            className="db-input"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <input
            className="db-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <input
            className="db-input"
            type="password"
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <select
            className="db-input"
            value={classroomName}
            onChange={(e) => setClassroomName(e.target.value)}
          >
            <option value="">Select classroom</option>

            {classrooms.map((room) => (
              <option key={room.id} value={room.classroom_name}>
                {room.classroom_name}
              </option>
            ))}
          </select>

          <div style={{ height: 12 }} />

          <button
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={createTeacher}
            disabled={saving}
          >
            {saving ? "Saving..." : "Create Teacher"}
          </button>
        </div>
      )}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Teachers ({teachers.length})</h3>

        {teachers.length === 0 ? (
          <p>No teachers added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  border: "1px solid #E9E2D8",
                  borderRadius: 12,
                  padding: 12,
                  background: "#FFFDFB",
                }}
              >
                <strong>{teacher.full_name}</strong>
                <p style={{ margin: "6px 0 0 0" }}>{teacher.email}</p>
                <p style={{ margin: "4px 0 0 0", color: "#6D6888" }}>
                  {teacher.classroom_name || "No classroom assigned"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
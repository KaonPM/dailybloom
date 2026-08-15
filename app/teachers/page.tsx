"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import PasswordInput from "../components/PasswordInput";

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
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);
  const [teachersListOpen, setTeachersListOpen] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [classroomName, setClassroomName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

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
    const response = await authenticatedFetch("/api/list-teachers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school_id: id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not load practitioners.");
      return;
    }

    setTeachers(result.teachers || []);
  }

  async function loadClassrooms(id: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", id)
      .order("classroom_name");

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms(data || []);
  }

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setClassroomName("");
    setEditingId(null);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
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
      const emailResponse = await authenticatedFetch("/api/account-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editingId,
          school_id: schoolId,
          role: "teacher",
          email: email.trim(),
        }),
      });
      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) {
        alert(emailResult.error || "Could not update the practitioner email.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          classroom_name: classroomName || null,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      closeForm();
      await loadTeachers(schoolId);

      setSaving(false);
      alert("Practitioner updated.");
      return;
    }

    if (!password.trim()) {
      alert("Please add a temporary password.");
      setSaving(false);
      return;
    }

    const response = await authenticatedFetch("/api/create-teacher", {
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

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not create practitioner.");
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await loadTeachers(schoolId);

    setSaving(false);
    alert(result.message || "Practitioner created. Login email sent.");
  }

  async function resendTeacherLogin(teacher: TeacherRow) {
    if (!teacher.email) {
      alert("This practitioner does not have an email address.");
      return;
    }

    const confirmed = confirm(
      `Resend login email to ${teacher.full_name || teacher.email}? This will create a new temporary password.`
    );

    if (!confirmed) return;

    try {
      setResendingId(teacher.id);

      const response = await authenticatedFetch("/api/resend-teacher-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: teacher.email, school_id: schoolId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Could not resend practitioner login email.");
        return;
      }

      alert(result.message || "Practitioner login email resent.");
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Could not resend practitioner login email.");
    } finally {
      setResendingId(null);
    }
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
      await loadTeachers(schoolId);
    }
  }

  async function deleteTeacher(teacher: TeacherRow) {
    const confirmed = confirm(
      `Remove ${teacher.full_name || "this practitioner"} from this school? Their past records will remain available, and their login can be reassigned to another school later.`
    );

    if (!confirmed) return;

    const response = await authenticatedFetch("/api/delete-teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacher_id: teacher.id, school_id: schoolId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Could not delete practitioner.");
      return;
    }

    setSelectedTeacher(null);

    if (schoolId) {
      await loadTeachers(schoolId);
    }

    alert(result.message || "Practitioner removed from this school.");
  }

  if (loading) return <p>Loading practitioners...</p>;

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
            <h2 className="db-page-title">Practitioners</h2>
            <p className="db-page-subtitle">
              Manage practitioners, classroom assignments, and access.
            </p>

            <Link
              href={schoolParam && schoolId ? `/master/school/${schoolId}` : "/dashboard"}
              className="db-main-pill"
              style={backButton}
            >
              Back to School Overview
            </Link>
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={() => {
              if (showForm) {
                closeForm();
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
          >
            {showForm ? "Close" : "Add Practitioner"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={sectionTitle}>
              {editingId ? "Edit Practitioner" : "Add Practitioner"}
            </h3>
            <button type="button" className="db-button-secondary" onClick={closeForm} disabled={saving}>
              Close
            </button>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Full Name</p>
              <input
                className="db-input"
                placeholder="Practitioner full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Email</p>
              <input
                className="db-input"
                placeholder="practitioner@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {editingId ? (
                <p style={hintText}>
                  Updating this changes the email the practitioner uses to sign in.
                </p>
              ) : null}
            </div>
          </div>

          {!editingId ? (
            <div style={{ marginTop: 10 }}>
              <p style={labelText}>Temporary Password</p>
              <PasswordInput
                className="db-input"
                placeholder="Temporary password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
              {classrooms.map((room) => (
                <option key={room.id} value={room.classroom_name || ""}>
                  {room.classroom_name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={saveTeacher}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Practitioner"
              : "Create Practitioner"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 style={sectionTitle}>Practitioners ({teachers.length})</h3>
          <button type="button" className="db-button-secondary" onClick={() => setTeachersListOpen((current) => !current)} aria-expanded={teachersListOpen}>
            {teachersListOpen ? "Close" : "Open"} list
          </button>
        </div>

        {teachersListOpen && (teachers.length === 0 ? (
          <p className="db-helper">No practitioners added yet.</p>
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
                      gridTemplateColumns: "1fr 130px 110px",
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
                    <strong>{teacher.full_name || "Unnamed practitioner"}</strong>

                    <span style={pillNeutral}>
                      {teacher.classroom_name || "No class"}
                    </span>

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
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => setSelectedTeacher(null)}
                        >
                          Close
                        </button>
                      </div>
                      <p style={smallText}>Email: {teacher.email || "No email"}</p>

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
                          onClick={() => resendTeacherLogin(teacher)}
                          disabled={resendingId === teacher.id}
                        >
                          {resendingId === teacher.id
                            ? "Sending..."
                            : "Resend Login Email"}
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => toggleTeacherStatus(teacher)}
                        >
                          {teacher.is_active === false ? "Activate" : "Deactivate"}
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => deleteTeacher(teacher)}
                        >
                          Remove from School
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
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

const hintText = {
  margin: "6px 0 0 0",
  color: "#8A849E",
  fontSize: 12,
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
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillRed = {
  background: "#FDEDED",
  border: "1px solid #F3CACA",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const pillNeutral = {
  background: "#F8F4FF",
  border: "1px solid #E7DFF8",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  textAlign: "center" as const,
};

const backButton = {
  display: "inline-block",
  marginTop: 12,
  textDecoration: "none",
  background: "#FFFFFF",
  color: "#2D2A3E",
  border: "1px solid #E3D9CD",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 13,
};

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { resolveSchoolContext } from "../lib/school-context";

type ClassroomRow = {
  id: number;
  school_id?: number | null;
  classroom_name?: string | null;
  name?: string | null;
  created_at?: string | null;
};

type LearnerRow = {
  id: number;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
};

type TeacherRow = {
  id: string;
  full_name?: string | null;
  classroom_name?: string | null;
};

export default function ClassroomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomRow | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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
      fetchClassrooms(context.schoolId),
      fetchLearners(context.schoolId),
      fetchTeachers(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchClassrooms(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("classroom_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setClassrooms((data || []) as ClassroomRow[]);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, classroom_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerRow[]);
  }

  async function fetchTeachers(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, classroom_name")
      .eq("school_id", currentSchoolId)
      .eq("role", "teacher")
      .order("full_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers((data || []) as TeacherRow[]);
  }

  function getClassroomName(room: ClassroomRow) {
    return room.classroom_name || room.name || "Unnamed classroom";
  }

  function resetForm() {
    setClassroomName("");
    setEditingId(null);
  }

  function startEdit(room: ClassroomRow) {
    setEditingId(room.id);
    setClassroomName(getClassroomName(room));
    setSelectedClassroom(room);
    setShowForm(true);
  }

  async function saveClassroom() {
    if (!schoolId) return;

    if (!classroomName.trim()) {
      alert("Please enter classroom name.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const oldClassroom = classrooms.find((room) => room.id === editingId);
      const oldName = oldClassroom ? getClassroomName(oldClassroom) : "";

      const { error } = await supabase
        .from("classrooms")
        .update({
          classroom_name: classroomName.trim(),
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      if (oldName && oldName !== classroomName.trim()) {
        await supabase
          .from("learners")
          .update({ class: classroomName.trim() })
          .eq("school_id", schoolId)
          .eq("class", oldName);

        await supabase
          .from("profiles")
          .update({ classroom_name: classroomName.trim() })
          .eq("school_id", schoolId)
          .eq("classroom_name", oldName);
      }

      resetForm();
      setShowForm(false);

      await Promise.all([
        fetchClassrooms(schoolId),
        fetchLearners(schoolId),
        fetchTeachers(schoolId),
      ]);

      setSaving(false);
      alert("Classroom updated.");
      return;
    }

    const { error } = await supabase.from("classrooms").insert([
      {
        school_id: schoolId,
        classroom_name: classroomName.trim(),
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchClassrooms(schoolId);

    setSaving(false);
    alert("Classroom added.");
  }

  async function deleteClassroom(room: ClassroomRow) {
    if (!schoolId) return;

    const roomName = getClassroomName(room);
    const hasLearners = learners.some((learner) => learner.class === roomName);
    const hasTeachers = teachers.some((teacher) => teacher.classroom_name === roomName);

    if (hasLearners || hasTeachers) {
      alert(
        "This classroom has learners or teachers linked to it. Move them first before deleting."
      );
      return;
    }

    const confirmed = confirm("Delete this classroom?");
    if (!confirmed) return;

    const { error } = await supabase.from("classrooms").delete().eq("id", room.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedClassroom?.id === room.id) {
      setSelectedClassroom(null);
    }

    await fetchClassrooms(schoolId);
    alert("Classroom deleted.");
  }

  const classroomStats = useMemo(() => {
    return classrooms.map((room) => {
      const roomName = getClassroomName(room);

      const learnerCount = learners.filter(
        (learner) => learner.class === roomName || learner.classroom_id === room.id
      ).length;

      const teacherCount = teachers.filter(
        (teacher) => teacher.classroom_name === roomName
      ).length;

      return {
        room,
        roomName,
        learnerCount,
        teacherCount,
      };
    });
  }, [classrooms, learners, teachers]);

  const selectedStats = selectedClassroom
    ? classroomStats.find((item) => item.room.id === selectedClassroom.id)
    : null;

  const selectedLearners = selectedStats
    ? learners.filter(
        (learner) =>
          learner.class === selectedStats.roomName ||
          learner.classroom_id === selectedStats.room.id
      )
    : [];

  const selectedTeachers = selectedStats
    ? teachers.filter((teacher) => teacher.classroom_name === selectedStats.roomName)
    : [];

  if (loading) {
    return <p>Loading classrooms...</p>;
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
            <h2 className="db-page-title">Classrooms</h2>
            <p className="db-page-subtitle">
              Manage classrooms, view linked learners, and see assigned teachers.
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
            {showForm ? "Close" : "Add Classroom"}
          </button>
        </div>
      </div>

      {showForm ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>
            {editingId ? "Edit Classroom" : "Add Classroom"}
          </h3>

          <p style={labelText}>Classroom Name</p>
          <input
            className="db-input"
            value={classroomName}
            onChange={(e) => setClassroomName(e.target.value)}
            placeholder="Dolphins, Butterflies, Cubs..."
          />

          <button
            type="button"
            className="db-button-primary"
            onClick={saveClassroom}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Classroom"
              : "Save Classroom"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Classrooms ({classrooms.length})</h3>

        {classrooms.length === 0 ? (
          <p className="db-helper">No classrooms added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {classroomStats.map((item) => {
              const active = selectedClassroom?.id === item.room.id;

              return (
                <div key={item.room.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedClassroom(active ? null : item.room)
                    }
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1fr 110px 110px",
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
                    <strong>{item.roomName}</strong>
                    <span style={pillBlue}>{item.learnerCount} learners</span>
                    <span style={pillNeutral}>{item.teacherCount} teachers</span>
                  </button>

                  {active && selectedStats ? (
                    <div
                      style={{
                        background: "#FFFDFB",
                        border: "1px solid #F0E3D8",
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 8,
                      }}
                    >
                      <h3 style={sectionTitle}>{selectedStats.roomName}</h3>

                      <div style={miniGrid}>
                        <MiniBlock label="Learners" value={selectedStats.learnerCount} />
                        <MiniBlock label="Teachers" value={selectedStats.teacherCount} />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <p style={labelText}>Assigned Teachers</p>

                        {selectedTeachers.length === 0 ? (
                          <p className="db-helper">No teacher assigned.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {selectedTeachers.map((teacher) => (
                              <div key={teacher.id} style={compactRow}>
                                {teacher.full_name || "Unnamed teacher"}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <p style={labelText}>Learners</p>

                        {selectedLearners.length === 0 ? (
                          <p className="db-helper">No learners in this classroom.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {selectedLearners.map((learner) => (
                              <div key={learner.id} style={compactRow}>
                                {learner.name || "Unnamed learner"}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

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
                          onClick={() => startEdit(selectedStats.room)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="db-button-secondary"
                          onClick={() => deleteClassroom(selectedStats.room)}
                        >
                          Delete
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

function MiniBlock({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <p style={smallText}>{label}</p>
      <strong style={{ color: "#2D2A3E", fontSize: 20 }}>{value}</strong>
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

const miniGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const compactRow = {
  background: "#FFFFFF",
  border: "1px solid #F0E3D8",
  borderRadius: 10,
  padding: "8px 10px",
  color: "#2D2A3E",
  fontSize: 14,
};

const pillBlue = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
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
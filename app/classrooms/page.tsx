"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
  age_group?: string | null;
  capacity?: number | null;
  school_id?: number | null;
};

type TeacherItem = {
  id: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  classroom_name?: string | null;
};

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  date_of_birth?: string | null;
};

export default function ClassroomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [classroomName, setClassroomName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [capacity, setCapacity] = useState("");

  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);
  const [highlightAddForm, setHighlightAddForm] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const schoolParam = searchParams.get("school");
  const action = searchParams.get("action");

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (action === "add") {
      setShowAddForm(true);
      setHighlightAddForm(true);

      const timer = window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        window.setTimeout(() => {
          nameInputRef.current?.focus();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");
          const nextQuery = params.toString();

          router.replace(nextQuery ? `/classrooms?${nextQuery}` : "/classrooms", {
            scroll: false,
          });
        }, 350);
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [action, router, searchParams]);

  useEffect(() => {
    if (!highlightAddForm) return;

    const timer = window.setTimeout(() => {
      setHighlightAddForm(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightAddForm]);

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
      fetchTeachers(context.schoolId),
      fetchLearners(context.schoolId),
    ]);
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

    setClassrooms((data || []) as ClassroomItem[]);
  }

  async function fetchTeachers(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("full_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setTeachers((data || []) as TeacherItem[]);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, date_of_birth")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  async function addClassroom() {
    if (!classroomName.trim() || !schoolId) {
      alert("Please enter classroom name");
      return;
    }

    setLoading(true);

    const parsedCapacity = capacity.trim() === "" ? null : Number(capacity);

    if (
      capacity.trim() !== "" &&
      (parsedCapacity === null || Number.isNaN(parsedCapacity) || parsedCapacity < 0)
    ) {
      alert("Please enter a valid capacity");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("classrooms").insert([
      {
        classroom_name: classroomName.trim(),
        age_group: ageGroup.trim() || null,
        capacity: parsedCapacity,
        school_id: Number(schoolId),
      },
    ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setClassroomName("");
    setAgeGroup("");
    setCapacity("");

    await fetchClassrooms(Number(schoolId));
    setLoading(false);
    alert("Classroom added successfully");
  }

  const teachersByClassroom = useMemo(() => {
    const grouped: Record<string, TeacherItem[]> = {};

    teachers.forEach((teacher) => {
      const key = (teacher.classroom_name || "").trim();
      if (!key) return;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(teacher);
    });

    return grouped;
  }, [teachers]);

  const learnersByClassroom = useMemo(() => {
    const grouped: Record<string, LearnerItem[]> = {};

    learners.forEach((learner) => {
      const key = (learner.class || "").trim();
      if (!key) return;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(learner);
    });

    return grouped;
  }, [learners]);

  function getClassroomHref(classroomId: number) {
    if (schoolParam) {
      return `/classrooms/${classroomId}?school=${schoolParam}`;
    }

    return `/classrooms/${classroomId}`;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">Classrooms</h2>
        <p className="db-page-subtitle">
          Add and manage classrooms with live teacher and learner visibility.
        </p>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-pink"
        style={{
          padding: "20px",
          marginBottom: "24px",
          border: highlightAddForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightAddForm
            ? "0 0 0 4px rgba(124, 204, 243, 0.18)"
            : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h3 style={sectionTitle}>Add Classroom</h3>

          <button
            type="button"
            className="db-button-secondary"
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            {showAddForm ? "Hide Form" : "Show Form"}
          </button>
        </div>

        {showAddForm ? (
          <>
            <input
              ref={nameInputRef}
              className="db-input"
              placeholder="Classroom Name"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
            />

            <input
              className="db-input"
              placeholder="Age Group"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
            />

            <input
              className="db-input"
              type="number"
              placeholder="Capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />

            <button
              className="db-button-primary"
              style={{ width: "100%" }}
              onClick={addClassroom}
              disabled={loading}
            >
              {loading ? "Saving..." : "Add Classroom"}
            </button>
          </>
        ) : (
          <p className="db-helper">The add classroom form is hidden.</p>
        )}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>Classrooms ({classrooms.length})</h3>

        {classrooms.length === 0 ? (
          <p className="db-helper">No classrooms added yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {classrooms.map((classroom) => {
              const roomName = (classroom.classroom_name || "").trim();
              const assignedTeachers = teachersByClassroom[roomName] || [];
              const assignedLearners = learnersByClassroom[roomName] || [];

              return (
                <Link
                  key={classroom.id}
                  href={getClassroomHref(classroom.id)}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    className="db-list-card"
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "18px" }}>
                          {roomName || "Unnamed classroom"}
                        </strong>

                        <p style={textStyle}>
                          Age Group: {classroom.age_group || "Not added"}
                        </p>

                        <p style={textStyle}>
                          Capacity: {classroom.capacity ?? "Not added"}
                        </p>

                        <p style={textStyle}>
                          Teachers: {assignedTeachers.length}
                        </p>

                        <p style={textStyle}>
                          Learners: {assignedLearners.length}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#EAF7FD",
                          border: "1px solid #CBEAF7",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#2D2A3E",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Open Classroom
                      </div>
                    </div>

                    {assignedTeachers.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <strong style={miniHeading}>Assigned Teachers</strong>

                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                          {assignedTeachers.slice(0, 2).map((teacher) => (
                            <div key={teacher.id} style={miniCard}>
                              <strong>{teacher.full_name || "Unnamed teacher"}</strong>
                              <p style={miniText}>{teacher.email || "No email"}</p>
                            </div>
                          ))}

                          {assignedTeachers.length > 2 && (
                            <p style={moreText}>
                              + {assignedTeachers.length - 2} more teacher(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {assignedLearners.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <strong style={miniHeading}>Learners</strong>

                        <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                          {assignedLearners.slice(0, 3).map((learner) => (
                            <div key={learner.id} style={miniCard}>
                              <strong>{learner.name || "Unnamed learner"}</strong>
                              <p style={miniText}>
                                DOB: {learner.date_of_birth || "Not added"}
                              </p>
                            </div>
                          ))}

                          {assignedLearners.length > 3 && (
                            <p style={moreText}>
                              + {assignedLearners.length - 3} more learner(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
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

const miniHeading = {
  color: "var(--db-text)",
  fontSize: "14px",
};

const miniCard = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: "12px",
  padding: "10px 12px",
};

const miniText = {
  margin: "4px 0 0 0",
  fontSize: "13px",
  color: "var(--db-text-soft)",
};

const moreText = {
  margin: "2px 0 0 0",
  fontSize: "13px",
  color: "#6D6888",
  fontWeight: 700,
};
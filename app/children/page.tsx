"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";
import { getCurrentProfile } from "../lib/auth";

type LearnerRow = {
  id: number;
  name?: string | null;
  class?: string | null;
  classroom_id?: number | null;
  date_of_birth?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
};

type ClassroomRow = {
  id: number;
  classroom_name?: string | null;
};

type ProfileRow = {
  role?: string | null;
  classroom_name?: string | null;
  school_id?: number | null;
};

export default function LearnersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFilter = searchParams.get("filter");
  const schoolParam = searchParams.get("school");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);

  const [name, setName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const [selectedLearner, setSelectedLearner] = useState<LearnerRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile: currentProfile, error: profileError } =
      await getCurrentProfile();

    if (profileError || !currentProfile) {
      router.push("/login");
      return;
    }

    setProfile(currentProfile);

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
    ]);

    setLoading(false);
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

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, classroom_id, date_of_birth, parent_phone, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerRow[]);
  }

  const teacherClassroom = String(profile?.classroom_name || "").trim();

  const teacherClassroomId = useMemo(() => {
    if (!teacherClassroom) return null;

    const match = classrooms.find(
      (room) =>
        String(room.classroom_name || "").trim().toLowerCase() ===
        teacherClassroom.toLowerCase()
    );

    return match?.id || null;
  }, [classrooms, teacherClassroom]);

  const visibleLearners = useMemo(() => {
    let scopedLearners = learners;

    if (profile?.role === "teacher") {
      scopedLearners = learners.filter((learner) => {
        const learnerClass = String(learner.class || "").trim().toLowerCase();
        const teacherClass = teacherClassroom.toLowerCase();

        return (
          learnerClass === teacherClass ||
          (teacherClassroomId !== null &&
            Number(learner.classroom_id) === Number(teacherClassroomId))
        );
      });
    }

    if (activeFilter === "birthdays-today") {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      return scopedLearners.filter((learner) => {
        if (!learner.date_of_birth) return false;

        const dob = new Date(learner.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      });
    }

    return scopedLearners;
  }, [learners, profile, teacherClassroom, teacherClassroomId, activeFilter]);

  function resetForm() {
    setName("");
    setSelectedClassroomId("");
    setDateOfBirth("");
    setParentPhone("");
    setSelectedLearner(null);
  }

  async function addLearner() {
    if (!schoolId) return;

    if (!name.trim()) {
      alert("Please enter learner name.");
      return;
    }

    if (!selectedClassroomId) {
      alert("Please select a classroom.");
      return;
    }

    setSaving(true);

    const classroomMatch = classrooms.find(
      (item) => String(item.id) === String(selectedClassroomId)
    );

    if (!classroomMatch) {
      alert("Classroom not found.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("learners").insert([
      {
        name: name.trim(),
        class: classroomMatch.classroom_name || "Unassigned",
        classroom_id: classroomMatch.id,
        date_of_birth: dateOfBirth || null,
        parent_phone: parentPhone || null,
        school_id: schoolId,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    await fetchLearners(schoolId);

    setSaving(false);
    alert("Learner added.");
  }

  if (loading) {
    return <p>Loading learners...</p>;
  }

  const canAddLearner = profile?.role !== "teacher";

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
            <h2 className="db-page-title">
              {activeFilter === "birthdays-today" ? "Today’s Birthdays" : "Learners"}
            </h2>

            <p className="db-page-subtitle">
              {profile?.role === "teacher"
                ? `Viewing learners for ${teacherClassroom || "assigned classroom"}.`
                : "View learners first. Add a learner only when needed."}
            </p>
          </div>

          {canAddLearner && activeFilter !== "birthdays-today" ? (
            <button
              type="button"
              className="db-button-primary"
              onClick={() => {
                resetForm();
                setShowForm((prev) => !prev);
              }}
            >
              {showForm ? "Close" : "+ Add Learner"}
            </button>
          ) : null}
        </div>
      </div>

      {showForm && canAddLearner ? (
        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>
          <h3 style={sectionTitle}>Add Learner</h3>

          <div style={grid2}>
            <div>
              <p style={labelText}>Learner Name</p>
              <input
                className="db-input"
                placeholder="Learner name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Classroom</p>
              <select
                className="db-input"
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                <option value="">Select classroom</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.classroom_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={grid2}>
            <div>
              <p style={labelText}>Date of Birth</p>
              <input
                className="db-input"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div>
              <p style={labelText}>Parent Phone</p>
              <input
                className="db-input"
                placeholder="Parent phone number"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="db-button-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={addLearner}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Learner"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-lavender" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>
          {activeFilter === "birthdays-today"
            ? `Birthdays Today (${visibleLearners.length})`
            : `Learners (${visibleLearners.length})`}
        </h3>

        {visibleLearners.length === 0 ? (
          <p className="db-helper">
            {profile?.role === "teacher"
              ? "No learners found for your assigned classroom."
              : "No learners added yet."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {visibleLearners.map((learner) => {
              const active = selectedLearner?.id === learner.id;

              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => setSelectedLearner(active ? null : learner)}
                  style={{
                    background: active ? "#EAF7FD" : "#FFFDFB",
                    border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                    borderRadius: 16,
                    padding: 14,
                    textAlign: "left",
                    color: "#2D2A3E",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 15 }}>
                    {learner.name || "Unnamed learner"}
                  </strong>

                  <span style={smallText}>
                    {learner.class || "Unassigned"}
                  </span>

                  {active ? (
                    <div style={{ marginTop: 10 }}>
                      <p style={smallText}>
                        Date of Birth: {learner.date_of_birth || "Not added"}
                      </p>
                      <p style={smallText}>
                        Parent Phone: {learner.parent_phone || "Not added"}
                      </p>
                    </div>
                  ) : null}
                </button>
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
  display: "block",
  margin: "4px 0 0 0",
  color: "#6D6888",
  fontSize: 13,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginTop: 10,
};
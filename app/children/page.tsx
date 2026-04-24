"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  date_of_birth?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
  classroom_id?: number | null;
};

type ClassroomItem = {
  id: number;
  classroom_name?: string | null;
};

export default function LearnersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFilter = searchParams.get("filter");
  const schoolParam = searchParams.get("school");

  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [filteredLearners, setFilteredLearners] = useState<LearnerItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [learners, activeFilter]);

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
    ]);

    setPageLoading(false);
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

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  function applyFilter() {
    if (activeFilter === "birthdays-today") {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const todaysBirthdays = learners.filter((learner) => {
        if (!learner.date_of_birth) return false;

        const dob = new Date(learner.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      });

      setFilteredLearners(todaysBirthdays);
      return;
    }

    setFilteredLearners(learners);
  }

  async function addLearner() {
    if (!name.trim() || !schoolId) {
      alert("Please enter learner name.");
      return;
    }

    setLoading(true);

    let selectedClassroomName = "Unassigned";
    let parsedClassroomId: number | null = null;

    if (selectedClassroomId) {
      const classroomMatch = classrooms.find(
        (item) => String(item.id) === String(selectedClassroomId)
      );

      if (classroomMatch) {
        selectedClassroomName = classroomMatch.classroom_name || "Unassigned";
        parsedClassroomId = Number(classroomMatch.id);
      }
    }

    const payload: any = {
      name: name.trim(),
      class: selectedClassroomName,
      date_of_birth: dateOfBirth || null,
      parent_phone: parentPhone.trim() || null,
      school_id: Number(schoolId),
    };

    if (parsedClassroomId !== null) {
      payload.classroom_id = parsedClassroomId;
    }

    const { error } = await supabase.from("learners").insert([payload]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setName("");
    setSelectedClassroomId("");
    setDateOfBirth("");
    setParentPhone("");
    setShowAddForm(false);

    await fetchLearners(Number(schoolId));

    setLoading(false);
    alert("Learner added successfully.");
  }

  const selectedLearner = filteredLearners.find(
    (learner) => learner.id === selectedLearnerId
  );

  if (pageLoading) {
    return <p>Loading learners...</p>;
  }

  return (
    <div>
      <div
        className="db-soft-card"
        style={{
          padding: "18px 20px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="db-page-title">
              {activeFilter === "birthdays-today" ? "Today’s Birthdays" : "Learners"}
            </h2>

            <p className="db-page-subtitle">
              {activeFilter === "birthdays-today"
                ? "Learners celebrating birthdays today."
                : "View learners first. Add a learner only when needed."}
            </p>
          </div>

          {activeFilter !== "birthdays-today" ? (
            <button
              type="button"
              className="db-button-primary"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              {showAddForm ? "Close Form" : "+ Add Learner"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="db-card db-card-lavender"
        style={{
          padding: "16px",
          marginBottom: "18px",
        }}
      >
        <h3 style={sectionTitle}>
          {activeFilter === "birthdays-today"
            ? `Birthdays Today (${filteredLearners.length})`
            : `Learners (${filteredLearners.length})`}
        </h3>

        {filteredLearners.length === 0 ? (
          <p className="db-helper">
            {activeFilter === "birthdays-today"
              ? "No birthdays today."
              : "No learners added yet."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            {filteredLearners.map((learner) => {
              const isSelected = learner.id === selectedLearnerId;

              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() =>
                    setSelectedLearnerId(isSelected ? null : learner.id)
                  }
                  style={{
                    textAlign: "left",
                    background: isSelected ? "#EAF7FD" : "#FFFDFB",
                    border: isSelected
                      ? "1px solid #CBEAF7"
                      : "1px solid #F0E3D8",
                    borderRadius: "16px",
                    padding: "12px",
                    cursor: "pointer",
                    color: "#2D2A3E",
                    boxShadow: "0 6px 14px rgba(45, 42, 62, 0.04)",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      fontSize: "15px",
                      fontWeight: 700,
                      marginBottom: "4px",
                    }}
                  >
                    {learner.name || "Unnamed learner"}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "#6D6888",
                    }}
                  >
                    {learner.class || "Unassigned"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedLearner ? (
        <div
          className="db-card db-card-blue"
          style={{
            padding: "16px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={sectionTitle}>{selectedLearner.name}</h3>
              <p style={textStyle}>Class: {selectedLearner.class || "Unassigned"}</p>
              <p style={textStyle}>
                Date of Birth: {selectedLearner.date_of_birth || "Not added"}
              </p>
              <p style={textStyle}>
                Parent Phone: {selectedLearner.parent_phone || "Not added"}
              </p>
            </div>

            <button
              type="button"
              className="db-button-secondary"
              onClick={() => setSelectedLearnerId(null)}
            >
              Close Details
            </button>
          </div>
        </div>
      ) : null}

      {showAddForm && activeFilter !== "birthdays-today" ? (
        <div
          className="db-card db-card-green"
          style={{
            padding: "16px",
          }}
        >
          <h3 style={sectionTitle}>Add Learner</h3>

          <input
            className="db-input"
            placeholder="Learner Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <select
            className="db-input"
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
          >
            <option value="">Select Classroom</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.classroom_name}
              </option>
            ))}
          </select>

          <input
            className="db-input"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />

          <input
            className="db-input"
            placeholder="Parent Phone Number"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />

          <button
            className="db-button-primary"
            style={{ width: "100%" }}
            onClick={addLearner}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Learner"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: "10px",
  color: "var(--db-text)",
  fontSize: "20px",
  fontWeight: 700 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  fontSize: "14px",
  lineHeight: 1.5,
};
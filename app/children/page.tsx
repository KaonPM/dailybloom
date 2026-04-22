"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [filteredLearners, setFilteredLearners] = useState<LearnerItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(true);
  const [highlightAddForm, setHighlightAddForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const activeFilter = searchParams.get("filter");
  const schoolParam = searchParams.get("school");
  const classroomParam = searchParams.get("classroom");
  const action = searchParams.get("action");
  const returnTo = searchParams.get("returnTo");

  const shouldShowBackToOverview =
    returnTo === "school-overview" && schoolId !== null;
  const shouldShowBackToDashboard = returnTo === "dashboard";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [learners, activeFilter, classroomParam]);

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
          router.replace(nextQuery ? `/children?${nextQuery}` : "/children", {
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

  useEffect(() => {
    if (!classroomParam || classrooms.length === 0) return;

    const match = classrooms.find(
      (item) =>
        String(item.classroom_name || "").trim().toLowerCase() ===
        classroomParam.trim().toLowerCase()
    );

    if (match) {
      setSelectedClassroomId(String(match.id));
    }
  }, [classroomParam, classrooms]);

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

    await fetchClassrooms(context.schoolId);
    await fetchLearners(context.schoolId);
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

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("*")
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  function applyFilter() {
    let next = [...learners];

    if (classroomParam) {
      const targetClassroom = classroomParam.trim().toLowerCase();
      next = next.filter(
        (learner) => String(learner.class || "").trim().toLowerCase() === targetClassroom
      );
    }

    if (activeFilter === "birthdays-today") {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      next = next.filter((learner) => {
        if (!learner.date_of_birth) return false;
        const dob = new Date(learner.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      });
    }

    setFilteredLearners(next);
  }

  async function addLearner() {
    if (!name || !schoolId) {
      alert("Please enter learner name");
      return;
    }

    setLoading(true);
    setLastSavedSuccess(false);

    let selectedClassroomName = "Unassigned";
    let parsedClassroomId: number | null = null;

    if (
      selectedClassroomId &&
      selectedClassroomId !== "null" &&
      selectedClassroomId !== ""
    ) {
      const classroomMatch = classrooms.find(
        (item) => String(item.id) === String(selectedClassroomId)
      );

      if (classroomMatch) {
        selectedClassroomName = classroomMatch.classroom_name || "Unassigned";
        parsedClassroomId = Number(classroomMatch.id);
      }
    }

    const payload: any = {
      name,
      class: selectedClassroomName,
      date_of_birth: dateOfBirth || null,
      parent_phone: parentPhone || null,
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
    setSelectedClassroomId(classroomParam ? selectedClassroomId : "");
    setDateOfBirth("");
    setParentPhone("");

    await fetchLearners(Number(schoolId));
    setLoading(false);
    setLastSavedSuccess(true);
  }

  const classroomTitlePrefix = classroomParam ? `${classroomParam} ` : "";

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">
          {activeFilter === "birthdays-today"
            ? `${classroomTitlePrefix}Today’s Birthdays`
            : `${classroomTitlePrefix}Learners`}
        </h2>
        <p className="db-page-subtitle">
          {activeFilter === "birthdays-today"
            ? classroomParam
              ? `Learners in ${classroomParam} celebrating birthdays today.`
              : "Learners celebrating birthdays today."
            : classroomParam
            ? `Add and manage learners for ${classroomParam}.`
            : "Add and manage learners for this school."}
        </p>
      </div>

      {activeFilter !== "birthdays-today" && (
        <div
          ref={formRef}
          className="db-card db-card-blue"
          style={{
            padding: "20px",
            marginBottom: "24px",
            border: highlightAddForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
            boxShadow: highlightAddForm
              ? "0 0 0 4px rgba(124, 204, 243, 0.18)"
              : undefined,
            transition: "all 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <h3 style={sectionTitle}>
              {classroomParam ? `Add Learner to ${classroomParam}` : "Add Learner"}
            </h3>

            <button
              type="button"
              className="db-button-secondary"
              style={{ minHeight: "38px", padding: "8px 12px" }}
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              {showAddForm ? "Hide Form" : "Show Form"}
            </button>
          </div>

          {lastSavedSuccess && (
            <div
              style={{
                background: "#EEF9EE",
                border: "1px solid #D3EDD4",
                borderRadius: "14px",
                padding: "12px 14px",
                marginBottom: "14px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#2D2A3E",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Learner added successfully.
              </p>

              {shouldShowBackToOverview && (
                <button
                  type="button"
                  className="db-button-primary"
                  style={{ marginTop: "10px" }}
                  onClick={() => router.push(`/master/school/${schoolId}`)}
                >
                  Back to School Overview
                </button>
              )}

              {shouldShowBackToDashboard && (
                <button
                  type="button"
                  className="db-button-primary"
                  style={{ marginTop: "10px" }}
                  onClick={() => router.push("/dashboard")}
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          )}

          {showAddForm ? (
            <>
              <input
                ref={nameInputRef}
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
                <option value="">
                  {classroomParam ? `Assign to ${classroomParam}` : "Select Classroom"}
                </option>
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
                {loading ? "Saving..." : "Add Learner"}
              </button>
            </>
          ) : (
            <p className="db-helper">The add learner form is hidden.</p>
          )}
        </div>
      )}

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>
          {activeFilter === "birthdays-today"
            ? `${classroomTitlePrefix}Birthdays Today (${filteredLearners.length})`
            : `${classroomTitlePrefix}Learners (${filteredLearners.length})`}
        </h3>

        {filteredLearners.length === 0 ? (
          <p className="db-helper">
            {activeFilter === "birthdays-today"
              ? "No birthdays today."
              : classroomParam
              ? "No learners found for this classroom."
              : "No learners added yet."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredLearners.map((learner) => (
              <div key={learner.id} className="db-list-card">
                <strong style={{ fontSize: "17px" }}>{learner.name}</strong>
                <p style={textStyle}>Class: {learner.class || "Unassigned"}</p>
                <p style={textStyle}>
                  Date of Birth: {learner.date_of_birth || "Not added"}
                </p>
                <p style={textStyle}>
                  Parent Phone: {learner.parent_phone || "Not added"}
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
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";

type Learner = {
  id: number;
  name: string;
  class?: string | null;
};

type Summary = {
  id: number;
  learner_name?: string | null;
  health_safety?: string | null;
  meals?: string | null;
  rest?: string | null;
  mood?: string | null;
  today_highlight?: string | null;
  teacher_notes?: string | null;
  created_at?: string | null;
};

export default function SummariesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const today = new Date().toISOString().split("T")[0];

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classroomName, setClassroomName] = useState("");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);

  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);

  const [healthSafety, setHealthSafety] = useState("");
  const [meals, setMeals] = useState("");
  const [rest, setRest] = useState("");
  const [mood, setMood] = useState("");
  const [todayHighlight, setTodayHighlight] = useState("");
  const [teacherNotes, setTeacherNotes] = useState("");

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

    const { profile } = await getCurrentProfile();

    const teacherClass =
      profile?.role === "teacher" && profile?.classroom_name
        ? String(profile.classroom_name)
        : "";

    setSchoolId(context.schoolId);
    setClassroomName(teacherClass);

    await Promise.all([
      fetchLearners(context.schoolId, teacherClass),
      fetchSummaries(context.schoolId, teacherClass),
    ]);

    setLoading(false);
  }

  async function fetchLearners(currentSchoolId: number, teacherClass: string) {
    let query = supabase
      .from("learners")
      .select("id, name, class")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (teacherClass) {
      query = query.eq("class", teacherClass);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  async function fetchSummaries(currentSchoolId: number, teacherClass: string) {
    const { data, error } = await supabase
      .from("summaries")
      .select(
        "id, learner_name, health_safety, meals, rest, mood, today_highlight, teacher_notes, created_at"
      )
      .eq("school_id", currentSchoolId)
      .gte("created_at", `${today} 00:00:00`)
      .lt("created_at", `${today} 23:59:59`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    let rows = (data || []) as Summary[];

    if (teacherClass) {
      const learnerNames = learners.map((learner) =>
        String(learner.name || "").trim().toLowerCase()
      );

      rows = rows.filter((summary) =>
        learnerNames.includes(
          String(summary.learner_name || "").trim().toLowerCase()
        )
      );
    }

    setSummaries(rows);
  }

  function resetForm() {
    setHealthSafety("");
    setMeals("");
    setRest("");
    setMood("");
    setTodayHighlight("");
    setTeacherNotes("");
  }

  async function saveSummary() {
    if (!schoolId || !selectedLearner) {
      alert("Please select a learner.");
      return;
    }

    if (!healthSafety || !meals || !rest || !mood || !todayHighlight) {
      alert("Please complete all tick selections.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("summaries").insert([
      {
        school_id: schoolId,
        learner_name: selectedLearner.name,
        health_safety: healthSafety,
        meals,
        rest,
        mood,
        today_highlight: todayHighlight,
        teacher_notes: teacherNotes.trim() || null,
      },
    ]);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setSelectedLearner(null);

    await fetchSummaries(schoolId, classroomName);

    setSaving(false);
    alert("Summary saved.");
  }

  if (loading) {
    return <p>Loading summaries...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="db-page-title">Daily Summaries</h2>
        <p className="db-page-subtitle">
          Select a learner, tick the daily update options, and save the summary.
        </p>

        {classroomName ? (
          <p style={smallText}>Classroom view: {classroomName}</p>
        ) : null}
      </div>

      <div
        className="db-card db-card-lavender"
        style={{ padding: 16, marginBottom: 18 }}
      >
        <h3 style={sectionTitle}>Learners ({learners.length})</h3>

        {learners.length === 0 ? (
          <p className="db-helper">No learners found.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {learners.map((learner) => {
              const active = selectedLearner?.id === learner.id;

              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => {
                    setSelectedLearner(active ? null : learner);
                    resetForm();
                  }}
                  style={{
                    textAlign: "left",
                    background: active ? "#EAF7FD" : "#FFFDFB",
                    border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                    borderRadius: 14,
                    padding: 12,
                    cursor: "pointer",
                    color: "#2D2A3E",
                  }}
                >
                  <strong>{learner.name}</strong>
                  <p style={smallText}>{learner.class || "Unassigned"}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedLearner ? (
        <div
          className="db-card db-card-blue"
          style={{ padding: 16, marginBottom: 18 }}
        >
          <h3 style={sectionTitle}>{selectedLearner.name} Summary</h3>

          <TickGroup
            title="Health & Safety"
            value={healthSafety}
            onChange={setHealthSafety}
            options={[
              "No incident",
              "Minor scratch",
              "Fell",
              "Bumped head",
              "Nose bleed",
              "Vomited",
              "Fever / unwell",
              "Other concern",
            ]}
          />

          <TickGroup
            title="Meals"
            value={meals}
            onChange={setMeals}
            options={[
              "Ate well",
              "Ate a little",
              "Did not eat much",
              "Did not eat",
            ]}
          />

          <TickGroup
            title="Rest"
            value={rest}
            onChange={setRest}
            options={[
              "Napped well",
              "Short nap",
              "Did not nap",
              "Rested quietly",
            ]}
          />

          <TickGroup
            title="Mood"
            value={mood}
            onChange={setMood}
            options={[
              "Happy",
              "Calm",
              "Playful",
              "Tired",
              "Emotional",
              "Quiet",
              "Needed comfort",
            ]}
          />

          <TickGroup
            title="Today’s Highlight"
            value={todayHighlight}
            onChange={setTodayHighlight}
            options={[
              "Story time",
              "Outdoor play",
              "Creative work",
              "Music and movement",
              "Counting activity",
              "Played well with friends",
              "Tried something new",
            ]}
          />

          <div style={{ marginTop: 14 }}>
            <p style={labelText}>Teacher Notes Optional</p>
            <textarea
              className="db-input"
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="Anything extra for the parent?"
              rows={3}
              style={{
                width: "100%",
                minHeight: 90,
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="button"
            className="db-button-primary"
            onClick={saveSummary}
            disabled={saving}
            style={{ width: "100%", marginTop: 12 }}
          >
            {saving ? "Saving..." : "Save Summary"}
          </button>
        </div>
      ) : null}

      <div className="db-card db-card-green" style={{ padding: 16 }}>
        <h3 style={sectionTitle}>Saved Summaries Today ({summaries.length})</h3>

        {summaries.length === 0 ? (
          <p className="db-helper">No summaries saved for today yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {summaries.map((summary) => (
              <div key={summary.id} style={summaryRow}>
                <div>
                  <strong>{summary.learner_name || "Unnamed learner"}</strong>
                  <p style={smallText}>
                    Mood: {summary.mood || "Not added"} | Meals:{" "}
                    {summary.meals || "Not added"}
                  </p>
                </div>

                <span style={summaryPill}>
                  {summary.created_at
                    ? new Date(summary.created_at).toLocaleTimeString()
                    : "Saved"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TickGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={labelText}>{title}</p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {options.map((option) => {
          const active = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? "" : option)}
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                border: active ? "1px solid #7CCCF3" : "1px solid #E7DACE",
                background: active ? "#EAF7FD" : "#FFFFFF",
                color: "#2D2A3E",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {active ? "✓ " : ""}
              {option}
            </button>
          );
        })}
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

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
};

const summaryPill = {
  background: "#EAF7FD",
  border: "1px solid #CBEAF7",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  color: "#2D2A3E",
  whiteSpace: "nowrap" as const,
};
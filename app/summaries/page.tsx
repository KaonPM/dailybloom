"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { resolveSchoolContext } from "../lib/school-context";
import SubscriptionGuard from "../components/SubscriptionGuard";

type Learner = {
  id: string;
  name: string;
  class?: string | null;
  classroom_id?: number | null;
  parent_phone?: string | null;
};

type Classroom = {
  id: number;
  classroom_name?: string | null;
};

type PendingSummary = {
  id: number;
  learner_id: string;
  learner_name?: string | null;
  health_safety?: string | null;
  meals?: string | null;
  rest?: string | null;
  mood?: string | null;
  today_highlight?: string | null;
  teacher_notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const healthSafetyOptions = [
  "No concerns",
  "Minor bump",
  "Minor scratch",
  "Fell during play",
  "Not feeling well",
  "Parent to note",
];

const mealsOptions = [
  "Ate well",
  "Ate a little",
  "Did not eat much",
  "Refused meal",
];

const restOptions = [
  "Rested well",
  "Short nap",
  "Did not nap",
  "Quiet rest only",
];

const moodOptions = [
  "Happy",
  "Calm",
  "Playful",
  "Tired",
  "Emotional",
  "Quiet",
];

const highlightOptions = [
  "Enjoyed class activities",
  "Played well with friends",
  "Participated nicely",
  "Had a good learning day",
  "Needed extra support today",
];

export default function SummariesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [teacherClassroom, setTeacherClassroom] = useState("");

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [pendingSummaries, setPendingSummaries] = useState<PendingSummary[]>(
    []
  );

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(
    null
  );
  const [draftId, setDraftId] = useState<number | null>(null);

  const [healthSafety, setHealthSafety] = useState("");
  const [meals, setMeals] = useState("");
  const [rest, setRest] = useState("");
  const [mood, setMood] = useState("");
  const [todayHighlight, setTodayHighlight] = useState("");
  const [teacherNotes, setTeacherNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const { profile, error } = await getCurrentProfile();

    if (error || !profile) {
      router.push("/login");
      return;
    }

    const context = await resolveSchoolContext(schoolParam);

    if (context.error) {
      router.push("/login");
      return;
    }

    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }

    const currentSchoolId = Number(context.schoolId);

    setSchoolId(currentSchoolId);
    setRole(String(profile.role || ""));
    setTeacherClassroom(String(profile.classroom_name || ""));

    await Promise.all([
      fetchClassrooms(currentSchoolId),
      fetchLearners(currentSchoolId),
      fetchPendingSummaries(currentSchoolId),
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

    setClassrooms((data || []) as Classroom[]);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, classroom_id, parent_phone")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as Learner[]);
  }

  async function fetchPendingSummaries(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("summaries")
      .select(
        `
          id,
          learner_id,
          learner_name,
          health_safety,
          meals,
          rest,
          mood,
          today_highlight,
          teacher_notes,
          status,
          created_at
        `
      )
      .eq("school_id", currentSchoolId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setPendingSummaries((data || []) as PendingSummary[]);
  }

  const selectedClassroom = useMemo(() => {
    if (role === "teacher") {
      return classrooms.find(
        (room) =>
          String(room.classroom_name || "").trim().toLowerCase() ===
          teacherClassroom.trim().toLowerCase()
      );
    }

    if (!selectedClassroomId) return null;

    return classrooms.find(
      (room) => String(room.id) === String(selectedClassroomId)
    );
  }, [classrooms, role, teacherClassroom, selectedClassroomId]);

  const visibleLearners = useMemo(() => {
    if (!selectedClassroom) return [];

    const roomName = String(selectedClassroom.classroom_name || "").trim();
    const roomId = selectedClassroom.id;

    return learners.filter((learner) => {
      const learnerClass = String(learner.class || "").trim().toLowerCase();
      const classroomName = roomName.toLowerCase();

      return (
        learnerClass === classroomName ||
        Number(learner.classroom_id) === Number(roomId)
      );
    });
  }, [learners, selectedClassroom]);

  const selectedLearner = useMemo(() => {
    if (!selectedLearnerId) return null;

    return (
      visibleLearners.find((learner) => learner.id === selectedLearnerId) ||
      null
    );
  }, [visibleLearners, selectedLearnerId]);

  const visiblePendingSummaries = useMemo(() => {
    if (!visibleLearners.length) return [];

    const visibleIds = new Set(visibleLearners.map((learner) => learner.id));

    return pendingSummaries.filter((summary) =>
      visibleIds.has(summary.learner_id)
    );
  }, [pendingSummaries, visibleLearners]);

  function resetSummaryForm() {
    setHealthSafety("");
    setMeals("");
    setRest("");
    setMood("");
    setTodayHighlight("");
    setTeacherNotes("");
  }

  function closeSummaryForm() {
    setSelectedLearnerId(null);
    setDraftId(null);
    resetSummaryForm();
  }

  function resumeDraft(draft: PendingSummary) {
    setSelectedLearnerId(draft.learner_id);
    setDraftId(draft.id);
    setHealthSafety(draft.health_safety || "");
    setMeals(draft.meals || "");
    setRest(draft.rest || "");
    setMood(draft.mood || "");
    setTodayHighlight(draft.today_highlight || "");
    setTeacherNotes(draft.teacher_notes || "");
  }

  async function discardDraft(id: number) {
    const { error } = await supabase.from("summaries").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setPendingSummaries((current) => current.filter((item) => item.id !== id));

    if (draftId === id) {
      closeSummaryForm();
    }
  }

  async function saveDraft() {
    if (!schoolId || !selectedLearner) return;

    setSending(true);

    const payload = {
      school_id: schoolId,
      learner_id: selectedLearner.id,
      learner_name: selectedLearner.name,
      health_safety: healthSafety || null,
      meals: meals || null,
      rest: rest || null,
      mood: mood || null,
      today_highlight: todayHighlight || null,
      teacher_notes: teacherNotes.trim() || null,
      status: "draft",
    };

    if (draftId) {
      const { error } = await supabase
        .from("summaries")
        .update(payload)
        .eq("id", draftId);

      if (error) {
        alert(error.message);
        setSending(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("summaries")
        .insert([payload])
        .select("id")
        .single();

      if (error) {
        alert(error.message);
        setSending(false);
        return;
      }

      setDraftId(data.id);
    }

    await fetchPendingSummaries(schoolId);

    resetSummaryForm();
    setSelectedLearnerId(null);
    setDraftId(null);
    setSending(false);

    alert("Draft saved.");
  }

  async function sendSummaryToParent() {
    if (!schoolId || !selectedLearner) return;

    if (!healthSafety || !meals || !rest || !mood || !todayHighlight) {
      alert("Please complete all summary selections.");
      return;
    }

    setSending(true);

    const payload = {
      school_id: schoolId,
      learner_id: selectedLearner.id,
      learner_name: selectedLearner.name,
      health_safety: healthSafety,
      meals,
      rest,
      mood,
      today_highlight: todayHighlight,
      teacher_notes: teacherNotes.trim() || null,
      status: "sent",
      whatsapp_sent: false,
    };

    const { error } = draftId
      ? await supabase.from("summaries").update(payload).eq("id", draftId)
      : await supabase.from("summaries").insert([payload]);

    if (error) {
      alert(error.message);
      setSending(false);
      return;
    }

    fetch("/api/notifications/parent-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "daily_summary",
        school_id: schoolId,
        learner_name: selectedLearner.name,
        parent_phone: selectedLearner.parent_phone,
      }),
    }).catch((pushError) => {
      console.error("Could not send summary push notification:", pushError);
    });

    resetSummaryForm();
    setSelectedLearnerId(null);
    setDraftId(null);
    setSending(false);

    await fetchPendingSummaries(schoolId);

    alert("Summary sent to Parent successfully.");
  }

  if (loading || !schoolId) {
    return (
      <div style={{ padding: 20 }}>
        <p>Loading summaries...</p>
      </div>
    );
  }

  return (
    <SubscriptionGuard schoolId={schoolId} featureKey="daily_summaries">
      <div>
        <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 className="db-page-title">Daily Summaries</h2>

          <p className="db-page-subtitle">
            Send learner updates directly to the Parent Portal.
          </p>
        </div>

        {role !== "teacher" ? (
          <div
            className="db-card db-card-blue"
            style={{ padding: 16, marginBottom: 18 }}
          >
            <p style={labelText}>Select Classroom</p>

            <select
              className="db-input"
              value={selectedClassroomId}
              onChange={(e) => {
                setSelectedClassroomId(e.target.value);
                setSelectedLearnerId(null);
                setDraftId(null);
                resetSummaryForm();
              }}
            >
              <option value="">Select classroom</option>

              {classrooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.classroom_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div
          className="db-card db-card-lavender"
          style={{
            padding: 16,
            marginBottom: 18,
            minHeight: 0,
            height: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ ...sectionTitle, margin: 0 }}>Learners</h3>

            {selectedClassroom && visibleLearners.length > 0 ? (
              <select
                className="db-input"
                value={selectedLearnerId || ""}
                onChange={(e) => {
                  setSelectedLearnerId(e.target.value || null);
                  setDraftId(null);
                  resetSummaryForm();
                }}
                style={{ minWidth: 220 }}
              >
                <option value="">Select learner</option>

                {visibleLearners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {!selectedClassroom ? (
            <p className="db-helper" style={{ marginTop: 10, marginBottom: 0 }}>
              {role === "teacher"
                ? "No classroom assigned to this teacher."
                : "Please select a classroom to view learners."}
            </p>
          ) : visibleLearners.length === 0 ? (
            <p className="db-helper" style={{ marginTop: 10, marginBottom: 0 }}>
              No learners found for this classroom.
            </p>
          ) : null}
        </div>

        {selectedClassroom && visiblePendingSummaries.length > 0 ? (
          <div
            className="db-card"
            style={{
              padding: 16,
              marginBottom: 18,
              minHeight: 0,
              height: "auto",
              border: "1px solid #F0E3D8",
              borderTop: "4px solid #EF9F27",
            }}
          >
            <h3 style={sectionTitle}>
              Pending Summaries ({visiblePendingSummaries.length})
            </h3>

            <div style={{ display: "grid", gap: 8 }}>
              {visiblePendingSummaries.map((draft) => (
                <div
                  key={draft.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    background: "#FFFDFB",
                    border: "1px solid #F0E3D8",
                    borderRadius: 14,
                    padding: "10px 12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{draft.learner_name}</strong>
                    <p style={smallText}>Draft saved, not yet sent</p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => discardDraft(draft.id)}
                    >
                      Discard
                    </button>

                    <button
                      type="button"
                      onClick={() => resumeDraft(draft)}
                      style={resumeButton}
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedLearner ? (
          <div style={summaryCard}>
            <div style={summaryHeader}>
              <h3 style={sectionTitle}>Daily Summary</h3>

              <p style={smallText}>
                {selectedLearner.name} • {selectedLearner.class || "Unassigned"}
              </p>
            </div>

            <OptionGroup
              label="Health and Safety"
              options={healthSafetyOptions}
              value={healthSafety}
              setValue={setHealthSafety}
            />

            <OptionGroup
              label="Meals"
              options={mealsOptions}
              value={meals}
              setValue={setMeals}
            />

            <OptionGroup
              label="Rest"
              options={restOptions}
              value={rest}
              setValue={setRest}
            />

            <OptionGroup
              label="Mood"
              options={moodOptions}
              value={mood}
              setValue={setMood}
            />

            <OptionGroup
              label="Today’s Highlight"
              options={highlightOptions}
              value={todayHighlight}
              setValue={setTodayHighlight}
            />

            <div style={{ marginTop: 18 }}>
              <p style={labelText}>Additional Notes (Optional)</p>

              <textarea
                className="db-input"
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
                rows={4}
                placeholder="Write a short note if needed."
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 100,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={actionBar}>
              <div>
                <p style={statusLabel}>Summary Status</p>
                <strong style={statusText}>
                  {draftId ? "Saved as draft" : "Ready to send to Parent"}
                </strong>
              </div>

              <div style={actionButtons}>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={sending}
                  style={{
                    ...saveDraftButton,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? "Saving..." : "Save Draft"}
                </button>

                <button
                  type="button"
                  onClick={closeSummaryForm}
                  disabled={sending}
                  style={{
                    ...closeButton,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={sendSummaryToParent}
                  disabled={sending}
                  style={{
                    ...sendButton,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? "Sending..." : "Send to Parent"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SubscriptionGuard>
  );
}

function OptionGroup({
  label,
  options,
  value,
  setValue,
}: {
  label: string;
  options: string[];
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <p style={labelText}>{label}</p>

      <div style={optionWrap}>
        {options.map((option) => {
          const active = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setValue(active ? "" : option)}
              style={{
                background: active ? "#EAF7FD" : "#FFFDFB",
                border: active ? "1px solid #7CCCF3" : "1px solid #F0E3D8",
                borderRadius: 999,
                padding: "9px 14px",
                color: "#2D2A3E",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                whiteSpace: "normal",
                lineHeight: 1.35,
                maxWidth: "100%",
                wordBreak: "normal",
              }}
            >
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

const summaryCard = {
  background: "#fff",
  border: "1px solid #F0E3D8",
  borderTop: "6px solid #7CCB83",
  borderRadius: 18,
  padding: 20,
  marginBottom: 22,
  boxSizing: "border-box",
  overflow: "visible",
} as const;

const summaryHeader = {
  marginBottom: 20,
};

const optionWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "flex-start",
  maxWidth: "100%",
  overflow: "visible",
} as const;

const actionBar = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: "1px solid #EDE3DA",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
} as const;

const actionButtons = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
} as const;

const statusLabel = {
  margin: 0,
  color: "#6D6888",
  fontSize: 13,
  fontWeight: 700,
};

const statusText = {
  display: "block",
  marginTop: 4,
  color: "#2D2A3E",
  fontSize: 14,
};

const sendButton = {
  border: "none",
  borderRadius: 999,
  background: "#34A853",
  color: "#fff",
  padding: "11px 18px",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const saveDraftButton = {
  border: "none",
  borderRadius: 999,
  background: "#EF9F27",
  color: "#fff",
  padding: "11px 18px",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const closeButton = {
  border: "1px solid #E2D3C4",
  borderRadius: 999,
  background: "#F5EFE7",
  color: "#6D6888",
  padding: "11px 18px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const resumeButton = {
  border: "none",
  borderRadius: 999,
  background: "#7CCCF3",
  color: "#fff",
  padding: "9px 16px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

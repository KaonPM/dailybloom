"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveSchoolContext } from "../lib/school-context";

type LearnerItem = {
  id: number;
  name?: string | null;
  class?: string | null;
  parent_phone?: string | null;
  school_id?: number | null;
};

type SummaryItem = {
  id: number;
  learner_name?: string | null;
  mood?: string | null;
  health_safety?: string | null;
  meals?: string | null;
  rest?: string | null;
  today_highlight?: string | null;
  teacher_notes?: string | null;
  created_at?: string | null;
  school_id?: number | null;
};

type SchoolItem = {
  id: number;
  school_name?: string | null;
};

export default function SummariesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolParam = searchParams.get("school");
  const classroomParam = searchParams.get("classroom");
  const action = searchParams.get("action");
  const returnTo = searchParams.get("returnTo");

  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [school, setSchool] = useState<SchoolItem | null>(null);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);

  const [selectedLearner, setSelectedLearner] = useState("");
  const [healthSafety, setHealthSafety] = useState("");
  const [meals, setMeals] = useState("");
  const [rest, setRest] = useState("");
  const [mood, setMood] = useState("");
  const [todayHighlight, setTodayHighlight] = useState("");
  const [teacherNotes, setTeacherNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightForm, setHighlightForm] = useState(false);
  const [lastSavedSuccess, setLastSavedSuccess] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const learnerSelectRef = useRef<HTMLSelectElement | null>(null);

  const shouldShowBackToOverview =
    returnTo === "school-overview" && schoolId !== null;
  const shouldShowBackToDashboard = returnTo === "dashboard";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (action === "add") {
      setHighlightForm(true);

      const timer = window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        window.setTimeout(() => {
          learnerSelectRef.current?.focus();

          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");

          const nextQuery = params.toString();
          router.replace(nextQuery ? `/summaries?${nextQuery}` : "/summaries", {
            scroll: false,
          });
        }, 350);
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [action, router, searchParams]);

  useEffect(() => {
    if (!highlightForm) return;

    const timer = window.setTimeout(() => {
      setHighlightForm(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightForm]);

  async function loadPage() {
    const context = await resolveSchoolContext(schoolParam);

    if (context.error || !context.schoolId) {
      router.push("/login");
      return;
    }

    setSchoolId(context.schoolId);

    await Promise.all([
      fetchSchool(context.schoolId),
      fetchLearners(context.schoolId),
      fetchSummaries(context.schoolId),
    ]);

    setLoading(false);
  }

  async function fetchSchool(currentSchoolId: number) {
    const { data } = await supabase
      .from("schools")
      .select("id, school_name")
      .eq("id", currentSchoolId)
      .single();

    setSchool((data || null) as SchoolItem | null);
  }

  async function fetchLearners(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("learners")
      .select("id, name, class, parent_phone, school_id")
      .eq("school_id", currentSchoolId)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setLearners((data || []) as LearnerItem[]);
  }

  async function fetchSummaries(currentSchoolId: number) {
    const { data, error } = await supabase
      .from("summaries")
      .select(
        "id, learner_name, mood, health_safety, meals, rest, today_highlight, teacher_notes, created_at, school_id"
      )
      .eq("school_id", currentSchoolId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSummaries((data || []) as SummaryItem[]);
  }

  const filteredLearners = useMemo(() => {
    if (!classroomParam) return learners;

    const target = classroomParam.trim().toLowerCase();
    return learners.filter(
      (learner) => String(learner.class || "").trim().toLowerCase() === target
    );
  }, [learners, classroomParam]);

  const filteredSummaries = useMemo(() => {
    if (!classroomParam) return summaries;

    const allowedNames = new Set(
      filteredLearners.map((learner) =>
        String(learner.name || "").trim().toLowerCase()
      )
    );

    return summaries.filter((summary) =>
      allowedNames.has(String(summary.learner_name || "").trim().toLowerCase())
    );
  }, [summaries, filteredLearners, classroomParam]);

  function startEdit(summary: SummaryItem) {
    setEditingId(summary.id);
    setIsEditing(true);

    setSelectedLearner(summary.learner_name || "");
    setHealthSafety(summary.health_safety || "");
    setMeals(summary.meals || "");
    setRest(summary.rest || "");
    setMood(summary.mood || "");
    setTodayHighlight(summary.today_highlight || "");
    setTeacherNotes(summary.teacher_notes || "");
    setLastSavedSuccess(false);

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsEditing(false);

    setSelectedLearner("");
    setHealthSafety("");
    setMeals("");
    setRest("");
    setMood("");
    setTodayHighlight("");
    setTeacherNotes("");
  }

  async function saveSummary() {
    if (!schoolId || !selectedLearner) {
      alert("Please select a learner");
      return;
    }

    if (!healthSafety || !meals || !rest || !mood || !todayHighlight) {
      alert("Please complete all summary selections");
      return;
    }

    setSaving(true);
    setLastSavedSuccess(false);

    let error = null;

    if (isEditing && editingId) {
      const result = await supabase
        .from("summaries")
        .update({
          learner_name: selectedLearner,
          health_safety: healthSafety,
          meals,
          rest,
          mood,
          today_highlight: todayHighlight,
          teacher_notes: teacherNotes.trim() || null,
        })
        .eq("id", editingId);

      error = result.error;
    } else {
      const result = await supabase.from("summaries").insert([
        {
          learner_name: selectedLearner,
          health_safety: healthSafety,
          meals,
          rest,
          mood,
          today_highlight: todayHighlight,
          teacher_notes: teacherNotes.trim() || null,
          school_id: Number(schoolId),
        },
      ]);

      error = result.error;
    }

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    cancelEdit();
    await fetchSummaries(Number(schoolId));

    setSaving(false);
    setLastSavedSuccess(true);
  }

  function sanitizePhone(phone?: string | null) {
    if (!phone) return "";
    return phone.replace(/[^\d]/g, "");
  }

  function buildSummaryMessage(summary: SummaryItem) {
    const schoolName = school?.school_name || "DailyBloom School";
    const learnerName = summary.learner_name || "your child";

    return `Hello Parent,

Here is today’s update for ${learnerName} from ${schoolName}.

Health & Safety: ${summary.health_safety || "Not recorded"}
Meals: ${summary.meals || "Not recorded"}
Rest: ${summary.rest || "Not recorded"}
Mood: ${summary.mood || "Not recorded"}
Today's Highlight: ${summary.today_highlight || "Not recorded"}
Teacher Notes: ${summary.teacher_notes || "Not recorded"}

Thank you.`;
  }
async function logCommunication(params: {
  learnerName?: string | null;
  parentPhone?: string | null;
  communicationType: string;
  messagePreview: string;
}) {
  if (!schoolId) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  await supabase.from("communication_logs").insert([
    {
      school_id: Number(schoolId),
      learner_name: params.learnerName || null,
      parent_phone: params.parentPhone || null,
      communication_type: params.communicationType,
      channel: "whatsapp",
      message_preview: params.messagePreview.slice(0, 250),
      sent_by_user_id: session?.user?.id || null,
      status: "sent",
    },
  ]);
}
 async function sendSummaryWhatsApp(summary: SummaryItem) {
  const learner = learners.find(
    (item) =>
      String(item.name || "").trim().toLowerCase() ===
      String(summary.learner_name || "").trim().toLowerCase()
  );

  const phone = sanitizePhone(learner?.parent_phone);

  if (!phone) {
    alert("This learner does not have a parent phone number yet.");
    return;
  }

  const rawMessage = buildSummaryMessage(summary);

  await logCommunication({
    learnerName: summary.learner_name || null,
    parentPhone: learner?.parent_phone || null,
    communicationType: "summary",
    messagePreview: rawMessage,
  });

  const message = encodeURIComponent(rawMessage);
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
  window.open(whatsappUrl, "_blank");
}

  const backToClassroomHref =
    classroomParam && schoolParam
      ? `/classrooms?school=${schoolParam}`
      : classroomParam
      ? "/classrooms"
      : null;

  if (loading) {
    return <p>Loading summaries...</p>;
  }

  return (
    <div>
      <div className="db-soft-card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <h2 className="db-page-title">
          {classroomParam ? `${classroomParam} Summaries` : "Daily Summaries"}
        </h2>
        <p className="db-page-subtitle">
          {classroomParam
            ? `Write, review, and send summaries for ${classroomParam}.`
            : "Write, review, and send daily summaries for learners."}
        </p>
      </div>

      <div
        ref={formRef}
        className="db-card db-card-pink"
        style={{
          padding: "20px",
          marginBottom: "24px",
          border: highlightForm ? "2px solid #7CCCF3" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: highlightForm
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
            {isEditing
              ? "Edit Summary"
              : classroomParam
              ? `Write Summary for ${classroomParam}`
              : "Write Summary"}
          </h3>

          {backToClassroomHref ? (
            <Link href={backToClassroomHref} className="db-button-secondary">
              Back to Classrooms
            </Link>
          ) : null}
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
              {isEditing ? "Summary updated successfully." : "Summary saved successfully."}
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

        <select
          ref={learnerSelectRef}
          className="db-input"
          value={selectedLearner}
          onChange={(e) => setSelectedLearner(e.target.value)}
          disabled={isEditing}
        >
          <option value="">Select Learner</option>
          {filteredLearners.map((learner) => (
            <option key={learner.id} value={learner.name || ""}>
              {learner.name} {learner.class ? `(${learner.class})` : ""}
            </option>
          ))}
        </select>

        <select
          className="db-input"
          value={healthSafety}
          onChange={(e) => setHealthSafety(e.target.value)}
        >
          <option value="">Health & Safety</option>
          <option value="No incident">No incident</option>
          <option value="Minor scratch">Minor scratch</option>
          <option value="Small fall">Small fall</option>
          <option value="Nose bleed">Nose bleed</option>
          <option value="Vomited">Vomited</option>
          <option value="Fever noticed">Fever noticed</option>
          <option value="Parent informed">Parent informed</option>
        </select>

        <select
          className="db-input"
          value={meals}
          onChange={(e) => setMeals(e.target.value)}
        >
          <option value="">Meals</option>
          <option value="Ate well">Ate well</option>
          <option value="Ate a little">Ate a little</option>
          <option value="Did not eat much">Did not eat much</option>
        </select>

        <select
          className="db-input"
          value={rest}
          onChange={(e) => setRest(e.target.value)}
        >
          <option value="">Rest</option>
          <option value="Rested well">Rested well</option>
          <option value="Short nap">Short nap</option>
          <option value="Did not nap">Did not nap</option>
        </select>

        <select
          className="db-input"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
        >
          <option value="">Mood</option>
          <option value="Happy">Happy</option>
          <option value="Calm">Calm</option>
          <option value="Playful">Playful</option>
          <option value="Quiet">Quiet</option>
          <option value="Emotional">Emotional</option>
        </select>

        <select
          className="db-input"
          value={todayHighlight}
          onChange={(e) => setTodayHighlight(e.target.value)}
        >
          <option value="">Today’s Highlight</option>
          <option value="Participated well in class">Participated well in class</option>
          <option value="Enjoyed outdoor play">Enjoyed outdoor play</option>
          <option value="Good interaction with friends">Good interaction with friends</option>
          <option value="Completed activities nicely">Completed activities nicely</option>
          <option value="Had a calm and steady day">Had a calm and steady day</option>
        </select>

        <textarea
          className="db-input"
          placeholder="Teacher Notes"
          value={teacherNotes}
          onChange={(e) => setTeacherNotes(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            minHeight: "90px",
            resize: "vertical",
            borderRadius: "14px",
            border: "1px solid #E5D7CB",
            padding: "12px 14px",
            fontSize: "14px",
            color: "#2D2A3E",
            background: "#FFFFFF",
            marginBottom: "12px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={saveSummary}
          disabled={saving}
        >
          {saving ? "Saving..." : isEditing ? "Update Summary" : "Save Summary"}
        </button>

        {isEditing && (
          <button
            type="button"
            className="db-button-secondary"
            style={{ width: "100%", marginTop: "10px" }}
            onClick={cancelEdit}
          >
            Cancel Edit
          </button>
        )}
      </div>

      <div className="db-card db-card-lavender" style={{ padding: "20px" }}>
        <h3 style={sectionTitle}>
          {classroomParam
            ? `${classroomParam} Summaries (${filteredSummaries.length})`
            : `Summaries (${filteredSummaries.length})`}
        </h3>

        {filteredSummaries.length === 0 ? (
          <p className="db-helper">
            {classroomParam
              ? "No summaries found for this classroom."
              : "No summaries saved yet."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredSummaries.map((summary) => {
              const learner = learners.find(
                (item) =>
                  String(item.name || "").trim().toLowerCase() ===
                  String(summary.learner_name || "").trim().toLowerCase()
              );

              return (
                <div key={summary.id} className="db-list-card">
                  <strong style={{ fontSize: "17px" }}>
                    {summary.learner_name || "Unnamed learner"}
                  </strong>
                  <p style={textStyle}>Class: {learner?.class || "Not assigned"}</p>
                  <p style={textStyle}>
                    Parent Phone: {learner?.parent_phone || "Not added"}
                  </p>
                  <p style={textStyle}>
                    Health & Safety: {summary.health_safety || "Not recorded"}
                  </p>
                  <p style={textStyle}>Meals: {summary.meals || "Not recorded"}</p>
                  <p style={textStyle}>Rest: {summary.rest || "Not recorded"}</p>
                  <p style={textStyle}>Mood: {summary.mood || "Not recorded"}</p>
                  <p style={textStyle}>
                    Today’s Highlight: {summary.today_highlight || "Not recorded"}
                  </p>
                  <p style={textStyle}>
                    Teacher Notes: {summary.teacher_notes || "Not recorded"}
                  </p>
                  <p style={metaTextStyle}>
                    {summary.created_at
                      ? new Date(summary.created_at).toLocaleString()
                      : "No timestamp"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      type="button"
                      className="db-button-primary"
                      onClick={() => sendSummaryWhatsApp(summary)}
                    >
                      Send via WhatsApp
                    </button>

                    <button
                      type="button"
                      className="db-button-secondary"
                      onClick={() => startEdit(summary)}
                    >
                      Edit
                    </button>
                  </div>
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
  marginTop: 0,
  marginBottom: "14px",
  color: "var(--db-text)",
  fontSize: "22px",
  fontWeight: 800 as const,
};

const textStyle = {
  margin: "6px 0 0 0",
  color: "var(--db-text-soft)",
  lineHeight: 1.6,
};

const metaTextStyle = {
  margin: "10px 0 0 0",
  color: "#8A84A3",
  fontSize: "12px",
};
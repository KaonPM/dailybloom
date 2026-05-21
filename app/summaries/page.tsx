"use client";



import { useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "../lib/supabase";

import { getCurrentProfile } from "../lib/auth";

import { resolveSchoolContext } from "../lib/school-context";



type Learner = {

  id: number;

  name: string;

  class?: string | null;

  classroom_id?: number | null;

  parent_phone?: string | null;

};



type Classroom = {

  id: number;

  classroom_name?: string | null;

};



type SummaryRow = {

  id: number;

  learner_name?: string | null;

  mood?: string | null;

  meals?: string | null;

  rest?: string | null;

  health_safety?: string | null;

  today_highlight?: string | null;

  teacher_notes?: string | null;

  whatsapp_sent?: boolean | null;

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



const mealsOptions = ["Ate well", "Ate a little", "Did not eat much", "Refused meal"];



const restOptions = ["Rested well", "Short nap", "Did not nap", "Quiet rest only"];



const moodOptions = ["Happy", "Calm", "Playful", "Tired", "Emotional", "Quiet"];



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

  const [summaries, setSummaries] = useState<SummaryRow[]>([]);



  const [selectedClassroomId, setSelectedClassroomId] = useState("");

  const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(null);



  const [healthSafety, setHealthSafety] = useState("");

  const [meals, setMeals] = useState("");

  const [rest, setRest] = useState("");

  const [mood, setMood] = useState("");

  const [todayHighlight, setTodayHighlight] = useState("");

  const [teacherNotes, setTeacherNotes] = useState("");



  const [generatedMessage, setGeneratedMessage] = useState("");

  const [generatedWhatsAppLink, setGeneratedWhatsAppLink] = useState("");

  const [showSavedSummaries, setShowSavedSummaries] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [savedSummaryLimit, setSavedSummaryLimit] = useState(10);
  const [editingSummaryId, setEditingSummaryId] = useState<number | null>(null);
  const [editingSummarySent, setEditingSummarySent] = useState(false);


  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);



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

    const currentRole = String(profile.role || "");

    const currentTeacherClassroom = String(profile.classroom_name || "");



    setSchoolId(currentSchoolId);

    setRole(currentRole);

    setTeacherClassroom(currentTeacherClassroom);



    await Promise.all([

      fetchClassrooms(currentSchoolId),

      fetchLearners(currentSchoolId),

      fetchSummaries(currentSchoolId),

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



  async function fetchSummaries(currentSchoolId: number) {

    const { data, error } = await supabase

      .from("summaries")

      .select(

        "id, learner_name, mood, meals, rest, health_safety, today_highlight, teacher_notes, whatsapp_sent, created_at"

      )

      .eq("school_id", currentSchoolId)

      .order("created_at", { ascending: false });

    if (error) {

      alert(error.message);

      return;

    }



    setSummaries((data || []) as SummaryRow[]);

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



    return visibleLearners.find((learner) => learner.id === selectedLearnerId) || null;

  }, [visibleLearners, selectedLearnerId]);



  function resetSummaryForm() {

    setHealthSafety("");

    setMeals("");

    setRest("");

    setMood("");

    setTodayHighlight("");

    setTeacherNotes("");

    setGeneratedMessage("");

    setGeneratedWhatsAppLink("");
    setEditingSummaryId(null);
    setEditingSummarySent(false);

  }



  function selectLearner(learner: Learner) {

    setSelectedLearnerId((current) => (current === learner.id ? null : learner.id));

    resetSummaryForm();

  }



  async function saveSummary() {
  if (!schoolId || !selectedLearner) return;

  if (!healthSafety || !meals || !rest || !mood || !todayHighlight) {
    alert("Please complete all summary selections.");
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
      whatsapp_sent: false,
    },
  ]);

  if (error) {
    alert(error.message);
    setSaving(false);
    return;
  }

  await fetchSummaries(schoolId);

  setSaving(false);
  alert("Summary saved.");
}


  function formatWhatsAppPhone(phone: string | null | undefined) {

    const cleaned = String(phone || "")

      .replace(/\s/g, "")

      .replace(/-/g, "")

      .replace(/\(/g, "")

      .replace(/\)/g, "")

      .replace("+", "");



    if (!cleaned) return "";



    if (cleaned.startsWith("0")) {

      return `27${cleaned.slice(1)}`;

    }



    return cleaned;

  }



  function generateWhatsAppMessage() {

    if (!selectedLearner) return;



    if (!healthSafety || !meals || !rest || !mood || !todayHighlight) {

      alert("Please complete the summary first.");

      return;

    }



    const notesLine = teacherNotes.trim()

      ? `\n\nTeacher note:\n${teacherNotes.trim()}`

      : "";



    const message = `Good day parent/guardian.

Here is today’s DailyBloom summary for ${selectedLearner.name}.

Mood:
${mood}

Meals:
${meals}

Rest:
${rest}

Health and Safety:
${healthSafety}

Today’s Highlight:
${todayHighlight}${notesLine}

Thank you.`;



    setGeneratedMessage(message);



    const phone = formatWhatsAppPhone(selectedLearner.parent_phone);



    if (!phone) {

      setGeneratedWhatsAppLink("");

      return;

    }



    setGeneratedWhatsAppLink(

      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    );

  }



  function copyMessage() {

    if (!generatedMessage) return;



    navigator.clipboard.writeText(generatedMessage);

    alert("Message copied.");

  }

async function markSavedSummaryAsSent(summaryId: number) {
  if (!schoolId) return;

  const { error } = await supabase
    .from("summaries")
    .update({ whatsapp_sent: true })
    .eq("id", summaryId);

  if (error) {
    alert(error.message);
    return;
  }

  await fetchSummaries(schoolId);
}

  async function markSummaryAsSent() {

    if (!schoolId || !selectedLearner) return;



    const latestSummary = summaries.find(

      (summary) => summary.learner_name === selectedLearner.name

    );



    if (!latestSummary) {

      alert("Please save the summary first before marking it as sent.");

      return;

    }



    const { error } = await supabase

      .from("summaries")

      .update({ whatsapp_sent: true })

      .eq("id", latestSummary.id);



    if (error) {

      alert(error.message);

      return;

    }



    await fetchSummaries(schoolId);

  }


  const filteredSummaries = useMemo(() => {
  let filtered = [...summaries];

  if (selectedMonth) {
    filtered = filtered.filter((summary) => {
      if (!summary.created_at) return false;

      const summaryMonth = new Date(summary.created_at)
        .toISOString()
        .slice(0, 7);

      return summaryMonth === selectedMonth;
    });
  }

  return filtered;
}, [summaries, selectedMonth]);

const visibleSummaries = filteredSummaries.slice(0, savedSummaryLimit);

function getSavedSummaryPhone(summary: SummaryRow) {
  const learner = learners.find(
    (item) => item.name === summary.learner_name
  );

  return learner?.parent_phone || "";
}

function openSavedSummary(summary: SummaryRow) {
  const learner = learners.find((item) => item.name === summary.learner_name);

  if (!learner) {
    alert("This learner could not be found in the current learner list.");
    return;
  }

  if (role !== "teacher" && learner.classroom_id) {
    setSelectedClassroomId(String(learner.classroom_id));
  }

  setSelectedLearnerId(learner.id);
  setHealthSafety(summary.health_safety || "");
  setMeals(summary.meals || "");
  setRest(summary.rest || "");
  setMood(summary.mood || "");
  setTodayHighlight(summary.today_highlight || "");
  setTeacherNotes(summary.teacher_notes || "");
  setGeneratedMessage("");
  setGeneratedWhatsAppLink("");
  setEditingSummaryId(summary.id);
  setEditingSummarySent(Boolean(summary.whatsapp_sent));

  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (loading) {
  return <p>Loading summaries...</p>;
}

  return (

    <div>

      <div className="db-soft-card" style={{ padding: 18, marginBottom: 18 }}>

        <h2 className="db-page-title">Daily Summaries</h2>

        <p className="db-page-subtitle">

          Save learner updates and prepare parent WhatsApp messages.

        </p>

      </div>



      {role !== "teacher" ? (

        <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 18 }}>

          <p style={labelText}>Select Classroom</p>



          <select

            className="db-input"

            value={selectedClassroomId}

            onChange={(e) => {

              setSelectedClassroomId(e.target.value);

              setSelectedLearnerId(null);

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



      <div className="db-card db-card-lavender" style={{ padding: 16, marginBottom: 18 }}>

        <h3 style={sectionTitle}>

          Learners {selectedClassroom?.classroom_name ? `(${selectedClassroom.classroom_name})` : ""}

        </h3>



        {!selectedClassroom ? (

          <p className="db-helper">

            {role === "teacher"

              ? "No classroom assigned to this teacher."

              : "Please select a classroom to view learners."}

          </p>

        ) : visibleLearners.length === 0 ? (

          <p className="db-helper">No learners found for this classroom.</p>

        ) : (

          <div style={{ display: "grid", gap: 8 }}>

            {visibleLearners.map((learner) => {

              const active = selectedLearnerId === learner.id;



              return (

                <button

                  key={learner.id}

                  type="button"

                  onClick={() => selectLearner(learner)}

                  style={{

                    width: "100%",

                    background: active ? "#EAF7FD" : "#FFFDFB",

                    border: active ? "1px solid #CBEAF7" : "1px solid #F0E3D8",

                    borderRadius: 14,

                    padding: "10px 12px",

                    color: "#2D2A3E",

                    cursor: "pointer",

                    textAlign: "left",

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

        <div className="db-card db-card-green" style={{ padding: 16, marginBottom: 18 }}>

          <h3 style={sectionTitle}>
           {editingSummaryId
           ? editingSummarySent
           ? `Viewing summary for ${selectedLearner.name}`
           : `Editing summary for ${selectedLearner.name}`
           : `Summary for ${selectedLearner.name}`}
          </h3>



          <OptionGroup label="Health and Safety" options={healthSafetyOptions} value={healthSafety} setValue={setHealthSafety} />

          <OptionGroup label="Meals" options={mealsOptions} value={meals} setValue={setMeals} />

          <OptionGroup label="Rest" options={restOptions} value={rest} setValue={setRest} />

          <OptionGroup label="Mood" options={moodOptions} value={mood} setValue={setMood} />

          <OptionGroup label="Today’s Highlight" options={highlightOptions} value={todayHighlight} setValue={setTodayHighlight} />



          <div style={{ marginTop: 12 }}>

            <p style={labelText}>Teacher Notes Optional</p>

            <textarea
              className="db-input"
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              rows={3}
              placeholder="Write a short note if needed."
              style={{ width: "100%", resize: "vertical" }}
            ></textarea>

          </div>



          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>

            <button
             type="button"
             className="db-button-primary"
             onClick={saveSummary}
             disabled={saving}
          >
          {saving
          ? "Saving..."
          : editingSummaryId
          ? "Save Changes"
          : "Save Summary"}
          </button>



            <button type="button" className="db-button-secondary" onClick={generateWhatsAppMessage}>

              Generate WhatsApp Message

            </button>

          </div>



          {generatedMessage ? (

            <div

              style={{

                marginTop: 14,

                background: "#FFFDFB",

                border: "1px solid #F0E3D8",

                borderRadius: 14,

                padding: 12,

              }}

            >

              <p style={labelText}>WhatsApp Message Preview</p>

              <p

                style={{

                  margin: "8px 0",

                  color: "#2D2A3E",

                  lineHeight: 1.7,

                  whiteSpace: "pre-line",

                }}

              >

                {generatedMessage}

              </p>



              <div

                style={{

                  display: "flex",

                  gap: 10,

                  flexWrap: "wrap",

                  marginTop: 12,

                }}

              >

                <button type="button" className="db-button-secondary" onClick={copyMessage}>

                  Copy WhatsApp Message

                </button>



                {generatedWhatsAppLink ? (

                  <a

                    href={generatedWhatsAppLink}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="db-button-primary"

                    style={{

                      textDecoration: "none",

                      display: "inline-flex",

                      alignItems: "center",

                      justifyContent: "center",

                    }}

                    onClick={markSummaryAsSent}

                  >

                    Send via WhatsApp

                  </a>

                ) : (

                  <button type="button" className="db-button-secondary" disabled>

                    Parent phone missing

                  </button>

                )}

              </div>

            </div>

          ) : null}

        </div>

      ) : null}



      <div className="db-card db-card-yellow" style={{ padding: 16 }}>

        <div

          style={{

            display: "flex",

            justifyContent: "space-between",

            alignItems: "center",

            gap: 10,

            flexWrap: "wrap",

          }}

        >

          <div>

            <h3 style={sectionTitle}>
                Saved Summaries ({filteredSummaries.length})
            </h3>

            <p style={smallText}>Open only when you need to review saved records.</p>

          </div>



          <button

            type="button"

            className="db-button-secondary"

            onClick={() => setShowSavedSummaries((prev) => !prev)}

          >

            {showSavedSummaries ? "Hide" : "View Saved"}

          </button>

        </div>

<div style={{ marginTop: 12 }}>
  <label style={labelText}>Filter by month</label>

  <input
    type="month"
    value={selectedMonth}
    onChange={(e) => {
      setSelectedMonth(e.target.value);
      setSavedSummaryLimit(10);
    }}
    style={{
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #E0D8CF",
    fontSize: 14,
    }}
  />
</div>

                          {showSavedSummaries ? (
          filteredSummaries.length === 0 ? (
            <p className="db-helper">No saved summaries yet.</p>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {visibleSummaries.map((summary) => (
                  <div key={summary.id} style={summaryRow}>
                    <strong>{summary.learner_name || "Unnamed learner"}</strong>

                    <p style={smallText}>
                      Mood: {summary.mood || "Not added"} | Meals:{" "}
                      {summary.meals || "Not added"}
                    </p>

                    <p style={smallText}>
                      {summary.created_at ? summary.created_at.split("T")[0] : ""}
                    </p>

                    <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  }}
>
  <p
    style={{
      margin: 0,
      color: summary.whatsapp_sent ? "#2E8B57" : "#B26A00",
      fontSize: 13,
      fontWeight: 700,
    }}
  >
    {summary.whatsapp_sent ? "WhatsApp Sent" : "Not Sent"}
  </p>

  <div
    style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginLeft: "auto",
    }}
  >
    <button
      type="button"
      className="db-button-secondary"
      onClick={() => openSavedSummary(summary)}
    >
      {summary.whatsapp_sent ? "View" : "Edit"}
    </button>

    {!summary.whatsapp_sent ? (
      getSavedSummaryPhone(summary) ? (
        <button
          type="button"
          className="db-button-secondary"
          onClick={() => {
            const message = encodeURIComponent(
              `Hello Parent. Here is ${summary.learner_name}'s daily summary.\n\nMood: ${summary.mood || "Not added"}\nMeals: ${summary.meals || "Not added"}\nRest: ${summary.rest || "Not added"}\nHealth and Safety: ${summary.health_safety || "Not added"}\nToday's Highlight: ${summary.today_highlight || "Not added"}\nTeacher Notes: ${summary.teacher_notes || "None"}`
            );

            const phone = getSavedSummaryPhone(summary).replace(/\D/g, "");

            window.open(
              `https://wa.me/${phone}?text=${message}`,
              "_blank"
            );

            markSavedSummaryAsSent(summary.id);
          }}
        >
          Send via WhatsApp
        </button>
      ) : (
        <button type="button" className="db-button-secondary" disabled>
          Parent phone missing
        </button>
      )
    ) : null}
  </div>
</div>
                  </div>
                ))}
              </div>

              {savedSummaryLimit < filteredSummaries.length ? (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="db-button-secondary"
                    onClick={() => setSavedSummaryLimit((prev) => prev + 10)}
                  >
                    Load Next 10
                  </button>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </div>
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
    <div style={{ marginTop: 14 }}>
      <p style={labelText}>{label}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((option) => {
          const active = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setValue(active ? "" : option)}
              style={{
                background: active ? "#EAF7FD" : "#FFFDFB",
                border: active
                  ? "1px solid #7CCCF3"
                  : "1px solid #F0E3D8",
                borderRadius: 999,
                padding: "8px 12px",
                color: "#2D2A3E",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
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

const summaryRow = {
  background: "#FFFDFB",
  border: "1px solid #F0E3D8",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#2D2A3E",
};
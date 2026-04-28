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

        "id, learner_name, mood, meals, rest, health_safety, today_highlight, teacher_notes, created_at"

      )

      .eq("school_id", currentSchoolId)

      .order("created_at", { ascending: false })

      .limit(20);



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



  function generateWhatsAppMessage() {

    if (!selectedLearner) return;



    const notesLine = teacherNotes.trim()

      ? ` ${teacherNotes.trim()}`

      : "";



    const message = `Good day. DailyBloom update for ${selectedLearner.name}: ${mood.toLowerCase()} mood today. Meals: ${meals.toLowerCase()}. Rest: ${rest.toLowerCase()}. Health and safety: ${healthSafety.toLowerCase()}. Highlight: ${todayHighlight.toLowerCase()}.${notesLine}`;



    setGeneratedMessage(message);

  }



  function copyMessage() {

    if (!generatedMessage) return;



    navigator.clipboard.writeText(generatedMessage);

    alert("Message copied.");

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

          <h3 style={sectionTitle}>Summary for {selectedLearner.name}</h3>



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



          <div style={{ marginTop: 12 }}>

            <p style={labelText}>Teacher Notes Optional</p>

            <textarea

              className="db-input"

              value={teacherNotes}

              onChange={(e) => setTeacherNotes(e.target.value)}

              rows={3}

              placeholder="Write a short note if needed."

              style={{ width: "100%", resize: "vertical" }}

            />

          </div>



          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>

            <button

              type="button"

              className="db-button-primary"

              onClick={saveSummary}

              disabled={saving}

            >

              {saving ? "Saving..." : "Save Summary"}

            </button>



            <button

              type="button"

              className="db-button-secondary"

              onClick={generateWhatsAppMessage}

            >

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

              <p style={{ margin: "8px 0", color: "#2D2A3E", lineHeight: 1.6 }}>

                {generatedMessage}

              </p>



              <button

                type="button"

                className="db-button-secondary"

                onClick={copyMessage}

              >

                Copy WhatsApp Message

              </button>

            </div>

          ) : null}

        </div>

      ) : null}



      <div className="db-card db-card-yellow" style={{ padding: 16 }}>

        <h3 style={sectionTitle}>Saved Summaries</h3>



        {summaries.length === 0 ? (

          <p className="db-helper">No saved summaries yet.</p>

        ) : (

          <div style={{ display: "grid", gap: 8 }}>

            {summaries.map((summary) => (

              <div key={summary.id} style={summaryRow}>

                <strong>{summary.learner_name || "Unnamed learner"}</strong>

                <p style={smallText}>

                  Mood: {summary.mood || "Not added"} | Meals:{" "}

                  {summary.meals || "Not added"}

                </p>

                <p style={smallText}>

                  {summary.created_at ? summary.created_at.split("T")[0] : ""}

                </p>

              </div>

            ))}

          </div>

        )}

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

                border: active ? "1px solid #7CCCF3" : "1px solid #F0E3D8",

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
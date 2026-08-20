"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type Meeting = { id: string; title: string; meeting_date: string; agenda_url?: string; minutes_url?: string; minutes_published_at?: string; acknowledgements?: Array<{ count: number }> };
type Survey = { id: string; title: string; survey_type: "dailybloom" | "external"; external_url?: string; closes_at?: string; responses?: Array<{ count: number }> };
type SurveyQuestion = { id: string; label: string; type: "short_text" | "long_text" | "yes_no" | "rating" | "single_choice" | "checkbox"; options: string[] };
type AdministrationData = { meetings: Meeting[]; surveys: Survey[]; classrooms: Array<{ id: number; classroom_name: string }> };

const emptyQuestion = (): SurveyQuestion => ({ id: crypto.randomUUID(), label: "", type: "long_text", options: [] });

export default function SchoolAdministrationPage() {
  const params = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [data, setData] = useState<AdministrationData>({ meetings: [], surveys: [], classrooms: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [surveyType, setSurveyType] = useState<"dailybloom" | "external">("dailybloom");
  const [meetingAudience, setMeetingAudience] = useState<"whole_school" | "classroom">("whole_school");
  const [surveyAudience, setSurveyAudience] = useState<"whole_school" | "classroom">("whole_school");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([emptyQuestion()]);
  const [meetingVisible, setMeetingVisible] = useState(10);
  const [surveyVisible, setSurveyVisible] = useState(10);

  const load = useCallback(async (id: number) => {
    const response = await authenticatedFetch(`/api/school-administration?school_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "School administration could not be loaded.");
    setData(body as AdministrationData);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const context = await resolveSchoolContext(params.get("school"));
        if (context.error) throw new Error(context.error);
        if (!context.schoolId) throw new Error("Choose a school first.");
        setSchoolId(context.schoolId);
        await load(context.schoolId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load school administration.");
      }
    })();
  }, [load, params]);

  async function uploadDocument(file: File) {
    if (!schoolId) throw new Error("Choose a school first.");
    const upload = new FormData();
    upload.set("school_id", String(schoolId));
    upload.set("file", file);
    const response = await authenticatedFetch("/api/school-administration", { method: "PUT", body: upload });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Document upload failed.");
    return String(body.path);
  }

  async function submit(event: FormEvent<HTMLFormElement>, kind: "meeting" | "survey") {
    event.preventDefault();
    if (!schoolId) return;
    setError(""); setMessage("");
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const values = Object.fromEntries(form.entries());
      let agendaUrl = "";
      if (kind === "meeting") {
        const file = form.get("agenda_file");
        if (!(file instanceof File) || !file.size) throw new Error("Choose the meeting agenda PDF or Word document.");
        agendaUrl = await uploadDocument(file);
      }
      const surveyQuestions = questions.map((question, index) => ({ ...question, id: `q${index + 1}`, label: question.label.trim() })).filter((question) => question.label);
      const payload = kind === "meeting"
        ? { ...values, agenda_file: undefined, agenda_url: agendaUrl, action: "save_meeting", school_id: schoolId, publish_agenda: true }
        : { ...values, survey_type: surveyType, action: "save_survey", school_id: schoolId, questions: surveyQuestions, anonymous: values.anonymous === "on" };
      const response = await authenticatedFetch("/api/school-administration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The item could not be published.");
      formElement.reset();
      if (kind === "meeting") setMeetingAudience("whole_school");
      else { setQuestions([emptyQuestion()]); setSurveyType("dailybloom"); setSurveyAudience("whole_school"); }
      setMessage(kind === "meeting" ? `Agenda published to Parent Portal${body.delivery === "sent" ? " and parents were notified" : ""}.` : `Survey published to Parent Portal${body.delivery === "sent" ? " and parents were notified" : ""}.`);
      await load(schoolId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The item could not be saved.");
    }
  }

  async function publishMinutes(event: FormEvent<HTMLFormElement>, meetingId: string) {
    event.preventDefault();
    if (!schoolId) return;
    setError(""); setMessage("");
    try {
      const file = new FormData(event.currentTarget).get("minutes_file");
      if (!(file instanceof File) || !file.size) throw new Error("Choose the approved minutes PDF or Word document.");
      const minutesUrl = await uploadDocument(file);
      const response = await authenticatedFetch("/api/school-administration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish_minutes", school_id: schoolId, meeting_id: meetingId, minutes_url: minutesUrl }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Minutes could not be published.");
      setMessage(`Minutes published. Parent notification ${body.delivery === "sent" ? "sent" : "is available in Parent Portal"}.`);
      await load(schoolId);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Minutes could not be published.");
    }
  }

  return <div style={{ display: "grid", gap: 18 }}>
    <section className="db-page-header db-card-blue"><p className="db-eyebrow">School Administration</p><h1>Meetings, Minutes &amp; Surveys</h1><p className="db-page-subtitle">Publish meeting documents and collect parent responses in one auditable workspace.</p></section>
    {error ? <div className="db-error-banner" role="alert">{error}</div> : null}
    {message ? <div className="db-success-banner" role="status">{message}</div> : null}

    <section className="db-card" style={{ padding: 24 }}>
      <h2>Meeting Agenda &amp; Minutes</h2>
      <p className="db-helper">Publish the agenda before the meeting. Upload the approved minutes afterwards so parents can read and acknowledge them.</p>
      <form onSubmit={(event) => void submit(event, "meeting")} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", alignItems: "end" }}>
        <label><span className="db-label">Meeting title</span><input className="db-input" name="title" required /></label>
        <label><span className="db-label">Meeting date and time</span><input className="db-input" type="datetime-local" name="meeting_date" required /></label>
        <label><span className="db-label">Audience</span><select className="db-input" name="audience" value={meetingAudience} onChange={(event) => setMeetingAudience(event.target.value as typeof meetingAudience)}><option value="whole_school">Whole school</option><option value="classroom">One classroom</option></select></label>
        {meetingAudience === "classroom" ? <label><span className="db-label">Classroom</span><select className="db-input" name="classroom_id" required><option value="">Select classroom</option>{data.classrooms.map((room) => <option key={room.id} value={room.id}>{room.classroom_name}</option>)}</select></label> : null}
        <label><span className="db-label">Agenda document</span><input className="db-input" type="file" name="agenda_file" required accept=".pdf,.doc,.docx" /><small className="db-helper">PDF or Word, up to 10 MB.</small></label>
        <button className="db-button-primary" type="submit">Upload &amp; Publish Agenda</button>
      </form>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {data.meetings.length === 0 ? <p className="db-helper">No meeting agendas have been published yet.</p> : null}
        {data.meetings.slice(0, meetingVisible).map((meeting) => <article className="db-soft-card" key={meeting.id} style={{ padding: 16 }}>
          <strong>{meeting.title}</strong><p className="db-helper">{new Date(meeting.meeting_date).toLocaleString("en-ZA")} · {meeting.minutes_published_at ? "Minutes published" : "Agenda published"} · {meeting.acknowledgements?.[0]?.count || 0} acknowledgements</p>
          <div className="db-page-actions">{meeting.agenda_url ? <a className="db-button-secondary" href={meeting.agenda_url} target="_blank" rel="noreferrer">Download Agenda</a> : null}{meeting.minutes_url ? <a className="db-button-secondary" href={meeting.minutes_url} target="_blank" rel="noreferrer">Download Minutes</a> : null}</div>
          {!meeting.minutes_published_at ? <form onSubmit={(event) => void publishMinutes(event, meeting.id)} style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "end" }}><label style={{ flex: "1 1 280px" }}><span className="db-label">Approved minutes</span><input className="db-input" type="file" name="minutes_file" required accept=".pdf,.doc,.docx" /></label><button className="db-button-primary">Upload Minutes &amp; Prompt Parents</button></form> : null}
        </article>)}
        {meetingVisible < data.meetings.length ? <button className="db-button-secondary" type="button" onClick={() => setMeetingVisible((count) => count + 10)}>Show next 10</button> : null}
      </div>
    </section>

    <section className="db-card" style={{ padding: 24 }}>
      <h2>Surveys &amp; Forms</h2><p className="db-helper">Create a survey in DailyBloom or share an existing Google Forms or Microsoft Forms link.</p>
      <form onSubmit={(event) => void submit(event, "survey")} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          <label><span className="db-label">Survey title</span><input className="db-input" name="title" required /></label>
          <label><span className="db-label">Description</span><input className="db-input" name="description" placeholder="What parents should know before responding" /></label>
          <label><span className="db-label">Survey option</span><select className="db-input" name="survey_type" value={surveyType} onChange={(event) => setSurveyType(event.target.value as typeof surveyType)}><option value="dailybloom">Create in DailyBloom</option><option value="external">External link (Google/Microsoft Forms)</option></select></label>
          {surveyType === "external" ? <label><span className="db-label">External form link</span><input className="db-input" type="url" name="external_url" required placeholder="https://forms.google.com/..." /></label> : null}
          <label><span className="db-label">Audience</span><select className="db-input" name="audience" value={surveyAudience} onChange={(event) => setSurveyAudience(event.target.value as typeof surveyAudience)}><option value="whole_school">Whole school</option><option value="classroom">One classroom</option></select></label>
          {surveyAudience === "classroom" ? <label><span className="db-label">Classroom</span><select className="db-input" name="classroom_id" required><option value="">Select classroom</option>{data.classrooms.map((room) => <option key={room.id} value={room.id}>{room.classroom_name}</option>)}</select></label> : null}
          <label><span className="db-label">Closing date <em>(optional)</em></span><input className="db-input" type="datetime-local" name="closes_at" /></label>
        </div>
        {surveyType === "dailybloom" ? <div style={{ display: "grid", gap: 10 }}>
          <h3 style={{ marginBottom: 0 }}>DailyBloom Questions</h3>
          {questions.map((question, index) => <div className="db-soft-card" key={question.id} style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(170px, 1fr) minmax(220px, 2fr) auto", gap: 10, alignItems: "end" }}>
            <label><span className="db-label">Question {index + 1}</span><input className="db-input" value={question.label} required onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></label>
            <label><span className="db-label">Answer type</span><select className="db-input" value={question.type} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as SurveyQuestion["type"] } : item))}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="yes_no">Yes / No</option><option value="rating">Rating 1–5</option><option value="single_choice">Multiple choice</option><option value="checkbox">Checkboxes</option></select></label>
            {["single_choice", "checkbox"].includes(question.type) ? <label><span className="db-label">Options (comma separated)</span><input className="db-input" value={question.options.join(", ")} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) } : item))} /></label> : <span />}
            <button className="db-button-secondary" type="button" disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Delete</button>
          </div>)}
          <button className="db-button-secondary" type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>Add Question</button>
        </div> : null}
        <label className="db-checkbox-row"><input type="checkbox" name="anonymous" /><span>Anonymous responses <small>DailyBloom records that the parent completed the survey, but does not attach their identity to the answers.</small></span></label>
        <button className="db-button-primary" type="submit">Publish Survey</button>
      </form>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {data.surveys.length === 0 ? <p className="db-helper">No surveys have been published yet.</p> : null}
        {data.surveys.slice(0, surveyVisible).map((survey) => <article className="db-soft-card" key={survey.id} style={{ padding: 16 }}><strong>{survey.title}</strong><p className="db-helper">{survey.survey_type === "dailybloom" ? "DailyBloom survey" : "External form"} · {survey.responses?.[0]?.count || 0} responses{survey.closes_at ? ` · closes ${new Date(survey.closes_at).toLocaleString("en-ZA")}` : ""}</p>{survey.external_url ? <a className="db-button-secondary" href={survey.external_url} target="_blank" rel="noreferrer">Open Form</a> : null}</article>)}
        {surveyVisible < data.surveys.length ? <button className="db-button-secondary" type="button" onClick={() => setSurveyVisible((count) => count + 10)}>Show next 10</button> : null}
      </div>
    </section>
  </div>;
}

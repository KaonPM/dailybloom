"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";

type Child = { id: string; name: string };
type Meeting = { id: string; title: string; meeting_date: string; agenda_url?: string; agenda_content?: string; minutes_url?: string; minutes_content?: string; minutes_published_at?: string; eligible_learner_ids?: string[]; school_meeting_acknowledgements?: Array<{ learner_id: string; acknowledged_at: string }> };
type Question = { id: string; label: string; type: "short_text" | "long_text" | "yes_no" | "rating" | "single_choice" | "checkbox"; options?: string[] };
type Survey = { id: string; title: string; description?: string; survey_type: "dailybloom" | "external"; external_url?: string; questions?: Question[]; closes_at?: string; eligible_learner_ids?: string[]; school_survey_responses?: Array<{ learner_id: string; submitted_at: string }>; school_survey_completions?: Array<{ learner_id: string; completed_at: string }> };
type ParentAdministrationData = { meetings: Meeting[]; surveys: Survey[]; children: Child[] };

function downloadMeetingPdf(title: string, meetingDate: string, documentName: "Agenda" | "Minutes", content: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  let y = 20;
  pdf.setFontSize(18); pdf.text(`${title} — ${documentName}`, margin, y); y += 9;
  pdf.setFontSize(10); pdf.text(new Date(meetingDate).toLocaleString("en-ZA"), margin, y); y += 10;
  pdf.setFontSize(11);
  for (const line of pdf.splitTextToSize(content, pageWidth - margin * 2)) {
    if (y > pageHeight - 18) { pdf.addPage(); y = 20; }
    pdf.text(line, margin, y); y += 6;
  }
  pdf.save(`${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "meeting"}-${documentName.toLowerCase()}.pdf`);
}

export default function ParentSchoolAdministrationPage() {
  const [data, setData] = useState<ParentAdministrationData>({ meetings: [], surveys: [], children: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [meetingVisible, setMeetingVisible] = useState(10);
  const [surveyVisible, setSurveyVisible] = useState(10);

  const load = useCallback(async () => {
    const response = await fetch("/api/parent-school-administration", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "School administration could not be loaded.");
    setData(body as ParentAdministrationData);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialise() {
      try {
        const response = await fetch("/api/parent-school-administration", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "School administration could not be loaded.");
        if (active) setData(body as ParentAdministrationData);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "School administration could not be loaded.");
      }
    }
    void initialise();
    return () => { active = false; };
  }, []);

  async function act(payload: Record<string, unknown>) {
    setError(""); setMessage("");
    const response = await fetch("/api/parent-school-administration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Your response could not be saved."); return; }
    setMessage("Saved successfully.");
    await load();
  }

  function answerField(question: Question) {
    if (question.type === "long_text") return <textarea className="db-input" name={question.id} required rows={3} />;
    if (question.type === "yes_no") return <select className="db-input" name={question.id} required><option value="">Select</option><option>Yes</option><option>No</option></select>;
    if (question.type === "rating") return <select className="db-input" name={question.id} required><option value="">Select</option>{[1, 2, 3, 4, 5].map((number) => <option key={number}>{number}</option>)}</select>;
    if (question.type === "single_choice") return <select className="db-input" name={question.id} required><option value="">Select</option>{(question.options || []).map((option) => <option key={option}>{option}</option>)}</select>;
    if (question.type === "checkbox") return <div>{(question.options || []).map((option) => <label className="db-checkbox-row" key={option}><input type="checkbox" name={question.id} value={option} /><span>{option}</span></label>)}</div>;
    return <input className="db-input" name={question.id} required />;
  }

  return <div className="parent-school-admin">
    <section className="db-page-header db-card-blue parent-school-admin-header">
      <p className="db-eyebrow">Parent Portal</p>
      <h1>School Administration</h1>
      <p className="db-page-subtitle">Everything requiring a parent response or acknowledgement, organised in one place.</p>
      <nav className="parent-school-admin-shortcuts" aria-label="School administration sections">
        <a href="#re-enrolment">Re-enrolment</a>
        <a href="#meeting-documents">Meeting Agenda &amp; Minutes</a>
        <a href="#surveys">Surveys</a>
      </nav>
    </section>
    {error ? <div className="db-error-banner" role="alert">{error}</div> : null}
    {message ? <div className="db-success-banner" role="status">{message}</div> : null}

    <section className="db-card parent-school-admin-feature" id="re-enrolment">
      <div className="parent-school-admin-feature-icon" aria-hidden>↻</div>
      <div className="parent-school-admin-feature-copy">
        <p className="db-eyebrow">Admissions</p>
        <h2>Re-enrolment</h2>
        <p className="db-helper">Review each learner&apos;s re-enrolment status, respond and follow classroom allocation.</p>
      </div>
      <Link className="db-button-primary parent-school-admin-action" href="/parent/re-enrolment">Open Re-enrolment</Link>
    </section>

    <section className="db-card parent-school-admin-section" id="meeting-documents">
      <div className="parent-school-admin-section-heading">
        <div><p className="db-eyebrow">School meetings</p><h2>Meeting Agenda &amp; Minutes</h2></div>
        <p className="db-helper">Download the agenda before a meeting, then read and acknowledge the published minutes.</p>
      </div>
      <div className="parent-school-admin-list">
        {data.meetings.length === 0 ? <p className="db-helper">No meeting documents have been published yet.</p> : null}
        {data.meetings.slice(0, meetingVisible).map((meeting) => {
          const learnerId = meeting.eligible_learner_ids?.[0];
          const acknowledged = meeting.school_meeting_acknowledgements?.some((item) => item.learner_id === learnerId);
          return <article className="db-soft-card parent-school-admin-item" key={meeting.id}>
            <div><strong>{meeting.title}</strong><p className="db-helper">{new Date(meeting.meeting_date).toLocaleString("en-ZA")}</p></div>
            <div className="db-page-actions parent-school-admin-item-actions">
              {meeting.agenda_content ? <button className="db-button-secondary" type="button" onClick={() => downloadMeetingPdf(meeting.title, meeting.meeting_date, "Agenda", meeting.agenda_content || "")}>Download Agenda</button> : null}
              {meeting.agenda_url ? <a className="db-button-secondary" href={meeting.agenda_url} target="_blank" rel="noreferrer">Download Agenda Attachment</a> : null}
              {meeting.minutes_content ? <button className="db-button-secondary" type="button" onClick={() => downloadMeetingPdf(meeting.title, meeting.meeting_date, "Minutes", meeting.minutes_content || "")}>Download Minutes</button> : null}
              {meeting.minutes_url ? <a className="db-button-secondary" href={meeting.minutes_url} target="_blank" rel="noreferrer">Download Minutes Attachment</a> : null}
              {meeting.minutes_published_at && !acknowledged && learnerId ? <button className="db-button-primary" type="button" onClick={() => void act({ action: "acknowledge_minutes", meeting_id: meeting.id, learner_id: learnerId })}>I confirm that I have received and read these meeting minutes.</button> : null}
              {acknowledged ? <span className="parent-school-admin-status">✓ Minutes acknowledged</span> : null}
            </div>
          </article>;
        })}
        {meetingVisible < data.meetings.length ? <button className="db-button-secondary" type="button" onClick={() => setMeetingVisible((count) => count + 10)}>Show next 10</button> : null}
      </div>
    </section>

    <section className="db-card parent-school-admin-section" id="surveys">
      <div className="parent-school-admin-section-heading">
        <div><p className="db-eyebrow">Parent feedback</p><h2>Surveys</h2></div>
        <p className="db-helper">Complete a DailyBloom survey or open a survey link shared by the school.</p>
      </div>
      <div className="parent-school-admin-list">
        {data.surveys.length === 0 ? <p className="db-helper">No surveys are currently available.</p> : null}
        {data.surveys.slice(0, surveyVisible).map((survey) => {
          const learnerId = survey.eligible_learner_ids?.[0];
          const completed = survey.school_survey_completions?.some((item) => item.learner_id === learnerId) || survey.school_survey_responses?.some((item) => item.learner_id === learnerId);
          return <article className="db-soft-card parent-school-admin-item parent-school-admin-survey" key={survey.id}>
            <div><strong>{survey.title}</strong><p className="db-helper">{survey.description || "Please complete this school survey."}</p></div>
            {completed ? <span className="parent-school-admin-status">✓ Completed</span> : survey.survey_type === "external" ? <div className="db-page-actions parent-school-admin-item-actions"><a className="db-button-primary" href={survey.external_url} target="_blank" rel="noreferrer">Open Survey</a>{learnerId ? <button className="db-button-secondary" type="button" onClick={() => void act({ action: "submit_survey", survey_id: survey.id, learner_id: learnerId })}>I Have Completed This Survey</button> : null}</div> : <form className="parent-school-admin-survey-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const answers = Object.fromEntries([...new Set(form.keys())].map((key) => { const values = form.getAll(key); return [key, values.length > 1 ? values : values[0]]; })); if (learnerId) void act({ action: "submit_survey", survey_id: survey.id, learner_id: learnerId, answers }); }}>{(survey.questions || []).map((question) => <label key={question.id}><span className="db-label">{question.label}</span>{answerField(question)}</label>)}<button className="db-button-primary" type="submit">Submit Survey</button></form>}
          </article>;
        })}
        {surveyVisible < data.surveys.length ? <button className="db-button-secondary" type="button" onClick={() => setSurveyVisible((count) => count + 10)}>Show next 10</button> : null}
      </div>
    </section>
  </div>;
}

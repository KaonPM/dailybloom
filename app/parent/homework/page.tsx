"use client";

import { useEffect, useMemo, useState } from "react";

type Learner = { id: string | number; name?: string | null; school_id?: number | null };
type Assignment = {
  id: number;
  week_start: string;
  activity_date: string;
  homework_id: number | null;
  instruction_note?: string | null;
  homework_library: { title?: string; file_name?: string | null } | null;
};

export default function ParentHomeworkPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/parent-context", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        const rows = (body.children || []) as Learner[];
        setLearners(rows);
        setSelected(String(rows[0]?.id || ""));
      });
  }, []);

  const learner = useMemo(() => learners.find((row) => String(row.id) === selected), [learners, selected]);

  useEffect(() => {
    if (!learner?.id || !learner.school_id) return;
    const params = new URLSearchParams({ learner_id: String(learner.id), school_id: String(learner.school_id) });
    fetch(`/api/parent-homework?${params}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        setAssignments(ok ? body.homework || [] : []);
        setMessage(ok ? "" : body.error || "Homework could not be loaded.");
      });
  }, [learner?.id, learner?.school_id]);

  async function openHomework(assignmentId: number) {
    if (!learner?.id || !learner.school_id) return;
    const params = new URLSearchParams({
      learner_id: String(learner.id),
      school_id: String(learner.school_id),
      assignment_id: String(assignmentId),
    });
    const response = await fetch(`/api/parent-homework?${params}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Homework could not be opened.");
    window.open(body.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="db-soft-card" style={{ padding: 20 }}>
        <h1 className="db-page-title">Homework</h1>
        <p className="db-page-subtitle">
          View the teacher&apos;s instructions and open or print any attached worksheet.
        </p>
        {learners.length > 1 ? (
          <select className="db-input" value={selected} onChange={(event) => setSelected(event.target.value)} style={{ marginTop: 12 }}>
            {learners.map((row) => <option key={row.id} value={row.id}>{row.name || "Learner"}</option>)}
          </select>
        ) : null}
      </div>

      {assignments.length === 0 ? <div className="db-card" style={{ padding: 20 }}>No homework has been allocated.</div> : null}
      {assignments.map((assignment) => (
        <div key={assignment.id} className="db-card db-card-blue" style={{ padding: 18 }}>
          <strong>{assignment.homework_library?.title || "Homework instructions"}</strong>
          <p className="db-helper">For {assignment.activity_date}</p>
          {assignment.instruction_note ? <p><strong>Instructions:</strong> {assignment.instruction_note}</p> : null}
          {assignment.homework_id ? (
            <button type="button" className="db-button-primary" onClick={() => void openHomework(assignment.id)}>
              View / Print Homework
            </button>
          ) : (
            <p className="db-helper">No attachment — follow the instructions above.</p>
          )}
        </div>
      ))}
      {message ? <p role="status" className="db-helper">{message}</p> : null}
    </div>
  );
}

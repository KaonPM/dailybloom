"use client";

import { useEffect, useState } from "react";
import ParentPageActions from "../components/ParentPageActions";

type Learner = { id: string | number; name?: string | null; school_id?: number | null };
type RequestDetails = {
  id: number;
  permission_type: string;
  title: string;
  description: string;
  event_date?: string | null;
  response_deadline?: string | null;
  created_at: string;
};
type ResponseDetails = { response?: "granted" | "declined"; parent_name?: string; responded_at?: string };
type RequestRow = {
  request_id: number;
  learner_id: string;
  parent_permission_requests: RequestDetails | RequestDetails[];
  parent_permission_responses?: ResponseDetails | ResponseDetails[] | null;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export default function ParentPermissionsPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [parentName, setParentName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const selectedLearner = learners.find((learner) => String(learner.id) === learnerId);

  async function loadParent() {
    const response = await fetch("/api/parent-context", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Parent details could not be loaded.");
    const available = (body.parent?.children || body.children || []) as Learner[];
    setLearners(available);
    setParentName(body.parent?.name || body.name || "");
    if (available[0]) setLearnerId(String(available[0].id));
  }

  async function loadRequests(learner: Learner) {
    const response = await fetch(`/api/parent-permissions/respond?learner_id=${encodeURIComponent(String(learner.id))}&school_id=${Number(learner.school_id)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Permission requests could not be loaded.");
    setRows(body.requests || []);
  }

  useEffect(() => {
    void loadParent();
  }, []);

  useEffect(() => {
    if (selectedLearner) void loadRequests(selectedLearner);
    // The selected learner changes with learnerId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  async function respond(requestId: number, responseValue: "granted" | "declined") {
    if (!selectedLearner || !parentName.trim()) {
      return setMessage("Enter your full name before confirming.");
    }
    setSavingId(requestId);
    const response = await fetch("/api/parent-permissions/respond", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: requestId,
        learner_id: String(selectedLearner.id),
        school_id: Number(selectedLearner.school_id),
        response: responseValue,
        parent_name: parentName.trim(),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setSavingId(null);
      return setMessage(body.error || "Your response could not be saved.");
    }
    setMessage("Your permission response has been recorded.");
    await loadRequests(selectedLearner);
    setSavingId(null);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ParentPageActions />
      <section className="db-page-header db-card-blue">
        <div>
          <h1 className="db-page-title">✅ Permissions</h1>
          <p className="db-page-subtitle">Review and respond to requests from your preschool.</p>
        </div>
      </section>

      {learners.length > 1 ? (
        <label className="db-card" style={{ padding: 18, display: "grid", gap: 8 }}><strong>Choose learner</strong>
          <select className="db-input" value={learnerId} onChange={(event) => setLearnerId(event.target.value)}>
            {learners.map((learner) => <option key={String(learner.id)} value={String(learner.id)}>{learner.name}</option>)}
          </select>
        </label>
      ) : null}
      {message ? <div className="db-soft-card" style={{ padding: 14 }}>{message}</div> : null}

      <label className="db-card" style={{ padding: 18, display: "grid", gap: 8 }}><strong>Parent/guardian full name</strong>
        <input className="db-input" value={parentName} onChange={(event) => setParentName(event.target.value)} placeholder="Your full legal name" />
        <span className="db-helper">Your name, response, date and linked learner will be recorded.</span>
      </label>

      <div style={{ display: "grid", gap: 14 }}>
        {rows.length ? rows.map((row) => {
          const request = relation(row.parent_permission_requests);
          const savedResponse = relation(row.parent_permission_responses);
          if (!request) return null;
          return (
            <article key={row.request_id} className="db-card" style={{ padding: 20, display: "grid", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{request.permission_type === "photos_videos" ? "📸" : request.permission_type === "school_excursion" ? "🚌" : "✅"} {request.title}</h2>
                <p className="db-helper" style={{ margin: "5px 0 0" }}>
                  {request.event_date ? `Event date: ${request.event_date} · ` : ""}
                  {request.response_deadline ? `Respond by ${request.response_deadline}` : "No response deadline"}
                </p>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{request.description}</p>
              {savedResponse ? (
                <div className="db-soft-card" style={{ padding: 14 }}>
                  <strong>{savedResponse.response === "granted" ? "Permission granted" : "Permission declined"}</strong>
                  <p className="db-helper" style={{ margin: "4px 0 0" }}>Recorded for {selectedLearner?.name}. You may update this response before the deadline.</p>
                </div>
              ) : (
                <p className="db-helper" style={{ margin: 0 }}>No response is treated as permission not granted.</p>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="db-button-primary" type="button" disabled={savingId === request.id} onClick={() => void respond(request.id, "granted")}>I Give Permission</button>
                <button className="db-button-secondary" type="button" disabled={savingId === request.id} onClick={() => void respond(request.id, "declined")}>I Do Not Give Permission</button>
              </div>
            </article>
          );
        }) : <div className="db-card" style={{ padding: 32, textAlign: "center" }}><div style={{ fontSize: 36 }}>✅</div><h2 style={{ marginBottom: 6 }}>You are all caught up</h2><p className="db-helper" style={{ margin: 0 }}>No permission requests are waiting for this learner.</p></div>}
      </div>
    </div>
  );
}

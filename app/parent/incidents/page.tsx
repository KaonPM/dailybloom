"use client";

import { useEffect, useState } from "react";

type ParentIncident = {
  id: number; learner_name?: string; report_reference?: string; incident_date?: string;
  incident_time?: string; incident_location?: string; incident_type?: string; description?: string;
  action_taken?: string; urgency?: string; injury_occurred?: string; injury_description?: string;
  medical_assistance_required?: boolean; parent_portal_message?: string;
  parent_acknowledged_at?: string; parent_acknowledged_by?: string; parent_comment?: string;
};

export default function ParentIncidentsPage() {
  const [reports, setReports] = useState<ParentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});

  async function loadReports() {
    const response = await fetch("/api/parent-incidents", { cache: "no-store" });
    const result = await response.json();
    setReports(response.ok ? result.reports || [] : []);
    setLoading(false);
  }
  useEffect(() => { loadReports(); }, []);

  async function acknowledge(report: ParentIncident) {
    setSaving(report.id);
    const response = await fetch("/api/parent-incidents", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: report.id, comment: comments[report.id] || "" }),
    });
    if (response.ok) await loadReports(); else alert("The acknowledgement could not be saved. Please try again.");
    setSaving(null);
  }

  return <div style={{ display: "grid", gap: 16 }}>
    <div className="db-soft-card" style={{ padding: 18 }}>
      <h1 className="db-page-title">Incident Reports</h1>
      <p className="db-page-subtitle">Reports shared securely by your child's principal.</p>
    </div>
    {loading ? <p>Loading incident reports...</p> : reports.length === 0 ?
      <div className="db-soft-card" style={{ padding: 18 }}><strong>No incident reports have been shared.</strong></div> :
      reports.map((report) => <article key={report.id} className="db-soft-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, color: "#2D2A3E" }}>{report.incident_type || "Incident report"}</h2>
          <p className="db-helper">{report.learner_name} - {report.incident_date} {report.incident_time || ""}</p></div>
          <span style={{ alignSelf: "start", borderRadius: 999, padding: "6px 10px", background: report.parent_acknowledged_at ? "#EEF9EE" : "#FFF7D9", fontWeight: 800 }}>
            {report.parent_acknowledged_at ? "Receipt acknowledged" : "Please acknowledge"}</span>
        </div>
        <p><strong>Location:</strong> {report.incident_location}</p>
        <p><strong>What happened:</strong> {report.description}</p>
        <p><strong>Action taken:</strong> {report.action_taken || "No additional action recorded."}</p>
        {report.injury_occurred && report.injury_occurred !== "no" ? <p><strong>Injury:</strong> {report.injury_description || "An injury was recorded."}</p> : null}
        {report.parent_portal_message ? <div style={{ padding: 12, borderRadius: 12, background: "#EAF7FD" }}><strong>Message from the principal</strong><p style={{ marginBottom: 0 }}>{report.parent_portal_message}</p></div> : null}
        {!report.parent_acknowledged_at ? <div style={{ marginTop: 14 }}>
          <label><strong>Optional comment</strong><textarea className="db-input" rows={3} value={comments[report.id] || ""} onChange={(event) => setComments((current) => ({ ...current, [report.id]: event.target.value }))} /></label>
          <p className="db-helper">Acknowledging confirms that you received and read this report. It does not mean that you agree with its contents.</p>
          <button className="db-button-primary" type="button" disabled={saving === report.id} onClick={() => acknowledge(report)}>{saving === report.id ? "Saving..." : "Acknowledge Receipt"}</button>
        </div> : <p className="db-helper">Acknowledged on {new Date(report.parent_acknowledged_at).toLocaleString()}.</p>}
      </article>)}
  </div>;
}

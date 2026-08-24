"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { resolveSchoolContext } from "../lib/school-context";
import { useSearchParams } from "next/navigation";

type Exception = { row: number; message: string };
type Migration = { id: string; source_name: string; status: "validated" | "imported" | "expired"; validation_summary: { uploaded?: number; ready?: number; exceptions?: number }; exceptions: Exception[]; created_at: string; imported_at?: string | null; expires_at: string };

const templateHeaders = ["external_ref", "learner_name", "legal_name", "date_of_birth", "gender", "classroom_name", "guardian_name", "guardian_relationship", "guardian_phone", "guardian_email", "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone", "allergies", "medical_conditions", "support_needs", "fee_billing_start_date"];
const templateExample = ["CHILDCLOUD-001", "Example Learner", "Example Learner", "2022-03-14", "Female", "Sunflowers", "Example Guardian", "Mother", "0821234567", "parent@example.com", "Emergency Contact", "Grandmother", "0831234567", "", "", "", "2027-01-01"];

function parseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Use the template and include at least one learner row.");
  const parseLine = (line: string) => { const values: string[] = []; let value = ""; let quoted = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value.trim()); value = ""; } else value += char; } values.push(value.trim()); return values; };
  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  const missing = ["external_ref", "learner_name", "date_of_birth", "classroom_name", "guardian_name", "guardian_phone"].filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`This file is missing required columns: ${missing.join(", ")}.`);
  return lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] || "", value]))).filter((row) => Object.values(row).some(Boolean));
}

export default function DataMigrationPage() {
  const params = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [active, setActive] = useState<Migration | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (id: number) => {
    const response = await authenticatedFetch(`/api/data-migrations?school_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Migration history could not be loaded.");
    const next = body.migrations || [];
    setMigrations(next); setActive((current) => current ? next.find((item: Migration) => item.id === current.id) || current : next[0] || null);
  }, []);

  useEffect(() => { void (async () => { try { const context = await resolveSchoolContext(params.get("school")); if (context.error) throw new Error(context.error); if (!context.schoolId) throw new Error("Choose a school before opening Data Migration."); setSchoolId(context.schoolId); await load(context.schoolId); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Migration Centre could not be loaded."); } })(); }, [load, params]);

  function downloadTemplate() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = `${templateHeaders.map(escape).join(",")}\n${templateExample.map(escape).join(",")}\n`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "dailybloom-learners-migration-template.csv"; link.click(); URL.revokeObjectURL(link.href);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !schoolId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Use a CSV file no larger than 2 MB.");
      const rows = parseCsv(await file.text());
      if (rows.length > 250) throw new Error("Use a maximum of 250 learner rows per import.");
      const response = await authenticatedFetch("/api/data-migrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", school_id: schoolId, source_name: file.name, rows }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The file could not be validated.");
      setActive(body.migration); setMessage("Validation preview created. Nothing has been imported yet."); await load(schoolId);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "The file could not be validated."); } finally { setBusy(false); event.target.value = ""; }
  }

  async function approveImport() {
    if (!schoolId || !active) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch("/api/data-migrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", school_id: schoolId, migration_id: active.id, confirmation }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The import could not be completed.");
      setMessage(`${body.learners_created} learner profiles were created. Download the migration report from this page for your records.`); setConfirmation(""); await load(schoolId);
    } catch (importError) { setError(importError instanceof Error ? importError.message : "The import could not be completed."); } finally { setBusy(false); }
  }

  return <div style={{ display: "grid", gap: 18 }}>
    <section className="db-page-header db-card-blue"><p className="db-eyebrow">School Administration</p><h1>Data Migration Centre</h1><p className="db-page-subtitle">Bring verified learner data into DailyBloom safely. Uploaded data is validated first; no learner profile is created until you approve the import.</p><div className="db-page-actions"><Link className="db-button-secondary" href="/school-administration">Back to School Administration</Link><button className="db-button-primary" type="button" onClick={downloadTemplate}>Download learners.csv template</button></div></section>
    {error ? <div className="db-error-banner" role="alert">{error}</div> : null}{message ? <div className="db-success-banner" role="status">{message}</div> : null}
    <details className="db-card db-card-green" style={{ padding: 20 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Open migration instructions</summary><ol style={{ color: "var(--db-text-soft)", lineHeight: 1.7 }}><li>Export learner data from your previous system and copy it into the DailyBloom template.</li><li>Use each child&apos;s old-system ID as <code>external_ref</code>; do not include passwords or bank information.</li><li>Match classroom names exactly to the classrooms already created in DailyBloom.</li><li>Upload the file for a validation preview. Resolve every exception before approving the live import.</li></ol><p className="db-helper">Temporary preview data expires after 30 days. Documents are handled through learner requirements and re-enrolment, not this CSV.</p></details>
    <section className="db-card db-card-lavender" style={{ padding: 20 }}><h2 style={{ marginTop: 0 }}>1. Validate learner CSV</h2><p className="db-helper">Required: external reference, learner name, date of birth, classroom, guardian name and guardian mobile number.</p><label className="db-button-primary" style={{ display: "inline-flex", width: "fit-content", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.65 : 1 }}><input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy || !schoolId} style={{ display: "none" }} />{busy ? "Validating…" : "Choose learners.csv"}</label></section>
    {active ? <section className="db-card db-card-blue" style={{ padding: 20 }}><h2 style={{ marginTop: 0 }}>2. Review validation preview</h2><p className="db-helper">Source: {active.source_name} · created {new Date(active.created_at).toLocaleString("en-ZA")}</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><span className="db-main-pill">{active.validation_summary.uploaded || 0} uploaded</span><span className="db-main-pill">{active.validation_summary.ready || 0} ready</span><span className="db-main-pill">{active.validation_summary.exceptions || 0} exceptions</span></div>{active.exceptions.length ? <div style={{ marginTop: 16 }}><strong>Fix these rows in the CSV and upload it again.</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{active.exceptions.slice(0, 20).map((item, index) => <div className="db-list-card" key={`${item.row}-${index}`}>Row {item.row}: {item.message}</div>)}</div></div> : active.status === "validated" ? <div style={{ display: "grid", gap: 10, marginTop: 16 }}><p className="db-helper">This will create {active.validation_summary.ready || 0} learner profiles. It cannot be undone from this screen.</p><label><span className="db-label">Type <strong>IMPORT APPROVED</strong> to create the learner profiles</span><input className="db-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="db-button-primary" type="button" disabled={busy || confirmation !== "IMPORT APPROVED"} onClick={() => void approveImport()}>{busy ? "Importing…" : "Approve live import"}</button></div> : <p className="db-success-banner" style={{ marginTop: 16 }}>Migration completed {active.imported_at ? new Date(active.imported_at).toLocaleString("en-ZA") : ""}.</p>}</section> : null}
    <details className="db-card" style={{ padding: 20 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Open migration history ({migrations.length})</summary><div style={{ display: "grid", gap: 8, marginTop: 14 }}>{migrations.length ? migrations.map((item) => <button className="db-list-card" style={{ textAlign: "left", cursor: "pointer" }} key={item.id} type="button" onClick={() => setActive(item)}><strong>{item.source_name}</strong><p className="db-helper">{item.status} · {item.validation_summary?.uploaded || 0} rows · {item.validation_summary?.exceptions || 0} exceptions</p></button>) : <p className="db-helper">No migration previews yet.</p>}</div></details>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type Pack = {
  school: { school_name?: string | null; logo_url?: string | null; contact_number?: string | null; emis_number?: string | null };
  learner: Record<string, unknown>;
  enrolment: { enquiry_reference?: string | null; academic_year?: number | null; status?: string | null; enrolment_source?: string | null; submitted_at?: string | null; reviewed_at?: string | null; submitted_data?: Record<string, unknown> } | null;
  placement: { classroom_name?: string | null; academic_year?: number | null; placement_status?: string | null };
  documents: Array<{ title: string; required: boolean; uploaded: boolean; file_name?: string | null; uploaded_at?: string | null }>;
  attendance: { present: number; absent: number; other: number; total: number; rate: number | null };
};

const excludedSnapshotKeys = new Set(["uploaded_documents", "consent_responses", "terms", "medical", "emergency_contact", "declaration", "purchased_requirement_items", "requested_recurring_addon_ids", "selected_requirement_template_key"]);

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "Not provided";
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: unknown) {
  if (!value || typeof value !== "string") return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

function displayValue(item: unknown): string {
  if (item === null || item === undefined || item === "") return "Not provided";
  if (typeof item === "boolean") return item ? "Yes" : "No";
  if (typeof item === "object") return Object.entries(item as Record<string, unknown>).map(([key, child]) => `${label(key)}: ${displayValue(child)}`).join(" · ");
  return String(item);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="pack-section"><h2>{title}</h2>{children}</section>;
}

function DetailGrid({ entries }: { entries: Array<[string, unknown]> }) {
  return <div className="pack-grid">{entries.map(([name, item]) => <div key={name} className="pack-field"><strong>{name}</strong><span>{displayValue(item)}</span></div>)}</div>;
}

export default function LearnerEnrolmentPackPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const learnerId = String(params.id || "");
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const context = await resolveSchoolContext(searchParams.get("school"));
      if (context.error) { router.push("/login"); return; }
      if (context.shouldReturnToMaster || !context.schoolId) { router.push("/master"); return; }
      const response = await authenticatedFetch(`/api/learners/enrolment-pack?school_id=${context.schoolId}&learner_id=${encodeURIComponent(learnerId)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "The learner pack could not be loaded."); return; }
      setPack(body as Pack);
    }
    void load();
  }, [learnerId, router, searchParams]);

  if (error) return <main className="db-page-shell"><section className="db-card db-card-yellow"><h1>Could not open learner enrolment pack</h1><p>{error}</p></section></main>;
  if (!pack) return <main className="db-page-shell"><section className="db-card"><p>Preparing learner enrolment pack…</p></section></main>;

  const submitted = pack.enrolment?.submitted_data || {};
  const medical = submitted.medical && typeof submitted.medical === "object" ? submitted.medical as Record<string, unknown> : {};
  const emergency = submitted.emergency_contact && typeof submitted.emergency_contact === "object" ? submitted.emergency_contact as Record<string, unknown> : {};
  const declaration = submitted.declaration && typeof submitted.declaration === "object" ? submitted.declaration as Record<string, unknown> : {};
  const consents = Array.isArray(submitted.consent_responses) ? submitted.consent_responses as Array<Record<string, unknown>> : [];
  const terms = Array.isArray(submitted.terms) ? submitted.terms as Array<Record<string, unknown>> : [];
  const snapshot = Object.entries(submitted).filter(([key]) => !excludedSnapshotKeys.has(key) && !key.startsWith("_"));

  return <main className="db-page-shell learner-pack-page">
    <style>{`@media print { .db-sidebar, .db-topbar, .pack-actions { display: none !important; } .learner-pack-page { max-width: none !important; padding: 0 !important; } .pack-section { break-inside: avoid; } } .learner-pack-page { max-width: 1080px; } .pack-header { display:flex; align-items:center; gap:18px; border-bottom:4px solid #62bddd; padding-bottom:16px; margin-bottom:18px; } .pack-logo { width:88px; height:88px; object-fit:contain; } .pack-title { margin:0; color:#25233a; } .pack-subtitle { margin:4px 0 0; color:#625f78; } .pack-actions { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; } .pack-section { border:1px solid #dedbea; border-radius:12px; padding:16px; margin:14px 0; background:#fff; } .pack-section h2 { margin:0 0 12px; font-size:18px; color:#363153; } .pack-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; } .pack-field { display:grid; gap:3px; padding:9px; background:#faf9fd; border-radius:8px; } .pack-field strong { font-size:12px; color:#5b5675; } .pack-field span { white-space:pre-wrap; } .pack-table { width:100%; border-collapse:collapse; font-size:13px; } .pack-table th,.pack-table td { border:1px solid #ddd8e7; padding:8px; text-align:left; vertical-align:top; } .pack-table th { background:#edf9fd; } .pack-status-ok { color:#177b4f; font-weight:700; } .pack-status-missing { color:#9d3c47; font-weight:700; }`}</style>
    <div className="pack-actions"><button className="db-button-primary" type="button" onClick={() => window.print()}>Print / Save as PDF</button><button className="db-button-secondary" type="button" onClick={() => router.back()}>Back to Learner</button></div>
    <article className="db-card" style={{ padding: 24 }}>
      <header className="pack-header">
        {pack.school.logo_url ? <img className="pack-logo" src={pack.school.logo_url} alt="School logo" /> : null}
        <div><h1 className="pack-title">Learner Profile &amp; Enrolment Pack</h1><p className="pack-subtitle"><strong>{text(pack.school.school_name)}</strong> · Prepared {date(new Date().toISOString())}</p><p className="pack-subtitle">For authorised school, social-work or inspection review only.</p></div>
      </header>
      <Section title="Enrolment record"><DetailGrid entries={[["Enrolment reference", pack.enrolment?.enquiry_reference], ["Academic year", pack.enrolment?.academic_year], ["Status", pack.enrolment?.status ? label(pack.enrolment.status) : null], ["Enrolment pathway", pack.enrolment?.enrolment_source ? label(pack.enrolment.enrolment_source) : null], ["Submitted", date(pack.enrolment?.submitted_at)], ["Classroom", pack.placement.classroom_name], ["Placement status", pack.placement.placement_status ? label(pack.placement.placement_status) : null]]} /></Section>
      <Section title="Learner details"><DetailGrid entries={[["Preferred name", pack.learner.name], ["Legal name", pack.learner.legal_name], ["Date of birth", pack.learner.date_of_birth], ["Gender", pack.learner.gender], ["Nationality", pack.learner.nationality], ["Home language", pack.learner.home_language], ["Birth certificate number", pack.learner.birth_certificate_number], ["South African ID number", pack.learner.sa_id_number], ["Passport number", pack.learner.passport_number], ["Admission number", pack.learner.admission_number]]} /></Section>
      <Section title="Parent, guardian and emergency contact"><DetailGrid entries={[["Primary guardian", pack.learner.guardian_name], ["Relationship", pack.learner.guardian_relationship], ["Guardian ID", pack.learner.guardian_id_number], ["Phone", pack.learner.parent_phone], ["Email", pack.learner.parent_email], ["Emergency contact", emergency.name], ["Emergency contact phone", emergency.phone]]} /></Section>
      <Section title="Health and medical information"><DetailGrid entries={[["Allergies", medical.allergies || pack.learner.allergies], ["Medical conditions", medical.conditions || pack.learner.medical_conditions], ["Medical instructions", pack.learner.medical_instructions], ["Medical aid", medical.medical_aid_name || pack.learner.medical_aid_name], ["Medical aid number", medical.medical_aid_number || pack.learner.medical_aid_number], ["Main member", medical.medical_aid_main_member || pack.learner.medical_aid_main_member], ["Preferred doctor", medical.preferred_doctor_name || pack.learner.family_doctor_name], ["Doctor contact", medical.preferred_doctor_phone || pack.learner.family_doctor_phone], ["Immunisation status", medical.immunisation_status], ["Immunisation notes", medical.immunisation_notes]]} /></Section>
      <Section title="Document checklist"><table className="pack-table"><thead><tr><th>Document</th><th>Required</th><th>Status</th><th>File / uploaded</th></tr></thead><tbody>{pack.documents.length ? pack.documents.map((document) => <tr key={document.title}><td>{document.title}</td><td>{document.required ? "Yes" : "No"}</td><td className={document.uploaded ? "pack-status-ok" : "pack-status-missing"}>{document.uploaded ? "Uploaded" : "Missing"}</td><td>{document.uploaded ? `${document.file_name || "File attached"} · ${date(document.uploaded_at)}` : "—"}</td></tr>) : <tr><td colSpan={4}>No document requirements are configured for this learner.</td></tr>}</tbody></table></Section>
      <Section title="Attendance summary"><DetailGrid entries={[["Attendance records", pack.attendance.total], ["Present", pack.attendance.present], ["Absent", pack.attendance.absent], ["Other statuses", pack.attendance.other], ["Attendance rate", pack.attendance.rate === null ? "Not available" : `${pack.attendance.rate}%`]]} /></Section>
      <Section title="Submitted digital enrolment form">{snapshot.length ? <DetailGrid entries={snapshot.map(([key, item]) => [label(key), item])} /> : <p>No submitted digital enrolment form is linked to this learner.</p>}</Section>
      <Section title="Consent, terms and declaration">{consents.length || terms.length || Object.keys(declaration).length ? <><DetailGrid entries={[["Terms accepted", submitted.terms_accepted], ["Declaration", declaration.name ? `${displayValue(declaration.name)} · ${displayValue(declaration.relationship)}` : null]]} />{consents.length ? <table className="pack-table" style={{ marginTop: 12 }}><thead><tr><th>Consent</th><th>Response</th></tr></thead><tbody>{consents.map((consent, index) => <tr key={`${String(consent.id || consent.title)}-${index}`}><td>{displayValue(consent.title)}</td><td>{consent.accepted === true ? "Accepted" : "Not accepted"}</td></tr>)}</tbody></table> : null}{terms.length ? <table className="pack-table" style={{ marginTop: 12 }}><thead><tr><th>Terms section</th><th>Accepted</th></tr></thead><tbody>{terms.map((term, index) => <tr key={`${String(term.id || term.title)}-${index}`}><td>{displayValue(term.title)}</td><td>{term.accepted === true ? "Accepted" : "Not accepted"}</td></tr>)}</tbody></table> : null}</> : <p>No digital consent, terms or declaration record is linked to this learner.</p>}</Section>
    </article>
  </main>;
}

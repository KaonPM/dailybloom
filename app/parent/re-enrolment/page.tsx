"use client";

import { useCallback, useEffect, useState } from "react";

import ParentPageActions from "../components/ParentPageActions";

type DetailMap = Record<string, string | null | undefined>;
type SnapshotItem = { id: string; name: string; quantity?: number | null; category?: string | null };
type RenewalSnapshot = {
  learner_details?: DetailMap;
  guardian_details?: DetailMap;
  medical_details?: DetailMap;
  missing_documents?: SnapshotItem[];
  missing_requirements?: SnapshotItem[];
};
type SubmittedData = {
  parent_notes?: string;
  learner_details?: DetailMap;
  guardian_details?: DetailMap;
  medical_details?: DetailMap;
  acknowledged_document_ids?: string[];
  acknowledged_requirement_ids?: string[];
  uploaded_documents?: Record<string, { name: string; path: string }>;
  draft_saved_at?: string;
  requested_recurring_addon_ids?: number[];
};
type Reenrolment = {
  id: string;
  reenrolment_reference: string;
  parent_portal_phone: string | null;
  registration_fee_amount: number;
  registration_payment_status: "not_required" | "pending" | "verified" | "waived";
  status: "awaiting_parent" | "submitted" | "approved" | "declined" | "no_response" | "school_leaver" | "not_returning";
  submitted_data: SubmittedData | null;
  renewal_snapshot: RenewalSnapshot | null;
  form_snapshot: { form_name?: string; instructions?: string } | null;
  decline_reason?: string | null;
  school_year: number;
  response_deadline: string | null;
  learner_name: string;
  classroom_name: string;
  recurring_addons?: Array<{ id: number; fee_name: string; amount: number }>;
};
type Draft = {
  learnerDetails: Record<string, string>;
  guardianDetails: Record<string, string>;
  medicalDetails: Record<string, string>;
  parentPortalPhone: string;
  parentNotes: string;
  acknowledgedDocumentIds: string[];
  acknowledgedRequirementIds: string[];
  uploadedDocuments: Record<string, { name: string; path: string }>;
  requestedRecurringAddonIds: number[];
  confirmed: boolean;
};

const learnerFields = [
  ["name", "Preferred name"], ["legal_name", "Full legal name"], ["date_of_birth", "Date of birth"],
  ["gender", "Gender"], ["birth_certificate_number", "Birth certificate number"],
  ["sa_id_number", "SA ID number"], ["passport_number", "Passport number"], ["home_address", "Home address"],
] as const;
const guardianFields = [
  ["guardian_name", "Parent / guardian name"], ["guardian_relationship", "Relationship"],
  ["guardian_id_number", "Parent / guardian ID number"], ["parent_phone", "Contact number"], ["parent_email", "Email address"],
] as const;
const medicalFields = [
  ["allergies", "Allergies"], ["medical_conditions", "Medical conditions"], ["medical_instructions", "Medical instructions"],
  ["medical_aid_name", "Medical aid name"], ["medical_aid_number", "Medical aid membership number"],
  ["medical_aid_main_member", "Medical aid main member"], ["preferred_doctor_name", "Preferred doctor"],
  ["preferred_doctor_phone", "Doctor contact number"], ["immunisation_status", "Immunisation status"],
  ["immunisation_notes", "Immunisation notes"],
] as const;
const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));
const readableStatus: Record<Reenrolment["status"], string> = {
  awaiting_parent: "Action needed", submitted: "Submitted for review", approved: "Approved — awaiting classroom allocation", declined: "School follow-up needed", no_response: "Response overdue", school_leaver: "Grade R completed / school leaver", not_returning: "Not returning",
};
const textMap = (value?: DetailMap | null) => Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, String(item || "")]));

function buildDraft(record: Reenrolment, fallbackPhone: string): Draft {
  const submitted = record.submitted_data || {};
  const snapshot = record.renewal_snapshot || {};
  return {
    learnerDetails: textMap(submitted.learner_details || snapshot.learner_details),
    guardianDetails: textMap(submitted.guardian_details || snapshot.guardian_details),
    medicalDetails: textMap(submitted.medical_details || snapshot.medical_details),
    parentPortalPhone: record.parent_portal_phone || fallbackPhone,
    parentNotes: submitted.parent_notes || "",
    acknowledgedDocumentIds: submitted.acknowledged_document_ids || [],
    acknowledgedRequirementIds: submitted.acknowledged_requirement_ids || [],
    uploadedDocuments: submitted.uploaded_documents || {},
    requestedRecurringAddonIds: (submitted.requested_recurring_addon_ids || []).map(Number).filter(Number.isInteger),
    confirmed: false,
  };
}

export default function ParentReenrolmentPage() {
  const [reenrolments, setReenrolments] = useState<Reenrolment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/parent-reenrolments", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Re-enrolment could not be loaded.");
    const records = (body.reenrolments || []) as Reenrolment[];
    setReenrolments(records);
    setDrafts(Object.fromEntries(records.map((record) => [record.id, buildDraft(record, String(body.parent_phone || ""))])));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try { await load(); } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Re-enrolment could not be loaded."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [load]);

  function changeDetail(id: string, group: "learnerDetails" | "guardianDetails" | "medicalDetails", key: string, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [group]: { ...current[id][group], [key]: value } } }));
  }
  function toggleAcknowledgement(id: string, group: "acknowledgedDocumentIds" | "acknowledgedRequirementIds", itemId: string, checked: boolean) {
    setDrafts((current) => {
      const values = current[id][group];
      return { ...current, [id]: { ...current[id], [group]: checked ? [...new Set([...values, itemId])] : values.filter((value) => value !== itemId) } };
    });
  }

  async function submit(record: Reenrolment) {
    const draft = drafts[record.id];
    setSavingId(record.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/parent-reenrolments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit", reenrolment_id: record.id, parent_portal_phone: draft.parentPortalPhone,
          parent_notes: draft.parentNotes, confirm_return: draft.confirmed,
          learner_details: draft.learnerDetails, guardian_details: draft.guardianDetails, medical_details: draft.medicalDetails,
          uploaded_documents: draft.uploadedDocuments,
          acknowledged_document_ids: draft.acknowledgedDocumentIds, acknowledged_requirement_ids: draft.acknowledgedRequirementIds,
          requested_recurring_addon_ids: draft.requestedRecurringAddonIds,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your re-enrolment could not be submitted.");
      setMessage(`${record.learner_name}'s re-enrolment has been sent to the school for review.`);
      await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Your re-enrolment could not be submitted."); }
    finally { setSavingId(null); }
  }
  async function saveDraft(record: Reenrolment) {
    const draft = drafts[record.id];
    setSavingId(record.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/parent-reenrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_draft", reenrolment_id: record.id, parent_portal_phone: draft.parentPortalPhone, parent_notes: draft.parentNotes, learner_details: draft.learnerDetails, guardian_details: draft.guardianDetails, medical_details: draft.medicalDetails, uploaded_documents: draft.uploadedDocuments, acknowledged_requirement_ids: draft.acknowledgedRequirementIds, requested_recurring_addon_ids: draft.requestedRecurringAddonIds }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your draft could not be saved.");
      setMessage(`Draft saved for ${record.learner_name}. You can safely continue later.`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Your draft could not be saved."); }
    finally { setSavingId(null); }
  }
  async function uploadDocument(record: Reenrolment, documentName: string, file?: File) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setError("Use a PDF, JPG, PNG or WEBP document no larger than 10 MB."); return; }
    setUploadingDocument(`${record.id}:${documentName}`); setError("");
    try {
      const response = await fetch("/api/parent-reenrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_document_upload", reenrolment_id: record.id, file_name: file.name, file_size: file.size, content_type: file.type }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not prepare the document upload.");
      const uploadResponse = await fetch(body.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("The document could not be uploaded. Please try again.");
      setDrafts((current) => ({ ...current, [record.id]: { ...current[record.id], uploadedDocuments: { ...current[record.id].uploadedDocuments, [documentName]: { name: file.name, path: body.path } } } }));
      setMessage(`${documentName} uploaded. Save the draft or submit the form when ready.`);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "The document could not be uploaded."); }
    finally { setUploadingDocument(""); }
  }
  async function markNotReturning(record: Reenrolment) {
    const reason = window.prompt(`Optional note for the school about why ${record.learner_name} will not return:`) || "";
    if (!window.confirm(`Confirm that ${record.learner_name} will not return for ${record.school_year}?`)) return;
    setSavingId(record.id); setError("");
    try { const response = await fetch("/api/parent-reenrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "not_returning", reenrolment_id: record.id, parent_notes: reason }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "The response could not be saved."); setMessage(`${record.learner_name} has been marked as not returning.`); await load(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The response could not be saved."); } finally { setSavingId(null); }
  }

  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 18px 44px", display: "grid", gap: 18 }}>
    <ParentPageActions />
    <section className="db-card db-card-blue" style={{ padding: 24 }}>
      <p className="db-eyebrow">Parent Portal</p><h1 className="db-page-title" style={{ marginBottom: 8 }}>Re-enrolment</h1>
      <p className="db-page-subtitle" style={{ maxWidth: 760 }}>Review the digital form, confirm outstanding items and submit your learner&apos;s return for school approval.</p>
    </section>
    {error ? <div className="db-error-banner" role="alert">{error}</div> : null}
    {message ? <div className="db-success-banner" role="status">{message}</div> : null}
    {loading ? <section className="db-card"><p className="db-helper">Loading re-enrolment information...</p></section> : null}
    {!loading && reenrolments.length === 0 ? <section className="db-card db-soft-card" style={{ padding: 24 }}><h2 style={{ marginTop: 0 }}>No re-enrolment is open</h2><p className="db-helper">Your school will show re-enrolment here when it is ready.</p></section> : null}
    {reenrolments.map((record) => {
      const draft = drafts[record.id];
      if (!draft) return null;
      const snapshot = record.renewal_snapshot || {};
      const canEdit = record.status === "awaiting_parent" || record.status === "declined" || record.status === "no_response";
      return <section className="db-card" key={record.id} style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>{record.learner_name}</h2><p className="db-helper">{record.classroom_name} · {record.school_year} re-enrolment · {record.reenrolment_reference}</p></div>
          <span className="db-status-pill">{readableStatus[record.status]}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "16px 0" }}>
          <div className="db-soft-card" style={{ padding: 14 }}><strong>Response deadline</strong><br />{record.response_deadline || "Not set"}</div>
          <div className="db-soft-card" style={{ padding: 14 }}><strong>Registration Fee</strong><br />{record.registration_fee_amount > 0 ? `${money(record.registration_fee_amount)} · ${record.registration_payment_status}` : "Not selected"}</div>
        </div>
        {record.form_snapshot?.form_name ? <div className="db-soft-card" style={{ padding: 16, marginBottom: 16 }}><strong>{record.form_snapshot.form_name}</strong>{record.form_snapshot.instructions ? <p className="db-helper" style={{ marginBottom: 0 }}>{record.form_snapshot.instructions}</p> : null}</div> : null}
        {record.status === "declined" ? <div className="db-error-banner"><strong>The school needs an update.</strong><br />{record.decline_reason || "Please review and submit again."}</div> : null}
        {record.status === "approved" ? <div className="db-success-banner">Re-enrolment approved. The school will confirm the learner&apos;s next classroom when classroom planning is complete. Parent Portal access remains active.</div> : null}
        {canEdit ? <div style={{ display: "grid", gap: 16 }}>
          <details className="db-soft-card" style={{ padding: 16 }} open><summary><strong>Learner information</strong></summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>{learnerFields.map(([key, label]) => <label key={key}><span className="db-label">{label}</span>{key === "home_address" ? <textarea className="db-input" rows={2} value={draft.learnerDetails[key] || ""} onChange={(event) => changeDetail(record.id, "learnerDetails", key, event.target.value)} /> : <input className="db-input" type={key === "date_of_birth" ? "date" : "text"} value={draft.learnerDetails[key] || ""} onChange={(event) => changeDetail(record.id, "learnerDetails", key, event.target.value)} />}</label>)}</div></details>
          <details className="db-soft-card" style={{ padding: 16 }} open><summary><strong>Parent / guardian information</strong></summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>{guardianFields.map(([key, label]) => <label key={key}><span className="db-label">{label}</span><input className="db-input" type={key === "parent_email" ? "email" : "text"} value={draft.guardianDetails[key] || ""} onChange={(event) => changeDetail(record.id, "guardianDetails", key, event.target.value)} /></label>)}<label><span className="db-label">Parent Portal mobile number</span><input className="db-input" type="tel" value={draft.parentPortalPhone} onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...current[record.id], parentPortalPhone: event.target.value } }))} /><small className="db-helper">Choose one South African mobile number. The school approves the change.</small></label></div></details>
          <details className="db-soft-card" style={{ padding: 16 }}><summary><strong>Medical and immunisation information</strong></summary><p className="db-helper">Review medical aid, preferred doctor and immunisation details. Immunisation information should be supported by the latest clinic card where the school requires it.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>{medicalFields.map(([key, label]) => <label key={key}><span className="db-label">{label}</span>{key === "immunisation_status" ? <select className="db-input" value={draft.medicalDetails[key] || ""} onChange={(event) => changeDetail(record.id, "medicalDetails", key, event.target.value)}><option value="">Select</option><option value="up_to_date">Yes, up to date</option><option value="outstanding">Vaccines outstanding</option><option value="scheduled">Updates scheduled</option><option value="not_applicable">Not applicable / exempt</option></select> : ["allergies", "medical_conditions", "medical_instructions", "immunisation_notes"].includes(key) ? <textarea className="db-input" rows={2} value={draft.medicalDetails[key] || ""} onChange={(event) => changeDetail(record.id, "medicalDetails", key, event.target.value)} /> : <input className="db-input" type={key === "preferred_doctor_phone" ? "tel" : "text"} value={draft.medicalDetails[key] || ""} onChange={(event) => changeDetail(record.id, "medicalDetails", key, event.target.value)} />}</label>)}</div></details>
          {(record.recurring_addons || []).length ? <div className="db-soft-card" style={{ padding: 16 }}><strong>Optional monthly services</strong><p className="db-helper">Request services for the new year. The school confirms them before billing starts.</p>{record.recurring_addons?.map((addon) => <label className="db-checkbox-row" key={addon.id}><input type="checkbox" checked={draft.requestedRecurringAddonIds.includes(addon.id)} onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...current[record.id], requestedRecurringAddonIds: event.target.checked ? [...new Set([...current[record.id].requestedRecurringAddonIds, addon.id])] : current[record.id].requestedRecurringAddonIds.filter((id) => id !== addon.id) } }))} /><span>{addon.fee_name} · {money(addon.amount)} per month</span></label>)}</div> : null}
          {(snapshot.missing_documents || []).length > 0 ? <div className="db-soft-card" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>Documents to upload</h3><p className="db-helper">Existing valid learner documents are reused. Upload only the missing school-required documents listed below.</p>{snapshot.missing_documents?.map((item) => { const upload = draft.uploadedDocuments[item.name]; const uploadKey = `${record.id}:${item.name}`; return <label className="db-soft-card" key={item.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><span><strong>{item.name}</strong><small className="db-helper" style={{ display: "block" }}>{upload?.name || "PDF, JPG, PNG or WEBP up to 10 MB"}</small></span><span className="db-button-secondary" style={{ cursor: "pointer" }}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={uploadingDocument === uploadKey} onChange={(event) => void uploadDocument(record, item.name, event.target.files?.[0])} />{uploadingDocument === uploadKey ? "Uploading…" : upload ? "Replace" : "Upload"}</span></label>; })}</div> : <div className="db-success-banner">All required learner documents already on file will be reused for this re-enrolment.</div>}
          {(snapshot.missing_requirements || []).length > 0 ? <div className="db-soft-card" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>Outstanding learner requirements</h3><p className="db-helper">Ticking confirms that you have seen what is still needed. The school records items when received.</p>{snapshot.missing_requirements?.map((item) => <label className="db-checkbox-row" key={item.id}><input type="checkbox" checked={draft.acknowledgedRequirementIds.includes(item.id)} onChange={(event) => toggleAcknowledgement(record.id, "acknowledgedRequirementIds", item.id, event.target.checked)} /><span>{item.name}{item.quantity ? ` · ${item.quantity} required` : ""}</span></label>)}</div> : null}
          <label><span className="db-label">Notes for the school <em>(optional)</em></span><textarea className="db-input" rows={3} maxLength={800} value={draft.parentNotes} onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...current[record.id], parentNotes: event.target.value } }))} /></label>
          <label className="db-checkbox-row"><input type="checkbox" checked={draft.confirmed} onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...current[record.id], confirmed: event.target.checked } }))} /><span>I confirm that {record.learner_name} will return for {record.school_year} and that the information above is correct.</span></label>
          <div className="db-page-actions"><button className="db-button-primary" type="button" onClick={() => void submit(record)} disabled={savingId === record.id}>{savingId === record.id ? "Saving..." : record.status === "declined" ? "Update and Resubmit" : "Submit Re-enrolment"}</button><button className="db-button-secondary" type="button" onClick={() => void saveDraft(record)} disabled={savingId === record.id}>Save Draft</button><button className="db-button-secondary" type="button" onClick={() => void markNotReturning(record)} disabled={savingId === record.id}>Learner Will Not Return</button></div>
        </div> : record.status !== "approved" ? <div className="db-success-banner">The school has received this digital form and will update you if anything else is needed.</div> : null}
      </section>;
    })}
  </main>;
}

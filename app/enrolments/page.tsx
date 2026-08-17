"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type Form = {
  id: string;
  form_name: string;
  form_type: "general" | "babies" | "grade_r";
  is_active: boolean;
};

type RelatedForm = Pick<Form, "form_name" | "form_type"> | Pick<Form, "form_name" | "form_type">[] | null;

type EnrolmentDelivery = {
  id: string;
  message_kind: "registration" | "form" | "access_code";
  template_name: string;
  template_version: string;
  template_category: "utility" | "authentication";
  status: "sending" | "sent" | "delivered" | "read" | "retry_scheduled" | "failed";
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
};

type Enquiry = {
  id: string;
  enquiry_reference: string;
  parent_name: string;
  parent_phone: string;
  registration_fee_amount: number;
  registration_payment_status: "pending" | "verified" | "waived";
  registration_payment_reference: string | null;
  registration_payment_verified_at: string | null;
  status: "payment_pending" | "form_issued" | "submitted" | "approved" | "declined" | "withdrawn";
  submitted_data: Record<string, unknown> | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  decline_reason: string | null;
  enrolment_source?: "digital_parent" | "paper_manual_capture" | "printed_blank_form" | "re_enrolment" | "existing_manual_learner";
  academic_year?: number;
  printed_at?: string | null;
  paper_received_at?: string | null;
  created_at: string;
  school_enrolment_forms: RelatedForm;
  deliveries?: EnrolmentDelivery[];
};

type ShareDetails = {
  title: string;
  message: string;
  url?: string;
  deliveryNote?: string;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: Enquiry["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLabel(source?: Enquiry["enrolment_source"]) {
  return source === "printed_blank_form" ? "Printed blank form" : source === "paper_manual_capture" ? "Paper capture" : source === "re_enrolment" ? "Re-enrolment" : "Digital parent";
}

function deliveryKindLabel(kind: EnrolmentDelivery["message_kind"]) {
  return kind === "registration" ? "Registration Fee request" : kind === "form" ? "Secure enrolment form" : "Access code";
}

function deliveryStatusLabel(status: EnrolmentDelivery["status"]) {
  return status === "retry_scheduled" ? "Automatic retry scheduled" : status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deliveryTimestamp(delivery: EnrolmentDelivery) {
  return delivery.read_at || delivery.delivered_at || delivery.sent_at || delivery.failed_at || delivery.created_at;
}

export default function EnrolmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState("Your school");
  const [forms, setForms] = useState<Form[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pipelinePage, setPipelinePage] = useState(0);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [newEnquiryOpen, setNewEnquiryOpen] = useState(true);
  const [pipelineOpen, setPipelineOpen] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [share, setShare] = useState<ShareDetails | null>(null);
  const [manualSource, setManualSource] = useState<"paper_manual_capture" | "printed_blank_form" | null>(null);
  const [manualYear, setManualYear] = useState(new Date().getFullYear());
  const [startingManual, setStartingManual] = useState(false);

  const schoolQuery = useMemo(() => {
    const school = searchParams.get("school");
    return school ? `?school=${encodeURIComponent(school)}` : "";
  }, [searchParams]);

  async function loadPage() {
    setLoading(true);
    setError("");
    const context = await resolveSchoolContext(searchParams.get("school"));
    if (context.error) {
      setError(context.error);
      if (context.error === "Not authenticated") router.push("/login");
      setLoading(false);
      return;
    }
    if (context.shouldReturnToMaster || !context.schoolId) {
      router.push("/master");
      return;
    }
    setSchoolId(context.schoolId);
    try {
      const response = await authenticatedFetch(`/api/enrolments?school_id=${context.schoolId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Enrolments could not be loaded.");
      const loadedForms = (body.forms || []) as Form[];
      setForms(loadedForms);
      setEnquiries((body.enquiries || []) as Enquiry[]);
      setSchoolName(body.school_name || "Your school");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Enrolments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
    // The active school is resolved once while this page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEnquiry() {
    if (!schoolId) return;
    setCreating(true);
    setError("");
    setMessage("");
    setShare(null);
    try {
      const response = await authenticatedFetch("/api/enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", school_id: schoolId, parent_name: parentName, parent_phone: parentPhone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The enrolment enquiry could not be created.");
      setParentName("");
      setParentPhone("");
      const sent = Boolean(body.whatsapp_sent);
      const retryScheduled = Boolean(body.whatsapp_retry_scheduled);
      setMessage(sent
        ? `Registration Fee request sent by WhatsApp for ${body.enquiry.enquiry_reference}.`
        : retryScheduled
          ? `Enquiry ${body.enquiry.enquiry_reference} is ready. DailyBloom will retry the WhatsApp delivery automatically.`
          : `Enquiry ${body.enquiry.enquiry_reference} is ready. WhatsApp delivery could not be completed; copy the message below if needed.`);
      setShare({
        title: "Registration Fee request",
        message: body.whatsapp_message || "",
        deliveryNote: sent
          ? "Sent securely by WhatsApp to the parent mobile number."
          : retryScheduled
            ? "The first WhatsApp delivery was not confirmed. DailyBloom has scheduled automatic retries; no manual resend is needed yet."
            : `WhatsApp was not sent: ${body.whatsapp_error || "delivery could not be confirmed."}`,
      });
      setNewEnquiryOpen(false);
      setPipelineOpen(true);
      await loadPage();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The enrolment enquiry could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(enquiry: Enquiry, action: "verify_registration_payment" | "issue_form" | "review" | "mark_paper_received" | "withdraw", extras: Record<string, string> = {}) {
    if (!schoolId) return;
    setWorkingId(enquiry.id);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, school_id: schoolId, enquiry_id: enquiry.id, ...extras }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The enrolment action could not be completed.");
      if (action === "issue_form") {
        const sent = Boolean(body.whatsapp_sent);
        const retryScheduled = Boolean(body.whatsapp_retry_scheduled);
        setShare({
          title: "Secure digital enrolment form",
          message: body.whatsapp_message || "",
          url: body.form_url,
          deliveryNote: sent
            ? "Secure form link sent by WhatsApp to the parent mobile number."
            : retryScheduled
              ? "The first WhatsApp delivery was not confirmed. DailyBloom has scheduled automatic retries; no manual resend is needed yet."
              : `WhatsApp was not sent: ${body.whatsapp_error || "delivery could not be confirmed."}`,
        });
        setMessage(sent
          ? `Secure form issued for ${enquiry.enquiry_reference}. It expires ${formatDate(body.expires_at)}.`
          : retryScheduled
            ? `Secure form issued for ${enquiry.enquiry_reference}. DailyBloom will retry the WhatsApp delivery automatically.`
            : `Secure form issued for ${enquiry.enquiry_reference}, but WhatsApp could not be sent.`);
      } else if (action === "review") {
        setMessage(extras.decision === "approved" ? "Enrolment approved. It is ready for learner capture and class allocation." : "Enrolment declined and the reason was recorded.");
      } else if (action === "mark_paper_received") {
        setMessage(`Paper form received for ${enquiry.enquiry_reference}. You can now capture it into DailyBloom.`);
      } else {
        setPaymentFor(null);
        setPaymentReference("");
        setMessage("Registration Fee payment confirmed. You can now issue the secure digital form.");
      }
      await loadPage();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The enrolment action could not be completed.");
    } finally {
      setWorkingId(null);
    }
  }

  async function copyMessage() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.message);
      setMessage("Message copied. You can now send it to the parent by another approved channel if necessary.");
    } catch {
      setError("The message could not be copied. Please select and copy it manually.");
    }
  }

  async function startManualApplication() {
    if (!schoolId || !manualSource) return;
    setStartingManual(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch("/api/enrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start_manual_application", school_id: schoolId, enrolment_source: manualSource, academic_year: manualYear }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not start the enrolment.");
      setMessage(`${manualSource === "printed_blank_form" ? "Blank form ready to print" : "Manual enrolment started"}: ${body.enquiry.enquiry_reference} (${body.enquiry.academic_year}).`);
      if (manualSource === "printed_blank_form") {
        router.push(`/enrolments/print/${encodeURIComponent(body.enquiry.id)}${schoolQuery}`);
        return;
      }
      setManualSource(null); await loadPage();
    } catch (startError) { setError(startError instanceof Error ? startError.message : "Could not start the enrolment."); } finally { setStartingManual(false); }
  }

  const filteredEnquiries = enquiries.filter((enquiry) => `${enquiry.enquiry_reference} ${enquiry.parent_name} ${enquiry.parent_phone}`.toLowerCase().includes(pipelineSearch.trim().toLowerCase()));
  const pipelinePageCount = Math.max(1, Math.ceil(filteredEnquiries.length / 20));
  const displayedEnquiries = filteredEnquiries.slice(pipelinePage * 20, pipelinePage * 20 + 20);
  const manualEnrolmentHref = schoolQuery
    ? `/children${schoolQuery}&action=add`
    : "/children?action=add";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="db-page-header db-card-blue">
        <div>
          <h1 className="db-page-title">Enrolments</h1>
          <p className="db-page-subtitle">Create a secure parent journey from Registration Fee confirmation to form review and learner capture.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="db-main-pill db-main-pill-yellow" href={`/dashboard${schoolQuery}`}>Dashboard</Link>
          <Link className="db-button-secondary" href={`/school-setup${schoolQuery}`}>School Setup</Link>
        </div>
      </section>

      {error ? <div className="db-soft-card" role="alert" style={{ padding: 14, color: "#a33d45" }}>{error}</div> : null}
      {message ? <div className="db-soft-card" role="status" style={{ padding: 14, color: "#246b45" }}>{message}</div> : null}

      {share ? (
        <section className="db-card db-card-green" style={{ display: "grid", gap: 12 }}>
          <div><h2 style={{ margin: 0 }}>{share.title}</h2><p className="db-helper" style={{ marginBottom: 0 }}>{share.deliveryNote || "DailyBloom has prepared the message."}</p></div>
          <textarea className="db-input" readOnly rows={6} value={share.message} aria-label={`${share.title} message`} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="db-button-secondary" type="button" onClick={() => void copyMessage()}>Copy Message</button>
            {share.url ? <a className="db-button-secondary" href={share.url} target="_blank" rel="noreferrer">Open Secure Form</a> : null}
            <button className="db-button-secondary" type="button" onClick={() => setShare(null)}>Close</button>
          </div>
        </section>
      ) : null}

      <section className="db-card db-card-yellow" style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>New Enquiry</h2>
            <p className="db-helper" style={{ marginBottom: 0 }}>The form uses the single Registration Fee already set in School Fee Setup. No second fee is created here.</p>
          </div>
          <Link className="db-button-secondary" href={manualEnrolmentHref}>
            + Add Learner Manually
          </Link>
          <button className="db-collapse-action" type="button" onClick={() => setNewEnquiryOpen((current) => !current)} aria-expanded={newEnquiryOpen}>
            {newEnquiryOpen ? "Close" : "Open"}
          </button>
        </div>
        {newEnquiryOpen ? <>
        {forms.length === 0 ? (
          <div className="db-soft-card" style={{ padding: 14 }}>
            Create at least one active enrolment form in <Link href={`/school-setup${schoolQuery}`}>School Setup</Link> before starting an enquiry.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={{ display: "grid", gap: 7 }}><strong>Parent or guardian name</strong><input className="db-input" value={parentName} onChange={(event) => setParentName(event.target.value)} placeholder="Parent or guardian name" /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Parent mobile number</strong><input className="db-input" inputMode="tel" value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} placeholder="e.g. 082 000 0000" /></label>
            <div className="db-soft-card" style={{ padding: 12 }}><strong>Universal enrolment form</strong><br /><small className="db-helper">DailyBloom uses your School Setup configuration for every new application.</small></div>
          </div>
        )}
        {forms.length > 0 ? <div><button className="db-button-primary" type="button" disabled={creating} onClick={() => void createEnquiry()}>{creating ? "Creating..." : "Create Registration Fee Request"}</button></div> : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="db-button-secondary" type="button" onClick={() => setManualSource("printed_blank_form")}>Print Blank Enrolment Form</button><button className="db-button-secondary" type="button" onClick={() => setManualSource("paper_manual_capture")}>Start Digital Enrolment</button></div>
        {manualSource ? <div className="db-soft-card" style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}><label style={{ display: "grid", gap: 5 }}><span className="db-helper">Academic year</span><select className="db-input" value={manualYear} onChange={(event) => setManualYear(Number(event.target.value))}><option value={new Date().getFullYear()}>{new Date().getFullYear()} Current year</option><option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1} Next year</option></select></label><button className="db-button-primary" type="button" disabled={startingManual} onClick={() => void startManualApplication()}>{startingManual ? "Creating..." : manualSource === "printed_blank_form" ? "Create and open printable form" : "Start capture"}</button><button className="db-button-secondary" type="button" onClick={() => setManualSource(null)}>Cancel</button></div> : null}
        </> : null}
      </section>

      <section className="db-card db-card-lavender" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><h2 style={{ margin: 0 }}>Enrolment Pipeline</h2><p className="db-helper" style={{ marginBottom: 0 }}>{schoolName} · {enquiries.length} total enquiries</p></div>
          <div className="enrolment-pipeline-controls" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto 96px", gap: 10, alignItems: "center" }}>
            <input className="db-input" style={{ marginBottom: 0 }} value={pipelineSearch} onChange={(event) => { setPipelineSearch(event.target.value); setPipelinePage(0); }} placeholder="Search reference, parent or mobile" aria-label="Search enrolments" />
            <button className="db-button-secondary" type="button" onClick={() => void loadPage()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
            <button className="db-collapse-action" style={{ width: 96, justifySelf: "end" }} type="button" onClick={() => setPipelineOpen((current) => !current)} aria-expanded={pipelineOpen}>{pipelineOpen ? "Close" : "Open"} list</button>
          </div>
        </div>

        {pipelineOpen && <>
        {loading ? <p className="db-helper">Loading enrolments...</p> : null}
        {!loading && enquiries.length === 0 ? <div className="db-soft-card" style={{ padding: 16 }}>No enrolment enquiries have been created yet.</div> : null}
        {!loading ? <div style={{ display: "grid", gap: 12 }}>
          {displayedEnquiries.map((enquiry) => {
            const form = first(enquiry.school_enrolment_forms);
            const isWorking = workingId === enquiry.id;
            return (
              <details className="db-soft-card enrolment-pipeline-row" key={enquiry.id}>
                <summary className="enrolment-pipeline-summary">
                  <strong>{enquiry.enquiry_reference}</strong><span>{enquiry.parent_name}</span><span>{enquiry.parent_phone}</span><span>{formatDate(enquiry.created_at)}</span><span className="db-status-pill">{statusLabel(enquiry.status)}</span><span className="db-collapse-action">Actions</span>
                </summary>
                <div className="enrolment-pipeline-details">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div><h3 style={{ margin: 0 }}>{enquiry.enquiry_reference}</h3><p className="db-helper" style={{ marginBottom: 0 }}>{enquiry.parent_name} · {enquiry.parent_phone} · {form?.form_name || "Enrolment Form"}</p></div>
                  <span className="db-status-pill">{statusLabel(enquiry.status)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  <div><strong>Registration Fee</strong><br />{formatMoney(enquiry.registration_fee_amount)}</div>
                  <div><strong>Payment status</strong><br />{enquiry.registration_payment_status === "verified" ? "Confirmed" : enquiry.registration_payment_status === "waived" ? "Waived" : "Awaiting confirmation"}</div>
                  <div><strong>Created</strong><br />{formatDate(enquiry.created_at)}</div>
                  <div><strong>Academic year</strong><br />{enquiry.academic_year || new Date(enquiry.created_at).getFullYear()}</div>
                  <div><strong>Source</strong><br />{sourceLabel(enquiry.enrolment_source)}</div>
                  {enquiry.registration_payment_reference ? <div><strong>Payment reference</strong><br />{enquiry.registration_payment_reference}</div> : null}
                </div>

                {enquiry.deliveries?.length ? (
                  <details style={{ borderTop: "1px solid #eadfd8", paddingTop: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>WhatsApp delivery history · {enquiry.deliveries.length} update{enquiry.deliveries.length === 1 ? "" : "s"}</summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      {enquiry.deliveries.map((delivery) => (
                        <div className="db-soft-card" key={delivery.id} style={{ padding: 10, display: "grid", gap: 3 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <strong>{deliveryKindLabel(delivery.message_kind)}</strong>
                            <span className="db-status-pill">{deliveryStatusLabel(delivery.status)}</span>
                          </div>
                          <small className="db-helper">{formatDateTime(deliveryTimestamp(delivery))} · {delivery.template_name} v{delivery.template_version} · {delivery.template_category === "authentication" ? "Authentication" : "Utility"}</small>
                          {delivery.attempt_count > 1 ? <small className="db-helper">Attempt {delivery.attempt_count} of 4</small> : null}
                          {delivery.status === "retry_scheduled" && delivery.next_retry_at ? <small className="db-helper">Next automatic retry: {formatDateTime(delivery.next_retry_at)}</small> : null}
                          {delivery.status === "failed" && delivery.last_error ? <small style={{ color: "#a33d45" }}>Final delivery error: {delivery.last_error}</small> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {enquiry.status === "payment_pending" && enquiry.registration_payment_status === "pending" ? (
                  paymentFor === enquiry.id ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                      <label style={{ display: "grid", gap: 7, flex: "1 1 260px" }}><strong>Proof or payment reference</strong><input className="db-input" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Reference from proof of payment" /></label>
                      <button className="db-button-primary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "verify_registration_payment", { payment_reference: paymentReference })}>{isWorking ? "Saving..." : "Confirm Payment"}</button>
                      <button className="db-button-secondary" type="button" onClick={() => { setPaymentFor(null); setPaymentReference(""); }}>Cancel</button>
                    </div>
                  ) : <button className="db-button-primary" type="button" onClick={() => setPaymentFor(enquiry.id)}>Confirm Registration Fee Payment</button>
                ) : null}

                {enquiry.status === "payment_pending" && ["verified", "waived"].includes(enquiry.registration_payment_status) ? <button className="db-button-primary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "issue_form")}>{isWorking ? "Preparing..." : "Issue Secure Form"}</button> : null}
                {enquiry.status === "form_issued" ? <button className="db-button-secondary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "issue_form")}>{isWorking ? "Preparing..." : "Resend Secure Form"}</button> : null}

                {enquiry.status === "submitted" ? (
                  decliningId === enquiry.id ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={{ display: "grid", gap: 7 }}><strong>Reason for declining</strong><textarea className="db-input" rows={3} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Explain the next step for the parent" /></label>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="db-button-primary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "review", { decision: "declined", decline_reason: declineReason })}>{isWorking ? "Saving..." : "Confirm Decline"}</button><button className="db-button-secondary" type="button" onClick={() => { setDecliningId(null); setDeclineReason(""); }}>Cancel</button></div>
                    </div>
                  ) : <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="db-button-primary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "review", { decision: "approved" })}>{isWorking ? "Saving..." : "Approve Enrolment"}</button><button className="db-button-secondary" type="button" onClick={() => setDecliningId(enquiry.id)}>Decline with Reason</button></div>
                ) : null}

                {enquiry.status === "approved" ? <div className="db-helper">Approved. Capture the learner in the existing learner flow, then allocate the class. This keeps learner billing and duplicate protection in their current safe workflow. <Link href={manualEnrolmentHref}>Open Add Learner</Link></div> : null}
                {enquiry.enrolment_source === "printed_blank_form" ? <Link className="db-button-secondary" href={`/enrolments/print/${enquiry.id}${schoolQuery}`}>Print / Reprint Blank Form</Link> : null}
                {["printed_blank_form", "paper_manual_capture"].includes(enquiry.enrolment_source || "") && !enquiry.paper_received_at ? <button className="db-button-secondary" type="button" disabled={isWorking} onClick={() => void runAction(enquiry, "mark_paper_received")}>Mark Paper Form Received</button> : null}
                {enquiry.paper_received_at ? <div className="db-helper">Paper received {formatDate(enquiry.paper_received_at)}. Capture the returned form before approval.</div> : null}
                {enquiry.status === "declined" && enquiry.decline_reason ? <div className="db-helper"><strong>Decline reason:</strong> {enquiry.decline_reason}</div> : null}
                {!['approved', 'withdrawn'].includes(enquiry.status) ? <button className="db-button-secondary" type="button" disabled={isWorking} onClick={() => { const reason = window.prompt("Reason for withdrawing this enrolment reference"); if (reason?.trim()) void runAction(enquiry, "withdraw", { withdraw_reason: reason.trim() }); }}>Withdraw enrolment</button> : null}
                {enquiry.status === "withdrawn" ? <div className="db-helper"><strong>Withdrawn:</strong> {enquiry.decline_reason || "No reason recorded."} The reference remains reserved for audit history and will not be reused.</div> : null}
                </div>
              </details>
            );
          })}
        </div> : null}
        {filteredEnquiries.length > 20 ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><button className="db-button-secondary" type="button" disabled={pipelinePage === 0} onClick={() => setPipelinePage((page) => Math.max(0, page - 1))}>Previous 20</button><span className="db-helper">Page {pipelinePage + 1} of {pipelinePageCount} · {filteredEnquiries.length} records</span><button className="db-button-secondary" type="button" disabled={pipelinePage + 1 >= pipelinePageCount} onClick={() => setPipelinePage((page) => Math.min(pipelinePageCount - 1, page + 1))}>Next 20</button></div> : null}
        </>}
      </section>
    </div>
  );
}

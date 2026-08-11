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
  const [visibleCount, setVisibleCount] = useState(20);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [formId, setFormId] = useState("");
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [share, setShare] = useState<ShareDetails | null>(null);

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
      setFormId((current) => current || loadedForms[0]?.id || "");
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
        body: JSON.stringify({ action: "create", school_id: schoolId, parent_name: parentName, parent_phone: parentPhone, form_id: formId }),
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
      await loadPage();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The enrolment enquiry could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(enquiry: Enquiry, action: "verify_registration_payment" | "issue_form" | "review", extras: Record<string, string> = {}) {
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

  const displayedEnquiries = enquiries.slice(0, visibleCount);

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
        <div>
          <h2 style={{ margin: 0 }}>New Enquiry</h2>
          <p className="db-helper" style={{ marginBottom: 0 }}>The form uses the single Registration Fee already set in School Fee Setup. No second fee is created here.</p>
        </div>
        {forms.length === 0 ? (
          <div className="db-soft-card" style={{ padding: 14 }}>
            Create at least one active enrolment form in <Link href={`/school-setup${schoolQuery}`}>School Setup</Link> before starting an enquiry.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={{ display: "grid", gap: 7 }}><strong>Parent or guardian name</strong><input className="db-input" value={parentName} onChange={(event) => setParentName(event.target.value)} placeholder="Parent or guardian name" /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Parent mobile number</strong><input className="db-input" inputMode="tel" value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} placeholder="e.g. 082 000 0000" /></label>
            <label style={{ display: "grid", gap: 7 }}><strong>Enrolment form</strong><select className="db-input" value={formId} onChange={(event) => setFormId(event.target.value)}>{forms.map((form) => <option value={form.id} key={form.id}>{form.form_name}</option>)}</select></label>
          </div>
        )}
        {forms.length > 0 ? <div><button className="db-button-primary" type="button" disabled={creating} onClick={() => void createEnquiry()}>{creating ? "Creating..." : "Create Registration Fee Request"}</button></div> : null}
      </section>

      <section className="db-card db-card-lavender" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><h2 style={{ margin: 0 }}>Enrolment Pipeline</h2><p className="db-helper" style={{ marginBottom: 0 }}>{schoolName} · {enquiries.length} total enquiries</p></div>
          <button className="db-button-secondary" type="button" onClick={() => void loadPage()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>

        {loading ? <p className="db-helper">Loading enrolments...</p> : null}
        {!loading && enquiries.length === 0 ? <div className="db-soft-card" style={{ padding: 16 }}>No enrolment enquiries have been created yet.</div> : null}
        {!loading ? <div style={{ display: "grid", gap: 12 }}>
          {displayedEnquiries.map((enquiry) => {
            const form = first(enquiry.school_enrolment_forms);
            const isWorking = workingId === enquiry.id;
            return (
              <article className="db-soft-card" key={enquiry.id} style={{ padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div><h3 style={{ margin: 0 }}>{enquiry.enquiry_reference}</h3><p className="db-helper" style={{ marginBottom: 0 }}>{enquiry.parent_name} · {enquiry.parent_phone} · {form?.form_name || "Enrolment Form"}</p></div>
                  <span className="db-status-pill">{statusLabel(enquiry.status)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  <div><strong>Registration Fee</strong><br />{formatMoney(enquiry.registration_fee_amount)}</div>
                  <div><strong>Payment status</strong><br />{enquiry.registration_payment_status === "verified" ? "Confirmed" : enquiry.registration_payment_status === "waived" ? "Waived" : "Awaiting confirmation"}</div>
                  <div><strong>Created</strong><br />{formatDate(enquiry.created_at)}</div>
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

                {enquiry.status === "approved" ? <div className="db-helper">Approved. Capture the learner in the existing learner flow, then allocate the class. This keeps learner billing and duplicate protection in their current safe workflow. <Link href={`/children${schoolQuery}`}>Open Learners</Link></div> : null}
                {enquiry.status === "declined" && enquiry.decline_reason ? <div className="db-helper"><strong>Decline reason:</strong> {enquiry.decline_reason}</div> : null}
              </article>
            );
          })}
        </div> : null}
        {visibleCount < enquiries.length ? <div><button className="db-button-secondary" type="button" onClick={() => setVisibleCount((count) => count + 20)}>Show Next 20</button></div> : null}
      </section>
    </div>
  );
}

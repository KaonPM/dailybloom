"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";

type RegistrationFee = {
  id: number;
  fee_name: string;
  amount: number;
} | null;

type Campaign = {
  id: string;
  school_year: number;
  registration_fee_amount: number;
  response_deadline: string | null;
  status: "open" | "closed";
  created_at: string;
};

type Reenrolment = {
  id: string;
  learner_name: string;
  classroom_name: string;
  reenrolment_reference: string;
  status: "awaiting_parent" | "submitted" | "approved" | "declined" | "withdrawn";
  registration_fee_amount: number;
  registration_payment_status: "not_required" | "pending" | "verified" | "waived";
  parent_portal_phone?: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  parent_notes?: string;
  decline_reason?: string | null;
};

type ReenrolmentData = {
  school: { id: number; school_name: string } | null;
  registration_fee: RegistrationFee;
  campaign: Campaign | null;
  campaigns: Campaign[];
  reenrolments: Reenrolment[];
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));

const statusLabel: Record<Reenrolment["status"], string> = {
  awaiting_parent: "Awaiting parent",
  submitted: "Submitted",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export default function ReEnrolmentsPage() {
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [data, setData] = useState<ReenrolmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [schoolYear, setSchoolYear] = useState(String(new Date().getFullYear() + 1));
  const [responseDeadline, setResponseDeadline] = useState("");
  const [applyRegistrationFee, setApplyRegistrationFee] = useState(false);
  const [selectedForReviewId, setSelectedForReviewId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const schoolQuery = useMemo(() => (isMaster && schoolId ? `?school=${schoolId}` : ""), [isMaster, schoolId]);

  const load = useCallback(async (id: number) => {
    const response = await authenticatedFetch(`/api/re-enrolments?school_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Re-enrolments could not be loaded.");
    setData(body as ReenrolmentData);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialise() {
      setLoading(true);
      setError("");
      try {
        const context = await resolveSchoolContext(searchParams.get("school"));
        if (!active) return;
        if (context.error) throw new Error(context.error);
        if (context.shouldReturnToMaster) {
          window.location.assign("/master?view=manage-schools");
          return;
        }
        if (!context.schoolId) throw new Error("Choose a school before opening re-enrolments.");
        setSchoolId(context.schoolId);
        setIsMaster(context.isMaster);
        await load(context.schoolId);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Re-enrolments could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialise();
    return () => {
      active = false;
    };
  }, [load, searchParams]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/re-enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_campaign",
          school_id: schoolId,
          school_year: Number(schoolYear),
          response_deadline: responseDeadline || null,
          apply_registration_fee: applyRegistrationFee,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The re-enrolment campaign could not be created.");
      setMessage(`Re-enrolment numbers were created for ${body.campaign?.learner_count || 0} current learners. You can now send the Parent Portal notification.`);
      setVisibleCount(20);
      await load(schoolId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The re-enrolment campaign could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function sendNotifications() {
    if (!schoolId || !data?.campaign) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/re-enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_notifications", school_id: schoolId, campaign_id: data.campaign.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Notifications could not be sent.");
      setMessage(body.delivery === "sent"
        ? `Parent Portal push notifications were sent for ${body.notified || 0} learners.`
        : "The campaign is ready in Parent Portal. A parent will see it the next time they open the app; push is sent only to devices with notifications enabled.");
      await load(schoolId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Notifications could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function reviewReenrolment(action: "approve_reenrolment" | "decline_reenrolment") {
    if (!schoolId || !selectedForReviewId) return;
    if (action === "decline_reenrolment" && !declineReason.trim()) {
      setError("Add a reason so the parent knows what needs attention.");
      return;
    }
    setReviewing(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/re-enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          school_id: schoolId,
          reenrolment_id: selectedForReviewId,
          decline_reason: declineReason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The re-enrolment could not be reviewed.");
      setMessage(body.message || "Re-enrolment updated.");
      setSelectedForReviewId(null);
      setDeclineReason("");
      await load(schoolId);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "The re-enrolment could not be reviewed.");
    } finally {
      setReviewing(false);
    }
  }

  const campaign = data?.campaign || null;
  const reenrolments = data?.reenrolments || [];
  const visibleReenrolments = reenrolments.slice(0, visibleCount);
  const awaitingCount = reenrolments.filter((record) => record.status === "awaiting_parent").length;
  const submittedCount = reenrolments.filter((record) => record.status === "submitted").length;
  const approvedCount = reenrolments.filter((record) => record.status === "approved").length;
  const selectedForReview = reenrolments.find((record) => record.id === selectedForReviewId) || null;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 18px 44px", display: "grid", gap: 18 }}>
      <section className="db-card db-card-blue" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div>
            <p className="db-eyebrow">School Management</p>
            <h1 className="db-page-title" style={{ marginBottom: 8 }}>Re-enrolments</h1>
            <p className="db-page-subtitle">Create one protected re-enrolment number per current learner. Parents confirm return details only from their own Parent Portal.</p>
          </div>
          <div className="db-page-actions">
            <Link className="db-main-pill db-main-pill-yellow" href={`/dashboard${schoolQuery}`}>Dashboard</Link>
            <Link className="db-button-secondary" href={`/school-setup${schoolQuery}`}>School Setup</Link>
          </div>
        </div>
      </section>

      {error ? <div className="db-error-banner" role="alert">{error}</div> : null}
      {message ? <div className="db-success-banner" role="status">{message}</div> : null}
      {loading ? <section className="db-card"><p className="db-helper">Loading re-enrolment information…</p></section> : null}

      {!loading && data && !campaign ? (
        <section className="db-card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Open a re-enrolment campaign</h2>
          <p className="db-helper" style={{ maxWidth: 820 }}>
            Existing learners stay in the system. This creates a unique school-and-year re-enrolment number for each learner, then lets the parent confirm their return in Parent Portal. It does not create another fee setup.
          </p>
          <form onSubmit={createCampaign} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 18, alignItems: "end" }}>
            <label>
              <span className="db-label">School year</span>
              <input className="db-input" value={schoolYear} inputMode="numeric" onChange={(event) => setSchoolYear(event.target.value)} required />
            </label>
            <label>
              <span className="db-label">Parent response deadline <em>(optional)</em></span>
              <input className="db-input" type="date" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} />
            </label>
            <label className="db-checkbox-row" style={{ gridColumn: "1 / -1" }}>
              <input type="checkbox" checked={applyRegistrationFee} disabled={!data.registration_fee} onChange={(event) => setApplyRegistrationFee(event.target.checked)} />
              <span>
                Apply the existing Registration Fee{data.registration_fee ? ` — ${money(data.registration_fee.amount)}` : ""}
                <small>{data.registration_fee ? "This copies today’s amount to the campaign. Payment is confirmed in the normal learner-fee process; it does not duplicate the Registration Fee setup." : "Set the Registration Fee first in School Fee Setup if it applies to re-enrolment."}</small>
              </span>
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <button className="db-button-primary" type="submit" disabled={saving}>{saving ? "Creating re-enrolment numbers…" : "Create Re-enrolment Campaign"}</button>
            </div>
          </form>
        </section>
      ) : null}

      {!loading && data && campaign ? (
        <>
          <section className="db-card db-card-lavender" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
              <div>
                <p className="db-eyebrow">Open campaign</p>
                <h2 style={{ margin: "4px 0 8px" }}>{campaign.school_year} re-enrolment</h2>
                <p className="db-helper">{data.school?.school_name || "School"} · {reenrolments.length} current learner{reenrolments.length === 1 ? "" : "s"} · {campaign.response_deadline ? `respond by ${campaign.response_deadline}` : "no response deadline"}</p>
              </div>
              <button className="db-button-primary" type="button" onClick={sendNotifications} disabled={sending || awaitingCount === 0}>
                {sending ? "Sending…" : `Send Parent Portal Push${awaitingCount ? ` (${awaitingCount})` : ""}`}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 18 }}>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Awaiting parent</strong><br />{awaitingCount} learner{awaitingCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Submitted</strong><br />{submittedCount} learner{submittedCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Approved</strong><br />{approvedCount} learner{approvedCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Registration Fee</strong><br />{campaign.registration_fee_amount > 0 ? `${money(campaign.registration_fee_amount)} selected` : "Not applied"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Parent Portal number</strong><br />Confirmed by the parent for school review</div>
            </div>
          </section>

          <section className="db-card" style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>Current learner references</h2>
            <p className="db-helper">The first 20 learners are shown. Parent mobile numbers remain private and are not displayed on this list.</p>
            {visibleReenrolments.length === 0 ? <p className="db-helper">No current learners were found when this campaign was created.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ textAlign: "left", padding: 12 }}>Learner</th><th style={{ textAlign: "left", padding: 12 }}>Class</th><th style={{ textAlign: "left", padding: 12 }}>Reference</th><th style={{ textAlign: "left", padding: 12 }}>Parent response</th><th style={{ textAlign: "left", padding: 12 }}>Registration Fee</th><th style={{ textAlign: "left", padding: 12 }}>Push</th><th style={{ textAlign: "left", padding: 12 }}>Review</th></tr></thead>
                  <tbody>{visibleReenrolments.map((record) => (
                    <tr key={record.id} style={{ borderTop: "1px solid var(--db-border, #eadfd8)" }}>
                      <td style={{ padding: 12 }}>{record.learner_name}</td>
                      <td style={{ padding: 12 }}>{record.classroom_name}</td>
                      <td style={{ padding: 12 }}><strong>{record.reenrolment_reference}</strong></td>
                      <td style={{ padding: 12 }}>{statusLabel[record.status]}</td>
                      <td style={{ padding: 12 }}>{record.registration_fee_amount > 0 ? `${money(record.registration_fee_amount)} · ${record.registration_payment_status}` : "Not required"}</td>
                      <td style={{ padding: 12 }}>{record.notification_error ? "Could not send" : record.notification_sent_at ? "Sent" : "Not sent"}</td>
                      <td style={{ padding: 12 }}>
                        {record.status === "submitted" ? (
                          <button className="db-button-secondary" type="button" onClick={() => { setSelectedForReviewId(record.id); setDeclineReason(""); }}>Review</button>
                        ) : record.status === "declined" ? "Reason sent" : record.status === "approved" ? "Approved" : "Awaiting parent"}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {visibleCount < reenrolments.length ? <button className="db-button-secondary" type="button" style={{ marginTop: 16 }} onClick={() => setVisibleCount((count) => count + 20)}>Show next 20</button> : null}

            {selectedForReview ? (
              <section className="db-soft-card" style={{ padding: 18, marginTop: 20 }} aria-label="Review re-enrolment">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <p className="db-eyebrow">Parent submission</p>
                    <h3 style={{ margin: "4px 0 6px" }}>{selectedForReview.learner_name}</h3>
                    <p className="db-helper" style={{ margin: 0 }}>{selectedForReview.classroom_name} · {selectedForReview.reenrolment_reference}</p>
                  </div>
                  <button className="db-button-secondary" type="button" onClick={() => { setSelectedForReviewId(null); setDeclineReason(""); }}>Close review</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginTop: 16 }}>
                  <div>
                    <strong>New Parent Portal mobile number</strong>
                    <p className="db-helper" style={{ margin: "6px 0 0" }}>{selectedForReview.parent_portal_phone || "No number supplied"}</p>
                  </div>
                  <div>
                    <strong>Parent notes</strong>
                    <p className="db-helper" style={{ margin: "6px 0 0" }}>{selectedForReview.parent_notes || "No additional notes."}</p>
                  </div>
                </div>
                <label style={{ display: "block", marginTop: 16 }}>
                  <span className="db-label">If declining, explain what the parent needs to correct</span>
                  <textarea className="db-input" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={3} placeholder="For example: Please upload the updated immunisation card before re-enrolment can be approved." />
                </label>
                <div className="db-page-actions" style={{ marginTop: 16 }}>
                  <button className="db-button-primary" type="button" disabled={reviewing} onClick={() => void reviewReenrolment("approve_reenrolment")}>{reviewing ? "Saving…" : "Approve Re-enrolment"}</button>
                  <button className="db-button-secondary" type="button" disabled={reviewing || !declineReason.trim()} onClick={() => void reviewReenrolment("decline_reenrolment")}>Decline & Ask Parent to Update</button>
                </div>
              </section>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

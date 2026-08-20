"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  source_form_id?: string | null;
  form_snapshot?: Record<string, unknown>;
  rollover_applied_at?: string | null;
};

type Reenrolment = {
  id: string;
  learner_id: string;
  learner_name: string;
  classroom_name: string;
  reenrolment_reference: string;
  status: "awaiting_parent" | "submitted" | "approved" | "declined" | "withdrawn" | "no_response" | "school_leaver" | "not_returning";
  registration_fee_amount: number;
  registration_payment_status: "not_required" | "pending" | "verified" | "waived";
  parent_portal_phone?: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  parent_notes?: string;
  decline_reason?: string | null;
  learner_details?: Record<string, string> | null;
  guardian_details?: Record<string, string> | null;
  medical_details?: Record<string, string> | null;
  uploaded_documents?: Record<string, { name?: string; path?: string }>;
  acknowledged_document_ids?: string[];
  acknowledged_requirement_ids?: string[];
  renewal_snapshot?: {
    learner_details?: Record<string, string | null>;
    guardian_details?: Record<string, string | null>;
    medical_details?: Record<string, string | null>;
    existing_documents?: Array<{ id: string | number; name: string; file_name?: string | null; uploaded_at?: string | null }>;
    missing_documents?: Array<{ id: string; name: string }>;
    missing_requirements?: Array<{ id: string; name: string; quantity?: number }>;
  } | null;
  current_classroom_id?: number | null;
  next_classroom_id?: number | null;
  classroom_applied_at?: string | null;
};

type ReenrolmentData = {
  school: { id: number; school_name: string } | null;
  registration_fee: RegistrationFee;
  campaign: Campaign | null;
  campaigns: Campaign[];
  reenrolments: Reenrolment[];
  enrolment_forms: Array<{ id: string; form_name: string; form_type: string; instructions?: string | null }>;
  classrooms: Array<{ id: number; classroom_name: string }>;
  approved_enrolments: Array<{id:string;learner_id:string;enquiry_reference:string;parent_name:string;academic_year:number;submitted_data?:Record<string,unknown>|null;learner?:{name?:string|null;legal_name?:string|null;guardian_name?:string|null;class?:string|null;classroom_id?:number|null}|null;placement?:{classroom_id:number|null;classrooms?:{classroom_name?:string}|Array<{classroom_name?:string}>}|null}>;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));

const statusLabel: Record<Reenrolment["status"], string> = {
  awaiting_parent: "Awaiting parent",
  submitted: "Submitted",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  no_response: "No response / overdue",
  school_leaver: "Grade R completed / school leaver",
  not_returning: "Not returning",
};

export default function ReEnrolmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [data, setData] = useState<ReenrolmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [schoolYear, setSchoolYear] = useState(String(new Date().getFullYear() + 1));
  const [responseDeadline, setResponseDeadline] = useState("");
  const [applyRegistrationFee, setApplyRegistrationFee] = useState(false);
  const [sourceFormId, setSourceFormId] = useState("");
  const [allocationSelections, setAllocationSelections] = useState<Record<string, string>>({});
  const [selectedForReviewId, setSelectedForReviewId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);
  const [selectedApprovedId, setSelectedApprovedId] = useState<string | null>(null);

  const schoolQuery = useMemo(() => (isMaster && schoolId ? `?school=${schoolId}` : ""), [isMaster, schoolId]);

  const load = useCallback(async (id: number) => {
    const response = await authenticatedFetch(`/api/re-enrolments?school_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Re-enrolments could not be loaded.");
    const nextData = body as ReenrolmentData;
    setData(nextData);
    setSourceFormId((current) => current || nextData.enrolment_forms?.[0]?.id || "");
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
          router.replace("/master?view=manage-schools");
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
  }, [load, router, searchParams]);

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
          source_form_id: sourceFormId || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The re-enrolment campaign could not be created.");
      setMessage(`Re-enrolment numbers were created for ${body.campaign?.learner_count || 0} current learners. You can now send the Parent Portal notification.`);
      setVisibleCount(10);
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
      const gradeRNote = body.grade_r_excluded ? ` ${body.grade_r_excluded} Grade R learner${body.grade_r_excluded === 1 ? " was" : "s were"} excluded from re-enrolment.` : "";
      setMessage(body.delivery === "sent"
        ? `Parent Portal push notifications were sent for ${body.notified || 0} learners.${gradeRNote}`
        : `The campaign is ready in Parent Portal. A parent will see it the next time they open the app; push is sent only to devices with notifications enabled.${gradeRNote}`);
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

  async function assignClassroom(reenrolmentId: string) {
    const classroomId = allocationSelections[`reenrolment:${reenrolmentId}`];
    if (!schoolId || !classroomId) { setError("Select the learner's next-year classroom."); return; }
    setReviewing(true); setError(""); setMessage("");
    try {
      const response = await authenticatedFetch("/api/re-enrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign_classroom", school_id: schoolId, reenrolment_id: reenrolmentId, next_classroom_id: Number(classroomId) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "The classroom could not be allocated.");
      setMessage(body.message); setAllocationSelections((current) => ({ ...current, [`reenrolment:${reenrolmentId}`]: "" })); await load(schoolId);
    } catch (allocationError) { setError(allocationError instanceof Error ? allocationError.message : "The classroom could not be allocated."); }
    finally { setReviewing(false); }
  }
  async function updateReenrolmentStatus(reenrolmentId:string,action:"mark_school_leaver"|"mark_no_response"){
    if(!schoolId)return;setReviewing(true);setError("");
    try{const response=await authenticatedFetch("/api/re-enrolments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,school_id:schoolId,reenrolment_id:reenrolmentId})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Status could not be updated.");setMessage(action==="mark_school_leaver"?"Learner marked as a Grade R-completed / expected school leaver.":"Learner marked for no-response follow-up.");await load(schoolId)}catch(statusError){setError(statusError instanceof Error?statusError.message:"Status could not be updated.")}finally{setReviewing(false)}
  }
  async function allocateApprovedEnrolment(enquiryId:string){const classroomId=allocationSelections[`approved:${enquiryId}`];if(!schoolId||!classroomId){setError("Select a classroom first.");return}setReviewing(true);const response=await authenticatedFetch("/api/enrolments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"assign_waiting_classroom",school_id:schoolId,enquiry_id:enquiryId,classroom_id:Number(classroomId)})});const body=await response.json();if(!response.ok)setError(body.error||"Classroom allocation failed.");else{setMessage("Approved learner classroom allocated.");setAllocationSelections((current)=>({...current,[`approved:${enquiryId}`]:""}));await load(schoolId)}setReviewing(false)}

  async function applyClassroomRollover() {
    if (!schoolId || !data?.campaign) return;
    setRollingOver(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/re-enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_classroom_rollover", school_id: schoolId, campaign_id: data.campaign.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The new-year classroom rollover could not be applied.");
      setMessage(body.message || "Approved learners were moved to their next-year classrooms.");
      await load(schoolId);
    } catch (rolloverError) {
      setError(rolloverError instanceof Error ? rolloverError.message : "The new-year classroom rollover could not be applied.");
    } finally {
      setRollingOver(false);
    }
  }

  const campaign = data?.campaign || null;
  const reenrolments = data?.reenrolments || [];
  const visibleReenrolments = reenrolments.slice(0, visibleCount);
  const awaitingCount = reenrolments.filter((record) => record.status === "awaiting_parent").length;
  const submittedCount = reenrolments.filter((record) => record.status === "submitted").length;
  const approvedCount = reenrolments.filter((record) => record.status === "approved").length;
  const selectedForReview = reenrolments.find((record) => record.id === selectedForReviewId) || null;
  const selectedApproved = data?.approved_enrolments?.find((record) => record.id === selectedApprovedId) || null;
  const rolloverAvailable = campaign ? Date.now() >= new Date(`${campaign.school_year}-01-01T00:00:00+02:00`).getTime() : false;

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

      {!loading && data && (data.approved_enrolments.some((item) => !item.placement?.classroom_id) || reenrolments.some((item) => item.status === "approved" && !item.next_classroom_id)) ? (
        <section
          id="awaiting-classroom-allocation"
          className="db-card db-card-green"
          style={{ padding: 24, scrollMarginTop: 24 }}
        >
          <h2>Approved Enrolments — Awaiting Classroom Allocation</h2>
          <p className="db-helper">Approved learners remain available in Parent Portal while next-year classrooms are being prepared.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {data.approved_enrolments.filter((item) => !item.placement?.classroom_id).map((item) => {
              const selectionKey = `approved:${item.id}`;
              const selectedClassroom = allocationSelections[selectionKey] || "";
              return (
                <div className="db-soft-card" key={item.id} style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(210px, 1.1fr) minmax(150px, .8fr) minmax(330px, 1.5fr)", gap: 12, alignItems: "center" }}>
                  <div><strong>{item.learner?.name || item.learner?.legal_name || "Approved learner"}</strong><small className="db-helper" style={{ display: "block" }}>{item.parent_name || item.learner?.guardian_name || "Parent not recorded"}</small><small className="db-helper" style={{ display: "block" }}>{item.enquiry_reference} · {item.academic_year}</small></div>
                  <div><small className="db-helper" style={{ display: "block" }}>Current classroom</small>{item.learner?.class || "Unassigned"}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select className="db-input" aria-label={`Classroom for ${item.enquiry_reference}`} value={selectedClassroom} onChange={(event) => setAllocationSelections((current) => ({ ...current, [selectionKey]: event.target.value }))}>
                      <option value="">Select classroom</option>
                      {data.classrooms.map((room) => <option key={room.id} value={room.id}>{room.classroom_name}</option>)}
                    </select>
                    <button className="db-button-primary" disabled={!selectedClassroom || reviewing} onClick={() => void allocateApprovedEnrolment(item.id)}>Allocate</button>
                    <button className="db-button-secondary" type="button" onClick={() => setSelectedApprovedId(item.id)}>View form</button>
                    <Link className="db-button-secondary" href={`/children/${item.learner_id}${schoolQuery}`}>View learner</Link>
                    <Link className="db-button-secondary" href={isMaster && schoolId ? `/children?school=${schoolId}&edit=${item.learner_id}` : `/children?edit=${item.learner_id}`}>Edit learner</Link>
                  </div>
                </div>
              );
            })}
            {reenrolments.filter((item) => item.status === "approved" && !item.next_classroom_id).map((item) => {
              const selectionKey = `reenrolment:${item.id}`;
              const selectedClassroom = allocationSelections[selectionKey] || "";
              return <div className="db-soft-card" key={item.id} style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(210px, 1.1fr) minmax(150px, .8fr) minmax(330px, 1.5fr)", gap: 12, alignItems: "center" }}><div><strong>{item.learner_name}</strong><small className="db-helper" style={{ display: "block" }}>{item.reenrolment_reference} · Re-enrolment</small></div><div><small className="db-helper" style={{ display: "block" }}>Current classroom</small>{item.classroom_name || "Unassigned"}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select className="db-input" aria-label={`Next-year classroom for ${item.learner_name}`} value={selectedClassroom} onChange={(event) => setAllocationSelections((current) => ({ ...current, [selectionKey]: event.target.value }))}><option value="">Select next-year classroom</option>{data.classrooms.map((room) => <option key={room.id} value={room.id}>{room.classroom_name}</option>)}</select><button className="db-button-primary" disabled={!selectedClassroom || reviewing} onClick={() => void assignClassroom(item.id)}>Allocate</button><button className="db-button-secondary" type="button" onClick={() => { setSelectedForReviewId(item.id); setDeclineReason(""); }}>View form</button><Link className="db-button-secondary" href={`/children/${item.learner_id}${schoolQuery}`}>View learner</Link><Link className="db-button-secondary" href={isMaster && schoolId ? `/children?school=${schoolId}&edit=${item.learner_id}` : `/children?edit=${item.learner_id}`}>Edit learner</Link></div></div>;
            })}
          </div>
          {selectedApproved ? <div className="db-soft-card" style={{ padding: 16, marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}><div><p className="db-eyebrow">Approved enrolment form</p><h3 style={{ margin: "4px 0" }}>{selectedApproved.learner?.name || selectedApproved.learner?.legal_name || selectedApproved.enquiry_reference}</h3><p className="db-helper" style={{ margin: 0 }}>{selectedApproved.enquiry_reference}</p></div><button className="db-button-secondary" type="button" onClick={() => setSelectedApprovedId(null)}>Close</button></div><SubmittedFormSummary data={selectedApproved.submitted_data} /></div> : null}
        </section>
      ) : null}

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
            <label style={{ gridColumn: "1 / -1" }}>
              <span className="db-label">Digital re-enrolment form</span>
              <select className="db-input" value={sourceFormId} onChange={(event) => setSourceFormId(event.target.value)}>
                <option value="">Standard DailyBloom digital renewal form</option>
                {data.enrolment_forms.map((form) => <option key={form.id} value={form.id}>{form.form_name}</option>)}
              </select>
              <small className="db-helper">The selected form and requirements are snapshotted for this campaign.</small>
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
              <button className="db-button-secondary" type="button" onClick={() => void applyClassroomRollover()} disabled={rollingOver || !rolloverAvailable || Boolean(campaign.rollover_applied_at) || approvedCount === 0}>
                {campaign.rollover_applied_at ? "New-year rollover completed" : rollingOver ? "Applying rollover…" : `Apply ${campaign.school_year} Classroom Rollover`}
              </button>
            </div>
            {!campaign.rollover_applied_at && !rolloverAvailable ? <p className="db-helper">The classroom rollover becomes available on 1 January {campaign.school_year}. Until then, learners remain in their current classes.</p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 18 }}>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Awaiting parent</strong><br />{awaitingCount} learner{awaitingCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Submitted</strong><br />{submittedCount} learner{submittedCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Approved</strong><br />{approvedCount} learner{approvedCount === 1 ? "" : "s"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Registration Fee</strong><br />{campaign.registration_fee_amount > 0 ? `${money(campaign.registration_fee_amount)} selected` : "Not applied"}</div>
              <div className="db-soft-card" style={{ padding: 14 }}><strong>Parent Portal number</strong><br />Confirmed by the parent for school review</div>
            </div>
            <p className="db-helper" style={{ marginBottom: 0 }}>Grade R-completed learners are retained in school history but excluded from classroom rollover. Parents who have not responded remain visible for follow-up and may still respond while this campaign is open.</p>
          </section>

          <section className="db-card" style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>Current learner references</h2>
            <p className="db-helper">The first 10 learners are shown. Parent mobile numbers remain private and are not displayed on this list.</p>
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
                        ) : record.status === "declined" ? "Returned to parent for updates" : record.status === "approved" ? (
                          record.next_classroom_id ? <span>Classroom planned</span> : <span>Awaiting classroom allocation above</span>
                        ) : record.status === "school_leaver" ? "Expected school leaver" : record.status === "no_response" ? "Follow up required" : record.status === "awaiting_parent" ? <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="db-button-secondary" type="button" disabled={reviewing} onClick={()=>void updateReenrolmentStatus(record.id,"mark_no_response")}>Mark No Response</button><button className="db-button-secondary" type="button" disabled={reviewing} onClick={()=>{if(window.confirm(`Mark ${record.learner_name} as Grade R completed / expected school leaver?`))void updateReenrolmentStatus(record.id,"mark_school_leaver")}}>Grade R Completed</button></div> : "Parent response recorded"}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {visibleCount < reenrolments.length ? <button className="db-button-secondary" type="button" style={{ marginTop: 16 }} onClick={() => setVisibleCount((count) => count + 10)}>Show next 10</button> : null}

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
                  <div><strong>Replacement documents uploaded</strong><p className="db-helper" style={{ margin: "6px 0 0" }}>{Object.keys(selectedForReview.uploaded_documents || {}).length} of {selectedForReview.renewal_snapshot?.missing_documents?.length || 0}</p></div>
                  <div><strong>Learner requirements acknowledged</strong><p className="db-helper" style={{ margin: "6px 0 0" }}>{selectedForReview.acknowledged_requirement_ids?.length || 0} of {selectedForReview.renewal_snapshot?.missing_requirements?.length || 0}</p></div>
                </div>
                <ComparisonGroup title="Learner changes" current={selectedForReview.renewal_snapshot?.learner_details} proposed={selectedForReview.learner_details} />
                <ComparisonGroup title="Parent / guardian changes" current={selectedForReview.renewal_snapshot?.guardian_details} proposed={selectedForReview.guardian_details} />
                <ComparisonGroup title="Medical changes" current={selectedForReview.renewal_snapshot?.medical_details} proposed={selectedForReview.medical_details} />
                <div className="db-soft-card" style={{ padding: 14, marginTop: 16 }}>
                  <strong>Digital form details</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 10 }}>
                    <p className="db-helper" style={{ margin: 0 }}><strong>Learner:</strong> {selectedForReview.learner_details?.legal_name || selectedForReview.learner_name}</p>
                    <p className="db-helper" style={{ margin: 0 }}><strong>Guardian:</strong> {selectedForReview.guardian_details?.name || "Not supplied"}</p>
                    <p className="db-helper" style={{ margin: 0 }}><strong>Guardian phone:</strong> {selectedForReview.guardian_details?.phone || "Not supplied"}</p>
                    <p className="db-helper" style={{ margin: 0 }}><strong>Allergies:</strong> {selectedForReview.medical_details?.allergies || "None recorded"}</p>
                  </div>
                </div>
                {selectedForReview.status === "submitted" ? <><label style={{ display: "block", marginTop: 16 }}><span className="db-label">If returning the form, explain what the parent needs to correct</span><textarea className="db-input" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={3} placeholder="For example: Please upload the updated immunisation card before re-enrolment can be approved." /></label><div className="db-page-actions" style={{ marginTop: 16 }}><button className="db-button-primary" type="button" disabled={reviewing} onClick={() => void reviewReenrolment("approve_reenrolment")}>{reviewing ? "Saving…" : "Approve — Awaiting Class Allocation"}</button><button className="db-button-secondary" type="button" disabled={reviewing || !declineReason.trim()} onClick={() => void reviewReenrolment("decline_reenrolment")}>Return to Parent for Updates</button></div></> : <div className="db-success-banner" style={{ marginTop: 16 }}>This approved submission is locked as a historical snapshot. Edit the live learner profile separately if a later correction is required.</div>}
              </section>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

function readableFieldName(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return Array.isArray(value) ? value.map(displayValue).join(", ") : "Recorded in form";
  return String(value);
}

function ComparisonGroup({ title, current, proposed }: { title: string; current?: Record<string, string | null> | null; proposed?: Record<string, string> | null }) {
  const keys = [...new Set([...Object.keys(current || {}), ...Object.keys(proposed || {})])];
  const changed = keys.filter((key) => displayValue(current?.[key]) !== displayValue(proposed?.[key]));
  if (!keys.length) return null;
  return <details className="db-soft-card" style={{ padding: 14, marginTop: 12 }} open={changed.length > 0}><summary><strong>{title}</strong> · {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes"}</summary><div style={{ display: "grid", gap: 8, marginTop: 12 }}>{keys.map((key) => { const isChanged = changed.includes(key); return <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(150px, .7fr) repeat(2, minmax(180px, 1fr))", gap: 10, padding: 8, borderRadius: 10, background: isChanged ? "#fff7df" : "transparent" }}><strong>{readableFieldName(key)}</strong><span><small className="db-helper" style={{ display: "block" }}>Current</small>{displayValue(current?.[key])}</span><span><small className="db-helper" style={{ display: "block" }}>Parent update</small>{displayValue(proposed?.[key])}</span></div>; })}</div></details>;
}

function SubmittedFormSummary({ data }: { data?: Record<string, unknown> | null }) {
  if (!data) return <p className="db-helper">No submitted form snapshot is available.</p>;
  const sections = Object.entries(data).filter(([key]) => !["uploaded_documents", "consent_responses", "terms"].includes(key));
  const uploads = data.uploaded_documents && typeof data.uploaded_documents === "object" && !Array.isArray(data.uploaded_documents) ? data.uploaded_documents as Record<string, unknown> : {};
  return <div style={{ display: "grid", gap: 12, marginTop: 14 }}>{sections.map(([key, value]) => <div key={key}><strong>{readableFieldName(key)}</strong>{value && typeof value === "object" && !Array.isArray(value) ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginTop: 6 }}>{Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => <p className="db-helper" style={{ margin: 0 }} key={childKey}><strong>{readableFieldName(childKey)}:</strong> {displayValue(childValue)}</p>)}</div> : <p className="db-helper" style={{ margin: "4px 0 0" }}>{displayValue(value)}</p>}</div>)}{Object.keys(uploads).length ? <div><strong>Uploaded documents</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{Object.keys(uploads).join(", ")}</p></div> : null}</div>;
}

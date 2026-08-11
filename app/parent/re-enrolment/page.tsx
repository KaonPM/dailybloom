"use client";

import { useCallback, useEffect, useState } from "react";

import ParentPageActions from "../components/ParentPageActions";

type Reenrolment = {
  id: string;
  reenrolment_reference: string;
  parent_portal_phone: string | null;
  registration_fee_amount: number;
  registration_payment_status: "not_required" | "pending" | "verified" | "waived";
  status: "awaiting_parent" | "submitted" | "approved" | "declined";
  submitted_data: { parent_notes?: string } | null;
  decline_reason?: string | null;
  school_year: number;
  response_deadline: string | null;
  learner_name: string;
  classroom_name: string;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));

const readableStatus: Record<Reenrolment["status"], string> = {
  awaiting_parent: "Action needed",
  submitted: "Submitted for review",
  approved: "Approved",
  declined: "School follow-up needed",
};

export default function ParentReenrolmentPage() {
  const [reenrolments, setReenrolments] = useState<Reenrolment[]>([]);
  const [parentPhone, setParentPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneByRecord, setPhoneByRecord] = useState<Record<string, string>>({});
  const [notesByRecord, setNotesByRecord] = useState<Record<string, string>>({});
  const [confirmedByRecord, setConfirmedByRecord] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/parent-reenrolments", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Re-enrolment could not be loaded.");
    const records = (body.reenrolments || []) as Reenrolment[];
    setReenrolments(records);
    setParentPhone(String(body.parent_phone || ""));
    setPhoneByRecord(
      Object.fromEntries(records.map((record) => [record.id, record.parent_portal_phone || body.parent_phone || ""])),
    );
    setNotesByRecord(Object.fromEntries(records.map((record) => [record.id, record.submitted_data?.parent_notes || ""])));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await load();
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Re-enrolment could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  async function submit(record: Reenrolment) {
    setSavingId(record.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/parent-reenrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          reenrolment_id: record.id,
          parent_portal_phone: phoneByRecord[record.id],
          parent_notes: notesByRecord[record.id],
          confirm_return: confirmedByRecord[record.id] === true,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your re-enrolment could not be submitted.");
      setMessage(`${record.learner_name}'s re-enrolment has been sent to the school for review.`);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your re-enrolment could not be submitted.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 18px 44px", display: "grid", gap: 18 }}>
      <ParentPageActions />

      <section className="db-card db-card-blue" style={{ padding: 24 }}>
        <p className="db-eyebrow">🔄 Parent Portal</p>
        <h1 className="db-page-title" style={{ marginBottom: 8 }}>Re-enrolment</h1>
        <p className="db-page-subtitle" style={{ maxWidth: 720 }}>
          Confirm whether your learner will return and choose one mobile number for Parent Portal access.
        </p>
      </section>

      {error ? <div className="db-error-banner" role="alert">{error}</div> : null}
      {message ? <div className="db-success-banner" role="status">{message}</div> : null}

      {loading ? <section className="db-card"><p className="db-helper">Loading re-enrolment information…</p></section> : null}
      {!loading && reenrolments.length === 0 ? (
        <section className="db-card db-soft-card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>No re-enrolment is open</h2>
          <p className="db-helper">Your school will show re-enrolment here when it is ready for your learner.</p>
        </section>
      ) : null}

      {!loading && reenrolments.map((record) => (
        <section className="db-card" key={record.id} style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>{record.learner_name}</h2>
              <p className="db-helper" style={{ marginTop: 6 }}>{record.classroom_name} · {record.school_year} re-enrolment</p>
            </div>
            <span className="db-status-pill">{readableStatus[record.status]}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "18px 0" }}>
            <div className="db-soft-card" style={{ padding: 14 }}><strong>Re-enrolment number</strong><br />{record.reenrolment_reference}</div>
            <div className="db-soft-card" style={{ padding: 14 }}><strong>Response deadline</strong><br />{record.response_deadline || "Not set"}</div>
            <div className="db-soft-card" style={{ padding: 14 }}>
              <strong>Registration Fee</strong><br />
              {record.registration_fee_amount > 0
                ? `${money(record.registration_fee_amount)} · ${record.registration_payment_status === "pending" ? "school confirmation required" : record.registration_payment_status}`
                : "Not selected"}
            </div>
          </div>

          {record.status === "awaiting_parent" || record.status === "declined" ? (
            <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
              {record.status === "declined" ? (
                <div className="db-error-banner" role="alert">
                  <strong>The school needs an update before approval.</strong>
                  <br />{record.decline_reason || "Please review the details and submit the form again."}
                </div>
              ) : null}
              <label>
                <span className="db-label">Parent Portal mobile number</span>
                <input
                  className="db-input"
                  type="tel"
                  value={phoneByRecord[record.id] || parentPhone}
                  placeholder="e.g. 082 123 4567"
                  onChange={(event) => setPhoneByRecord((current) => ({ ...current, [record.id]: event.target.value }))}
                  required
                />
                <small className="db-helper">Choose one South African mobile number. The school will review this before changing any existing Parent Portal access.</small>
              </label>
              <label>
                <span className="db-label">Notes for the school <em>(optional)</em></span>
                <textarea
                  className="db-input"
                  value={notesByRecord[record.id] || ""}
                  maxLength={800}
                  rows={4}
                  onChange={(event) => setNotesByRecord((current) => ({ ...current, [record.id]: event.target.value }))}
                  placeholder="Share anything the school should know for the new year."
                />
              </label>
              <label className="db-checkbox-row">
                <input type="checkbox" checked={confirmedByRecord[record.id] || false} onChange={(event) => setConfirmedByRecord((current) => ({ ...current, [record.id]: event.target.checked }))} />
                <span>I confirm that {record.learner_name} will return for {record.school_year}.</span>
              </label>
              <button className="db-button-primary" type="button" onClick={() => void submit(record)} disabled={savingId === record.id}>
                {savingId === record.id ? "Submitting…" : record.status === "declined" ? "Update and Resubmit" : "Submit Re-enrolment"}
              </button>
            </div>
          ) : (
            <div className="db-success-banner">Thank you. The school has received this re-enrolment and will update you if anything else is needed.</div>
          )}
        </section>
      ))}
    </main>
  );
}

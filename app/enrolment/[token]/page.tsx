"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PublicForm = {
  form_name?: string;
  form_type?: string;
  instructions?: string;
};

type FormInfo = {
  reference: string;
  parent_name: string;
  status: string;
  school_name: string;
  form: PublicForm | null;
};

const emptyFields = {
  learner_first_name: "",
  learner_surname: "",
  date_of_birth: "",
  gender: "",
  learner_id_or_birth_certificate: "",
  guardian_name: "",
  guardian_relationship: "",
  guardian_phone: "",
  parent_portal_phone: "",
  guardian_email: "",
  home_address: "",
  medical_notes: "",
};

export default function SecureEnrolmentFormPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");

  const loadForm = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/enrolment-form?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 && body.requires_access_code) {
        setNeedsAccessCode(true);
        return;
      }
      if (!response.ok) {
        throw new Error(body.error || "This enrolment link is not available.");
      }
      setNeedsAccessCode(false);
      setInfo(body as FormInfo);
      setFields((current) => ({ ...current, guardian_name: body.parent_name || "" }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This enrolment link is not available.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  async function requestAccessCode() {
    setAccessLoading(true);
    setAccessError("");
    setAccessMessage("");
    try {
      const response = await fetch("/api/enrolment-form/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "We could not send a verification code right now.");
      }
      setCodeRequested(true);
      setAccessMessage(
        "A verification code has been sent to the WhatsApp number shared with the school. It expires in 10 minutes.",
      );
    } catch (requestError) {
      setAccessError(
        requestError instanceof Error
          ? requestError.message
          : "We could not send a verification code right now.",
      );
    } finally {
      setAccessLoading(false);
    }
  }

  async function verifyAccessCode() {
    setAccessLoading(true);
    setAccessError("");
    try {
      const response = await fetch("/api/enrolment-form/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: accessCode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "The verification code could not be confirmed.");
      }
      setAccessCode("");
      setAccessMessage("");
      await loadForm();
    } catch (verifyError) {
      setAccessError(
        verifyError instanceof Error
          ? verifyError.message
          : "The verification code could not be confirmed.",
      );
    } finally {
      setAccessLoading(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/enrolment-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...fields }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Your enrolment form could not be submitted.");
      }
      setSuccess(
        "Thank you. Your form has been submitted securely. The school will review it and contact you about the next step.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your enrolment form could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function setField(name: keyof typeof emptyFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  if (loading) {
    return (
      <main className="db-public-page">
        <section className="db-card db-card-blue">
          <p>Loading your secure enrolment form...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="db-public-page">
      <section className="db-card db-card-blue" style={{ display: "grid", gap: 12 }}>
        <div className="db-eyebrow">DAILYBLOOM · SECURE ENROLMENT</div>
        <h1 className="db-page-title" style={{ margin: 0 }}>
          {info?.school_name || "Secure Enrolment"}
        </h1>
        <p className="db-page-subtitle" style={{ margin: 0 }}>
          {info?.form?.form_name || "Enrolment Form"}
          {info?.reference ? ` · Reference ${info.reference}` : ""}
        </p>
      </section>

      {error ? (
        <section className="db-card db-card-yellow" role="alert" style={{ display: "grid", gap: 8 }}>
          <div className="db-eyebrow">SECURE ENROLMENT LINK</div>
          <h2 style={{ margin: 0 }}>We could not open this enrolment link</h2>
          <p style={{ color: "#a33d45", margin: 0 }}>{error}</p>
          <p className="db-helper" style={{ margin: 0 }}>
            For privacy, secure links expire after 24 hours and cannot be reused after a form is submitted. Please contact the school that sent the link to request a fresh link.
          </p>
        </section>
      ) : null}
      {success ? (
        <section className="db-card db-card-green" role="status">
          <h2 style={{ marginTop: 0 }}>Form submitted</h2>
          <p style={{ marginBottom: 0 }}>{success}</p>
        </section>
      ) : null}

      {needsAccessCode && !success ? (
        <section className="db-card" style={{ display: "grid", gap: 16, maxWidth: 640 }}>
          <div>
            <h2 style={{ margin: 0 }}>Verify your mobile number</h2>
            <p className="db-helper" style={{ marginBottom: 0 }}>
              This private form link is valid for 24 hours. Request a WhatsApp code to the number shared with the school before opening the form.
            </p>
          </div>
          {accessError ? <p role="alert" style={{ color: "#a33d45", margin: 0 }}>{accessError}</p> : null}
          {accessMessage ? <p role="status" style={{ color: "#2f7c4d", margin: 0 }}>{accessMessage}</p> : null}
          {codeRequested ? (
            <label style={{ display: "grid", gap: 7 }}>
              <strong>WhatsApp verification code</strong>
              <input
                className="db-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
              />
            </label>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button className="db-button-primary" type="button" disabled={accessLoading} onClick={() => void requestAccessCode()}>
              {accessLoading ? "Sending..." : codeRequested ? "Resend code" : "Send WhatsApp code"}
            </button>
            {codeRequested ? (
              <button className="db-button-secondary" type="button" disabled={accessLoading || accessCode.length !== 6} onClick={() => void verifyAccessCode()}>
                {accessLoading ? "Verifying..." : "Open secure form"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {info && !needsAccessCode && !error && !success ? (
        <section className="db-card" style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>Learner and parent details</h2>
            <p className="db-helper" style={{ marginBottom: 0 }}>
              Please complete the information carefully. Your details are shared only with the school for this enrolment enquiry.
            </p>
          </div>
          {info.form?.instructions ? (
            <div className="db-soft-card" style={{ padding: 14 }}>
              <strong>School instructions</strong>
              <br />
              {info.form.instructions}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Learner</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>First name</strong><input className="db-input" value={fields.learner_first_name} onChange={(event) => setField("learner_first_name", event.target.value)} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Surname</strong><input className="db-input" value={fields.learner_surname} onChange={(event) => setField("learner_surname", event.target.value)} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Date of birth</strong><input className="db-input" type="date" value={fields.date_of_birth} onChange={(event) => setField("date_of_birth", event.target.value)} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Gender</strong><select className="db-input" value={fields.gender} onChange={(event) => setField("gender", event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Birth certificate, ID or passport number</strong><input className="db-input" value={fields.learner_id_or_birth_certificate} onChange={(event) => setField("learner_id_or_birth_certificate", event.target.value)} /></label>
              </div>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Parent or guardian</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>Full name</strong><input className="db-input" value={fields.guardian_name} onChange={(event) => setField("guardian_name", event.target.value)} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Relationship to learner</strong><input className="db-input" value={fields.guardian_relationship} onChange={(event) => setField("guardian_relationship", event.target.value)} placeholder="e.g. Mother, father, guardian" /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Contact mobile number</strong><input className="db-input" inputMode="tel" value={fields.guardian_phone} onChange={(event) => setField("guardian_phone", event.target.value)} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Parent Portal mobile number</strong><input className="db-input" inputMode="tel" value={fields.parent_portal_phone} onChange={(event) => setField("parent_portal_phone", event.target.value)} placeholder="Choose one number for Parent Portal access" required /><small className="db-helper">Use one South African mobile number for Parent Portal access and important updates.</small></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Email address</strong><input className="db-input" type="email" value={fields.guardian_email} onChange={(event) => setField("guardian_email", event.target.value)} /></label>
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Home address</strong><textarea className="db-input" rows={3} value={fields.home_address} onChange={(event) => setField("home_address", event.target.value)} /></label>
              </div>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Important health information</h3>
              <label style={{ display: "grid", gap: 7 }}><strong>Allergies, medical aid or medical notes (optional)</strong><textarea className="db-input" rows={4} value={fields.medical_notes} onChange={(event) => setField("medical_notes", event.target.value)} placeholder="Share only information the school should know to support the learner safely." /></label>
            </div>
          </div>
          <div><button className="db-button-primary" type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? "Submitting..." : "Submit Enrolment Form"}</button></div>
        </section>
      ) : null}
    </main>
  );
}

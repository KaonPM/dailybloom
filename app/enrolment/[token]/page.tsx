"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type PublicForm = {
  form_name?: string;
  form_type?: string;
  instructions?: string;
  custom_fields?: CustomFormField[];
  required_documents?: string[];
  stationery_list?: string[];
};

type CustomFormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

function getCustomFields(value: unknown): CustomFormField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is CustomFormField => Boolean(field && typeof field === "object" && typeof (field as CustomFormField).id === "string" && typeof (field as CustomFormField).label === "string" && ["text", "textarea", "select"].includes((field as CustomFormField).type))).slice(0, 12);
}

function getTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 40) : [];
}

type FormInfo = {
  reference: string;
  parent_name: string;
  status: string;
  school_name: string;
  school_logo_url?: string | null;
  school_primary_color?: string | null;
  form: PublicForm | null;
  document_requirements?: Array<{ title: string; instructions?: string | null; is_required: boolean }>;
  requirement_templates?: Array<{ category: string; item_name: string; quantity?: string | null; instructions?: string | null }>;
  consents?: Array<{ id: string; title: string; wording: string; is_required: boolean }>;
  terms?: Array<{ id: string; title: string; content: string }>;
  enrolment_configuration?: { additional_declaration?: string | null } | null;
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
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  const isPreview = token === "preview";
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [consentResponses, setConsentResponses] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [declarationName, setDeclarationName] = useState("");
  const [declarationRelationship, setDeclarationRelationship] = useState("");
  const [documentUploads, setDocumentUploads] = useState<Record<string, { name: string; path: string }>>({});
  const [uploadingDocument, setUploadingDocument] = useState("");
  const [step, setStep] = useState(1);
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
    if (isPreview) {
      const previewFormName = searchParams.get("form_name") || "Enrolment Form";
      const previewInstructions = searchParams.get("instructions") || "";
      let previewCustomFields: CustomFormField[] = [];
      try { previewCustomFields = getCustomFields(JSON.parse(searchParams.get("custom_fields") || "[]")); } catch { previewCustomFields = []; }
      let previewDocuments: string[] = [];
      let previewStationery: string[] = [];
      try { previewDocuments = getTextList(JSON.parse(searchParams.get("required_documents") || "[]")); } catch { previewDocuments = []; }
      try { previewStationery = getTextList(JSON.parse(searchParams.get("stationery_list") || "[]")); } catch { previewStationery = []; }
      setInfo({
        reference: "PREVIEW",
        parent_name: "Preview Parent",
        status: "preview",
        school_name: searchParams.get("school_name") || "Your School",
        school_logo_url: searchParams.get("school_logo_url") || null,
        school_primary_color: searchParams.get("school_primary_color") || null,
        form: { form_name: previewFormName, instructions: previewInstructions, custom_fields: previewCustomFields, required_documents: previewDocuments, stationery_list: previewStationery },
      });
      setFields((current) => ({ ...current, guardian_name: "Preview Parent" }));
      setNeedsAccessCode(false);
      setLoading(false);
      return;
    }
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
  }, [isPreview, searchParams, token]);

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
        body: JSON.stringify({ token, ...fields, custom_answers: customAnswers, uploaded_documents: documentUploads, consent_responses: consentResponses, terms_accepted: termsAccepted, declaration_name: declarationName, declaration_relationship: declarationRelationship }),
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

  const customFields = getCustomFields(info?.form?.custom_fields);
  const requiredDocuments = info?.document_requirements?.map((item) => item.title) || getTextList(info?.form?.required_documents);
  const stationeryList = info?.requirement_templates?.map((item) => `${item.item_name}${item.quantity ? ` (${item.quantity})` : ""}`) || getTextList(info?.form?.stationery_list);
  const consents = info?.consents || [];
  const terms = info?.terms || [];

  async function uploadDocument(documentName: string, file?: File) {
    if (!file || isPreview) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Use a PDF, JPG, PNG or WEBP document no larger than 10 MB.");
      return;
    }
    setUploadingDocument(documentName);
    setError("");
    try {
      const response = await fetch("/api/enrolment-form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "create_document_upload", file_name: file.name, file_size: file.size, content_type: file.type }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not prepare the document upload.");
      const uploadResponse = await fetch(body.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("The document could not be uploaded. Please try again.");
      setDocumentUploads((current) => ({ ...current, [documentName]: { name: file.name, path: body.path } }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The document could not be uploaded.");
    } finally {
      setUploadingDocument("");
    }
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
        {info?.school_logo_url ? <img src={info.school_logo_url} alt={`${info.school_name} logo`} style={{ width: 76, height: 76, borderRadius: 14, objectFit: "contain" }} /> : null}
        <h1 className="db-page-title" style={{ margin: 0 }}>
          {info?.school_name || "Secure Enrolment"}
        </h1>
        <p className="db-page-subtitle" style={{ margin: 0 }}>
          {info?.form?.form_name || "Enrolment Form"}
          {info?.reference ? ` · Reference ${info.reference}` : ""}
        </p>
        <div className="db-soft-card" style={{ padding: 10, borderLeft: `4px solid ${info?.school_primary_color || "#5ab8de"}` }}><strong>Digital school enrolment form</strong><span className="db-helper" style={{ display: "block", marginTop: 3 }}>Please complete the school’s form sections below. Your school details and enrolment reference are already included.</span></div>
      </section>

      {isPreview ? (
        <section className="db-card db-card-yellow" role="status" style={{ display: "grid", gap: 6 }}>
          <strong>Parent form preview</strong>
          <p className="db-helper" style={{ margin: 0 }}>This is exactly the layout parents use after their registration fee is confirmed. It is read-only and nothing entered here is saved.</p>
        </section>
      ) : null}

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
          <div className="db-soft-card" style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Enrolment progress">
            {["Learner", "Parent", "Documents & list", "Review"].map((label, index) => <span key={label} style={{ fontWeight: step === index + 1 ? 700 : 500, color: step === index + 1 ? "#155e8a" : "#74708b" }}>Step {index + 1} of 4: {label}</span>)}
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {step === 1 ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Learner</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>First name</strong><input className="db-input" value={fields.learner_first_name} onChange={(event) => setField("learner_first_name", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Surname</strong><input className="db-input" value={fields.learner_surname} onChange={(event) => setField("learner_surname", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Date of birth</strong><input className="db-input" type="date" value={fields.date_of_birth} onChange={(event) => setField("date_of_birth", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Gender</strong><select className="db-input" value={fields.gender} onChange={(event) => setField("gender", event.target.value)} disabled={isPreview}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Birth certificate, ID or passport number</strong><input className="db-input" value={fields.learner_id_or_birth_certificate} onChange={(event) => setField("learner_id_or_birth_certificate", event.target.value)} disabled={isPreview} /></label>
              </div>
            </div> : null}
            {step === 2 ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Parent or guardian</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>Full name</strong><input className="db-input" value={fields.guardian_name} onChange={(event) => setField("guardian_name", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Relationship to learner</strong><input className="db-input" value={fields.guardian_relationship} onChange={(event) => setField("guardian_relationship", event.target.value)} disabled={isPreview} placeholder="e.g. Mother, father, guardian" /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Contact mobile number</strong><input className="db-input" inputMode="tel" value={fields.guardian_phone} onChange={(event) => setField("guardian_phone", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Parent Portal mobile number</strong><input className="db-input" inputMode="tel" value={fields.parent_portal_phone} onChange={(event) => setField("parent_portal_phone", event.target.value)} disabled={isPreview} placeholder="Choose one number for Parent Portal access" required /><small className="db-helper">Use one South African mobile number for Parent Portal access and important updates.</small></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Email address</strong><input className="db-input" type="email" value={fields.guardian_email} onChange={(event) => setField("guardian_email", event.target.value)} disabled={isPreview} /></label>
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Home address</strong><textarea className="db-input" rows={3} value={fields.home_address} onChange={(event) => setField("home_address", event.target.value)} disabled={isPreview} /></label>
              </div>
            </div> : null}
            {step === 3 ? <div style={{ display: "grid", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>Required document uploads</h3>
                {requiredDocuments.length ? <div style={{ display: "grid", gap: 10 }}>{requiredDocuments.map((documentName) => { const configured = info?.document_requirements?.find((item) => item.title === documentName); return <label key={documentName} className="db-soft-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span><strong>{documentName}{configured?.is_required ? " *" : ""}</strong><br /><small className="db-helper">{documentUploads[documentName]?.name || configured?.instructions || "PDF, JPG, PNG or WEBP up to 10 MB"}</small></span><span className="db-button-secondary" style={{ cursor: isPreview ? "default" : "pointer" }}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={isPreview || uploadingDocument === documentName} onChange={(event) => void uploadDocument(documentName, event.target.files?.[0])} />{uploadingDocument === documentName ? "Uploading..." : documentUploads[documentName] ? "Replace" : "Upload"}</span></label>; })}</div> : <p className="db-helper">The school has not requested any document uploads for this form.</p>}
              </div>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>Stationery and items to bring</h3>
                {stationeryList.length ? <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{stationeryList.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="db-helper">The school has not added a stationery list yet.</p>}
              </div>
            </div> : null}
            {step === 4 ? <div style={{ display: "grid", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>Important health information</h3>
                <label style={{ display: "grid", gap: 7 }}><strong>Allergies, medical aid or medical notes (optional)</strong><textarea className="db-input" rows={4} value={fields.medical_notes} onChange={(event) => setField("medical_notes", event.target.value)} disabled={isPreview} placeholder="Share only information the school should know to support the learner safely." /></label>
              </div>
              {customFields.length ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Additional information</h3>
              <div style={{ display: "grid", gap: 14 }}>
                {customFields.map((field) => <label key={field.id} style={{ display: "grid", gap: 7 }}><strong>{field.label}{field.required ? " *" : ""}</strong>{field.type === "textarea" ? <textarea className="db-input" rows={4} value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required} /> : field.type === "select" ? <select className="db-input" value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required}><option value="">Select</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className="db-input" value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required} />}</label>)}
              </div>
              </div> : null}
              {consents.length ? <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Consent & permissions</h3>{consents.map((consent) => <label key={consent.id} className="db-soft-card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={Boolean(consentResponses[consent.id])} onChange={(event) => setConsentResponses((current) => ({ ...current, [consent.id]: event.target.checked }))} disabled={isPreview} /><span><strong>{consent.title}{consent.is_required ? " *" : ""}</strong><br /><small className="db-helper">{consent.wording}</small></span></label>)}</div> : null}
              {terms.length ? <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Terms & conditions</h3>{terms.map((term) => <div key={term.id} className="db-soft-card" style={{ padding: 12 }}><strong>{term.title}</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{term.content}</p></div>)}<label><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} disabled={isPreview} /> I accept the terms and conditions.</label></div> : null}
              <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Declaration</h3>{info?.enrolment_configuration?.additional_declaration ? <p className="db-helper" style={{ margin: 0 }}>{info.enrolment_configuration.additional_declaration}</p> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 5 }}><strong>Parent/guardian full name</strong><input className="db-input" value={declarationName} onChange={(event) => setDeclarationName(event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 5 }}><strong>Relationship to learner</strong><input className="db-input" value={declarationRelationship} onChange={(event) => setDeclarationRelationship(event.target.value)} disabled={isPreview} /></label></div></div>
              <div className="db-soft-card" style={{ padding: 12 }}><strong>Ready to submit</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>Check that the information and requested documents are complete before submitting.</p></div>
            </div> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><button className="db-button-secondary" type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>{step < 4 ? <button className="db-button-primary" type="button" onClick={() => setStep((current) => Math.min(4, current + 1))}>Continue</button> : <button className="db-button-primary" type="button" disabled={submitting || isPreview} onClick={() => void submit()}>{isPreview ? "Preview only" : submitting ? "Submitting..." : "Submit Enrolment Form"}</button>}</div>
        </section>
      ) : null}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

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

type RequirementTemplateKey = "0_2" | "2_6" | "babies" | "toddlers" | "grade_r";

function southAfricanIdDetails(value: string) {
  const id = value.replace(/\D/g, "");
  if (id.length !== 13) return null;
  const currentYear = new Date().getFullYear();
  const yearPart = Number(id.slice(0, 2));
  const year = 2000 + yearPart > currentYear ? 1900 + yearPart : 2000 + yearPart;
  const month = Number(id.slice(2, 4));
  const day = Number(id.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { dateOfBirth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, gender: Number(id.slice(6, 10)) >= 5000 ? "Male" : "Female" };
}

function ageInMonths(dateOfBirth: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return null;
  const today = new Date();
  return Math.max(0, (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0));
}

function matchingRequirementTemplateKey(templates: FormInfo["requirement_templates"], dateOfBirth: string) {
  const ageMonths = ageInMonths(dateOfBirth);
  if (ageMonths === null) return null;
  const priority: RequirementTemplateKey[] = ["babies", "toddlers", "grade_r", "0_2", "2_6"];
  return priority.find((key) => (templates || []).some((item) => item.template_key === key && ageMonths >= (item.available_from_months ?? 0) && ageMonths <= (item.available_to_months ?? 84))) || null;
}

function stepForValidationError(message: string): number {
  if (/upload|document|clinic card|immunisation record/i.test(message)) return 3;
  if (/guardian|parent portal|emergency contact|mobile number|email address/i.test(message)) return 2;
  if (/learner|date of birth|gender|birth certificate/i.test(message)) return 1;
  return 4;
}

type FormInfo = {
  reference: string;
  academic_year?: number;
  parent_name: string;
  initial_values?: Record<string, string>;
  initial_custom_answers?: Record<string, string>;
  initial_consent_responses?: Record<string, boolean>;
  initial_terms_accepted?: boolean;
  initial_declaration_name?: string;
  initial_declaration_relationship?: string;
  initial_uploaded_documents?: Record<string, { name: string; path: string }>;
  initial_purchased_requirement_items?: Record<string, boolean>;
  initial_requested_recurring_addon_ids?: number[];
  initial_selected_monthly_fee_id?: number | null;
  draft_saved_at?: string | null;
  status: string;
  school_name: string;
  school_logo_url?: string | null;
  school_primary_color?: string | null;
  school_contact_number?: string | null;
  school_email_address?: string | null;
  school_physical_address?: string | null;
  school_registration_number?: string | null;
  form: PublicForm | null;
  document_requirements?: Array<{ title: string; instructions?: string | null; is_required: boolean }>;
  requirement_templates?: Array<{ template_key?: "0_2" | "2_6" | "babies" | "toddlers" | "grade_r"; available_from_months?: number; available_to_months?: number; category: string; item_name: string; quantity?: string | null; instructions?: string | null }>;
  consents?: Array<{ id: string; title: string; wording: string; is_required: boolean }>;
  terms?: Array<{ id: string; title: string; content: string }>;
  fees?: Array<{ id?: number; fee_code?: string | null; fee_name?: string | null; fee_category?: string | null; amount?: number | string | null }>;
  banking_details?: { bank_account_name?: string | null; bank_name?: string | null; bank_account_number?: string | null; bank_branch_code?: string | null; bank_account_type?: string | null } | null;
  enrolment_configuration?: { additional_declaration?: string | null; second_guardian_mode?: "hidden" | "optional" | "required"; emergency_contact_mode?: "hidden" | "optional" | "required"; previous_school_enabled?: boolean; requirement_template_keys?: Array<"0_2" | "2_6" | "babies" | "toddlers" | "grade_r"> } | null;
  staff_capture?: boolean;
};

const emptyFields = {
  learner_first_name: "",
  learner_surname: "",
  date_of_birth: "",
  gender: "",
  learner_id_or_birth_certificate: "",
  guardian_name: "",
  guardian_relationship: "",
  guardian_id_or_passport: "",
  guardian_phone: "",
  guardian_daytime_phone: "",
  parent_portal_phone: "",
  guardian_email: "",
  guardian_employer: "",
  guardian_occupation: "",
  guardian_work_phone: "",
  second_guardian_name: "",
  second_guardian_id_or_passport: "",
  second_guardian_phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  previous_school: "",
  home_address: "",
  allergies: "",
  medical_conditions: "",
  medical_aid_name: "",
  medical_aid_number: "",
  medical_aid_main_member: "",
  preferred_doctor_name: "",
  preferred_doctor_phone: "",
  immunisation_status: "",
  immunisation_notes: "",
};

export default function SecureEnrolmentFormPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  const isPreview = token === "preview";
  const staffCaptureId = searchParams.get("staff_capture_id") || "";
  const staffSchoolId = searchParams.get("school_id") || "";
  const isStaffCapture = Boolean(staffCaptureId && staffSchoolId);
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [consentResponses, setConsentResponses] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [declarationName, setDeclarationName] = useState("");
  const [declarationRelationship, setDeclarationRelationship] = useState("");
  const [documentUploads, setDocumentUploads] = useState<Record<string, { name: string; path: string }>>({});
  const [purchasedRequirementItems, setPurchasedRequirementItems] = useState<Record<string, boolean>>({});
  const [requestedRecurringAddonIds, setRequestedRecurringAddonIds] = useState<number[]>([]);
  const [selectedMonthlyFeeId, setSelectedMonthlyFeeId] = useState<number | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingAnother, setStartingAnother] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [accessError, setAccessError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadForm = useCallback(async () => {
    if (isPreview) {
      let storedPreview: Partial<FormInfo> & { form_name?: string; instructions?: string; custom_fields?: CustomFormField[] } = {};
      const previewId = searchParams.get("preview_id");
      if (previewId) {
        const storageKey = `dailybloom:enrolment-preview:${previewId}`;
        try {
          storedPreview = JSON.parse(localStorage.getItem(storageKey) || "{}");
          window.setTimeout(() => localStorage.removeItem(storageKey), 60_000);
        } catch {
          storedPreview = {};
        }
      }
      const previewFormName = storedPreview.form_name || searchParams.get("form_name") || "Enrolment Form";
      const previewInstructions = storedPreview.instructions || searchParams.get("instructions") || "";
      let previewCustomFields: CustomFormField[] = [];
      let previewDocuments: FormInfo["document_requirements"] = [];
      let previewRequirements: FormInfo["requirement_templates"] = [];
      let previewConsents: FormInfo["consents"] = [];
      let previewTerms: FormInfo["terms"] = [];
      let previewConfiguration: FormInfo["enrolment_configuration"] = null;
      try { previewCustomFields = getCustomFields(storedPreview.custom_fields || JSON.parse(searchParams.get("custom_fields") || "[]")); } catch { previewCustomFields = []; }
      try { previewDocuments = storedPreview.document_requirements || JSON.parse(searchParams.get("document_requirements") || "[]"); } catch { previewDocuments = []; }
      try { previewRequirements = storedPreview.requirement_templates || JSON.parse(searchParams.get("requirement_templates") || "[]"); } catch { previewRequirements = []; }
      try { previewConsents = storedPreview.consents || JSON.parse(searchParams.get("consents") || "[]"); } catch { previewConsents = []; }
      try { previewTerms = storedPreview.terms || JSON.parse(searchParams.get("terms") || "[]"); } catch { previewTerms = []; }
      try { previewConfiguration = storedPreview.enrolment_configuration || JSON.parse(searchParams.get("enrolment_configuration") || "null"); } catch { previewConfiguration = null; }
      setInfo({
        reference: "PREVIEW",
        parent_name: "Preview Parent",
        status: "preview",
        school_name: storedPreview.school_name || searchParams.get("school_name") || "Your School",
        school_logo_url: storedPreview.school_logo_url || searchParams.get("school_logo_url") || null,
        school_primary_color: storedPreview.school_primary_color || searchParams.get("school_primary_color") || null,
        school_registration_number: storedPreview.school_registration_number || searchParams.get("school_registration_number") || null,
        school_physical_address: storedPreview.school_physical_address || searchParams.get("school_physical_address") || null,
        school_contact_number: storedPreview.school_contact_number || searchParams.get("school_contact_number") || null,
        school_email_address: storedPreview.school_email_address || searchParams.get("school_email_address") || null,
        form: { form_name: previewFormName, instructions: previewInstructions, custom_fields: previewCustomFields },
        document_requirements: Array.isArray(previewDocuments) ? previewDocuments : [],
        requirement_templates: Array.isArray(previewRequirements) ? previewRequirements : [],
        consents: Array.isArray(previewConsents) ? previewConsents : [],
        terms: Array.isArray(previewTerms) ? previewTerms : [],
        fees: Array.isArray(storedPreview.fees) ? storedPreview.fees : [],
        banking_details: storedPreview.banking_details || null,
        enrolment_configuration: previewConfiguration,
      });
      setFields((current) => ({ ...current, guardian_name: "Preview Parent" }));
      setLoading(false);
      return;
    }
    if (!token) return;
    setLoading(true);
    setAccessError("");
    setError("");
    try {
      const endpoint = isStaffCapture
        ? `/api/enrolment-form?staff_capture_id=${encodeURIComponent(staffCaptureId)}&school_id=${encodeURIComponent(staffSchoolId)}`
        : `/api/enrolment-form?token=${encodeURIComponent(token)}`;
      const response = await (isStaffCapture ? authenticatedFetch : fetch)(endpoint, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "This enrolment link is not available.");
      }
      setInfo(body as FormInfo);
      setFields({ ...emptyFields, ...(body.initial_values || {}), guardian_name: body.initial_values?.guardian_name || body.parent_name || "" });
      setCustomAnswers(body.initial_custom_answers || {});
      setConsentResponses(body.initial_consent_responses || {});
      setTermsAccepted(body.initial_terms_accepted === true);
      setDeclarationName(body.initial_declaration_name || "");
      setDeclarationRelationship(body.initial_declaration_relationship || "");
      setDocumentUploads(body.initial_uploaded_documents || {});
      setPurchasedRequirementItems(body.initial_purchased_requirement_items || {});
      setRequestedRecurringAddonIds(Array.isArray(body.initial_requested_recurring_addon_ids) ? body.initial_requested_recurring_addon_ids.map(Number).filter(Number.isInteger) : []);
      setSelectedMonthlyFeeId(Number.isInteger(Number(body.initial_selected_monthly_fee_id)) ? Number(body.initial_selected_monthly_fee_id) : null);
      setDraftSavedAt(body.draft_saved_at || "");
      if (body.draft_saved_at) setDraftMessage("Your saved draft has been restored.");
    } catch (loadError) {
      setAccessError(
        loadError instanceof Error
          ? loadError.message
          : "This enrolment link is not available.",
      );
    } finally {
      setLoading(false);
    }
  }, [isPreview, isStaffCapture, searchParams, staffCaptureId, staffSchoolId, token]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  function formPayload(action?: "save_draft") {
    return {
      token,
      staff_capture_id: staffCaptureId || undefined,
      school_id: staffSchoolId ? Number(staffSchoolId) : undefined,
      ...(action ? { action } : {}),
      ...fields,
      custom_answers: customAnswers,
      uploaded_documents: documentUploads,
      purchased_requirement_items: purchasedRequirementItems,
      consent_responses: consentResponses,
      terms_accepted: termsAccepted,
      declaration_name: declarationName,
      declaration_relationship: declarationRelationship,
      requested_recurring_addon_ids: requestedRecurringAddonIds,
      selected_monthly_fee_id: selectedMonthlyFeeId,
    };
  }

  async function saveDraft(showConfirmation = true) {
    if (isPreview) return false;
    setSavingDraft(true);
    setError("");
    if (showConfirmation) setDraftMessage("");
    try {
      const response = await (isStaffCapture ? authenticatedFetch : fetch)("/api/enrolment-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload("save_draft")),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const responseError = body.error || "Your enrolment draft could not be saved.";
        if (!isStaffCapture && [401, 403, 404].includes(response.status)) {
          setAccessError(responseError);
          return false;
        }
        throw new Error(responseError);
      }
      setDraftSavedAt(body.saved_at || new Date().toISOString());
      if (showConfirmation) setDraftMessage("Draft saved. You can safely return to this form before the secure link expires.");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Your enrolment draft could not be saved.");
      return false;
    } finally {
      setSavingDraft(false);
    }
  }

  async function continueToNextStep() {
    if (isPreview) {
      setStep((current) => Math.min(4, current + 1));
      return;
    }
    const saved = await saveDraft(false);
    if (saved) setStep((current) => Math.min(4, current + 1));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await (isStaffCapture ? authenticatedFetch : fetch)("/api/enrolment-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const responseError = body.error || "Your enrolment form could not be submitted.";
        if (!isStaffCapture && [401, 403, 404].includes(response.status) && body.draft_saved !== true) {
          setAccessError(responseError);
          return;
        }
        if (body.draft_saved === true) {
          setDraftSavedAt(body.saved_at || new Date().toISOString());
          setDraftMessage("Your entries were kept as a draft. Complete the requested information and submit again.");
        }
        setStep(stepForValidationError(responseError));
        throw new Error(responseError);
      }
      setSuccess(isStaffCapture
        ? "The returned paper form has been captured against this enrolment reference and is ready for review."
        : "Thank you. Your form has been submitted securely. The school will review it and contact you about the next step.");
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

  async function startAnotherLearner() {
    if (!isStaffCapture) return;
    setStartingAnother(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/enrolments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_manual_application",
          school_id: Number(staffSchoolId),
          academic_year: info?.academic_year || new Date().getFullYear(),
          enrolment_source: "paper_manual_capture",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.enquiry?.id) throw new Error(body.error || "Could not start another manual enrolment.");
      router.push(`/enrolment/staff?staff_capture_id=${encodeURIComponent(String(body.enquiry.id))}&school_id=${encodeURIComponent(staffSchoolId)}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start another manual enrolment.");
    } finally {
      setStartingAnother(false);
    }
  }

  function setField(name: keyof typeof emptyFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function setLearnerIdentityNumber(value: string) {
    const details = southAfricanIdDetails(value);
    setFields((current) => ({
      ...current,
      learner_id_or_birth_certificate: value,
      ...(details ? { date_of_birth: details.dateOfBirth, gender: details.gender } : {}),
    }));
  }

  const customFields = getCustomFields(info?.form?.custom_fields);
  const configuration = info?.enrolment_configuration;
  const responsibleGuardianDocument = "Responsible parent/guardian identification document";
  const secondGuardianDocument = "Second parent/guardian identification document";
  const configuredDocumentNames = info?.document_requirements?.map((item) => item.title) || getTextList(info?.form?.required_documents);
  const hasResponsibleId = configuredDocumentNames.some((name) => /(parent|guardian).*(id|identity|passport)|(id|identity|passport).*(parent|guardian)/i.test(name));
  const secondGuardianProvided = Boolean(fields.second_guardian_name.trim() || fields.second_guardian_id_or_passport.trim() || fields.second_guardian_phone.trim());
  const guardianDocuments = hasResponsibleId ? configuredDocumentNames : [...configuredDocumentNames, responsibleGuardianDocument];
  const requiredDocuments = (configuration?.second_guardian_mode === "required" || secondGuardianProvided) && !guardianDocuments.includes(secondGuardianDocument) ? [...guardianDocuments, secondGuardianDocument] : guardianDocuments;
  const requirementTemplateKeys = configuration?.requirement_template_keys || ["0_2", "2_6"];
  const configuredRequirementTemplates = (info?.requirement_templates || []).filter((item) => requirementTemplateKeys.includes(item.template_key || "2_6"));
  const matchingRequirementTemplate = matchingRequirementTemplateKey(configuredRequirementTemplates, fields.date_of_birth);
  const requirementTemplates = matchingRequirementTemplate ? configuredRequirementTemplates.filter((item) => item.template_key === matchingRequirementTemplate) : [];
  const legacyStationeryList = requirementTemplates.length ? [] : getTextList(info?.form?.stationery_list);
  const consents = info?.consents || [];
  const terms = info?.terms || [];
  const recurringAddons = (info?.fees || []).filter((fee) => fee.fee_category === "recurring_addon");
  const monthlyFees = (info?.fees || []).filter((fee) => fee.fee_category === "monthly");

  async function uploadDocument(documentName: string, file?: File) {
    if (!file || isPreview) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Use a PDF, JPG, PNG or WEBP document no larger than 10 MB.");
      return;
    }
    setUploadingDocument(documentName);
    setError("");
    try {
      const response = await (isStaffCapture ? authenticatedFetch : fetch)("/api/enrolment-form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, staff_capture_id: staffCaptureId || undefined, school_id: staffSchoolId ? Number(staffSchoolId) : undefined, action: "create_document_upload", file_name: file.name, file_size: file.size, content_type: file.type }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const responseError = body.error || "Could not prepare the document upload.";
        if (!isStaffCapture && [401, 403, 404].includes(response.status)) {
          setAccessError(responseError);
          return;
        }
        throw new Error(responseError);
      }
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
    <main className="db-public-page db-enrolment-page">
      <section className="db-card db-card-blue" style={{ display: "grid", gap: 12 }}>
        <div className="enrolment-form-brand-header">
          <div className="enrolment-form-school-details db-helper"><p><strong>Registration / EMIS / NPO number:</strong> {info?.school_registration_number || "Not provided by the school"}</p><p><strong>Registered address:</strong> {info?.school_physical_address || "Not provided by the school"}</p></div>
          <div className="enrolment-form-brand">
            <div className="db-eyebrow">DAILYBLOOM · {isStaffCapture ? "STAFF DIGITAL CAPTURE" : "SECURE ENROLMENT"}</div>
            {info?.school_logo_url ? <img className="enrolment-form-brand-logo" src={info.school_logo_url} alt={`${info.school_name} logo`} /> : null}
            <h1 className="db-page-title" style={{ margin: 0 }}>{info?.school_name || "Secure Enrolment"}</h1>
            <p className="db-page-subtitle" style={{ margin: 0 }}>
              {info?.form?.form_name || "Enrolment Form"}
              {info?.reference ? ` · Reference ${info.reference}` : ""}
            </p>
          </div>
          <div className="enrolment-form-contacts db-helper">
            <p><strong>Contact number:</strong> {info?.school_contact_number || "Not provided by the school"}</p>
            <p><strong>Email:</strong> {info?.school_email_address || "Not provided by the school"}</p>
          </div>
        </div>
        <div className="db-soft-card" style={{ padding: 10, borderLeft: `4px solid ${info?.school_primary_color || "#5ab8de"}` }}><strong>{isStaffCapture ? "Capture learner enrolment" : "Private digital school enrolment form"}</strong><span className="db-helper" style={{ display: "block", marginTop: 3 }}>{isStaffCapture ? "Complete the universal enrolment form below. The learner information remains attached to this enrolment reference." : "This private link is tied to one learner and expires after 72 hours. Please do not forward or share it. Your school details and enrolment reference are already included."}</span></div>
      </section>

      {isPreview ? (
        <section className="db-card db-card-yellow" role="status" style={{ display: "grid", gap: 6 }}>
          <strong>Parent form preview</strong>
          <p className="db-helper" style={{ margin: 0 }}>This is exactly the layout parents use after their registration fee is confirmed. It is read-only and nothing entered here is saved.</p>
        </section>
      ) : null}

      {accessError ? (
        <section className="db-card db-card-yellow" role="alert" style={{ display: "grid", gap: 8 }}>
          <div className="db-eyebrow">SECURE ENROLMENT LINK</div>
          <h2 style={{ margin: 0 }}>We could not open this enrolment link</h2>
          <p style={{ color: "#a33d45", margin: 0 }}>{accessError}</p>
          <p className="db-helper" style={{ margin: 0 }}>
            For privacy, secure links expire after 72 hours and cannot be reused after a form is submitted. Please contact the school that sent the link to request a fresh link.
          </p>
        </section>
      ) : null}
      {error && info && !accessError && !success ? (
        <section className="db-card db-card-yellow" role="alert" style={{ display: "grid", gap: 6 }}>
          <strong>Please complete the highlighted section</strong>
          <p style={{ color: "#a33d45", margin: 0 }}>{error}</p>
          <p className="db-helper" style={{ margin: 0 }}>Your other entries remain on this form and have been kept as a draft where possible.</p>
        </section>
      ) : null}
      {success ? (
        <section className="db-card db-card-green" role="status">
          <h2 style={{ marginTop: 0 }}>Form submitted</h2>
          <p style={{ marginBottom: 0 }}>{success}</p>
          {isStaffCapture ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}><button className="db-button-primary" type="button" disabled={startingAnother} onClick={() => void startAnotherLearner()}>{startingAnother ? "Opening..." : "Add Another Learner"}</button><a className="db-button-secondary" href={`/enrolments?school=${encodeURIComponent(staffSchoolId)}`}>Back to Enrolments</a></div> : null}
          {error ? <p role="alert" style={{ color: "#a33d45", marginBottom: 0 }}>{error}</p> : null}
        </section>
      ) : null}

      {info && !accessError && !success ? (
        <section className="db-card db-enrolment-form" style={{ display: "grid", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Learner and parent details</h2>
            <p className="db-helper" style={{ marginBottom: 0 }}>{isStaffCapture ? "Capture the returned form carefully. The sections match the parent digital enrolment form." : "Please complete the information carefully. Your details are shared only with the school for this enrolment enquiry."}</p>
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
          {draftMessage || draftSavedAt ? <div className="db-success-banner" role="status"><strong>{draftMessage || "Draft saved."}</strong>{draftSavedAt ? <small style={{ display: "block", marginTop: 3 }}>Last saved {new Date(draftSavedAt).toLocaleString("en-ZA")}</small> : null}</div> : null}
          <div style={{ display: "grid", gap: 16 }}>
            {step === 1 ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Learner</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>First name</strong><input className="db-input" value={fields.learner_first_name} onChange={(event) => setField("learner_first_name", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Surname</strong><input className="db-input" value={fields.learner_surname} onChange={(event) => setField("learner_surname", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Date of birth</strong><input className="db-input" type="date" value={fields.date_of_birth} onChange={(event) => setField("date_of_birth", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Gender</strong><select className="db-input" value={fields.gender} onChange={(event) => setField("gender", event.target.value)} disabled={isPreview}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Birth certificate, ID or passport number</strong><input className="db-input" value={fields.learner_id_or_birth_certificate} onChange={(event) => setLearnerIdentityNumber(event.target.value)} disabled={isPreview} /><small className="db-helper">A valid 13-digit South African ID automatically fills in date of birth and gender. Otherwise, enter the date of birth above.</small></label>
                {configuration?.previous_school_enabled ? <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Previous school or ECD programme <span className="db-helper">(if applicable)</span></strong><input className="db-input" value={fields.previous_school} onChange={(event) => setField("previous_school", event.target.value)} disabled={isPreview} /></label> : null}
              </div>
            </div> : null}
            {step === 2 ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Parent or guardian</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 7 }}><strong>Full name</strong><input className="db-input" value={fields.guardian_name} onChange={(event) => setField("guardian_name", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Relationship to learner</strong><input className="db-input" value={fields.guardian_relationship} onChange={(event) => setField("guardian_relationship", event.target.value)} disabled={isPreview} placeholder="e.g. Mother, father, guardian" /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>ID or passport number</strong><input className="db-input" value={fields.guardian_id_or_passport} onChange={(event) => setField("guardian_id_or_passport", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Contact mobile number</strong><input className="db-input" inputMode="tel" value={fields.guardian_phone} onChange={(event) => setField("guardian_phone", event.target.value)} disabled={isPreview} required /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Contact number during the day</strong><input className="db-input" inputMode="tel" value={fields.guardian_daytime_phone} onChange={(event) => setField("guardian_daytime_phone", event.target.value)} disabled={isPreview} placeholder="Work or alternative daytime number" /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Parent Portal mobile number</strong><input className="db-input" inputMode="tel" value={fields.parent_portal_phone} onChange={(event) => setField("parent_portal_phone", event.target.value)} disabled={isPreview} placeholder="Choose one number for Parent Portal access" required /><small className="db-helper">Use one South African mobile number for Parent Portal access and important updates.</small></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Email address</strong><input className="db-input" type="email" value={fields.guardian_email} onChange={(event) => setField("guardian_email", event.target.value)} disabled={isPreview} /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Employer or business</strong><input className="db-input" value={fields.guardian_employer} onChange={(event) => setField("guardian_employer", event.target.value)} disabled={isPreview} /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Occupation</strong><input className="db-input" value={fields.guardian_occupation} onChange={(event) => setField("guardian_occupation", event.target.value)} disabled={isPreview} /></label>
                <label style={{ display: "grid", gap: 7 }}><strong>Work contact number</strong><input className="db-input" inputMode="tel" value={fields.guardian_work_phone} onChange={(event) => setField("guardian_work_phone", event.target.value)} disabled={isPreview} /></label>
                {configuration?.second_guardian_mode !== "hidden" ? <><label style={{ display: "grid", gap: 7 }}><strong>Second parent/guardian name{configuration?.second_guardian_mode === "required" ? " *" : ""}</strong><input className="db-input" value={fields.second_guardian_name} onChange={(event) => setField("second_guardian_name", event.target.value)} disabled={isPreview} required={configuration?.second_guardian_mode === "required"} /></label><label style={{ display: "grid", gap: 7 }}><strong>Second parent/guardian ID or passport number{configuration?.second_guardian_mode === "required" ? " *" : ""}</strong><input className="db-input" value={fields.second_guardian_id_or_passport} onChange={(event) => setField("second_guardian_id_or_passport", event.target.value)} disabled={isPreview} required={configuration?.second_guardian_mode === "required"} /></label><label style={{ display: "grid", gap: 7 }}><strong>Second parent/guardian mobile{configuration?.second_guardian_mode === "required" ? " *" : ""}</strong><input className="db-input" inputMode="tel" value={fields.second_guardian_phone} onChange={(event) => setField("second_guardian_phone", event.target.value)} disabled={isPreview} required={configuration?.second_guardian_mode === "required"} /></label></> : null}
                {configuration?.emergency_contact_mode !== "hidden" ? <><label style={{ display: "grid", gap: 7 }}><strong>Emergency contact name{configuration?.emergency_contact_mode === "required" ? " *" : ""}</strong><input className="db-input" value={fields.emergency_contact_name} onChange={(event) => setField("emergency_contact_name", event.target.value)} disabled={isPreview} required={configuration?.emergency_contact_mode === "required"} /></label><label style={{ display: "grid", gap: 7 }}><strong>Emergency contact mobile{configuration?.emergency_contact_mode === "required" ? " *" : ""}</strong><input className="db-input" inputMode="tel" value={fields.emergency_contact_phone} onChange={(event) => setField("emergency_contact_phone", event.target.value)} disabled={isPreview} required={configuration?.emergency_contact_mode === "required"} /></label></> : null}
                <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}><strong>Home address</strong><textarea className="db-input" rows={3} value={fields.home_address} onChange={(event) => setField("home_address", event.target.value)} disabled={isPreview} /></label>
              </div>
            </div> : null}
            {step === 3 ? <div style={{ display: "grid", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>{isStaffCapture ? "Document uploads" : "Required document uploads"}</h3>
                {requiredDocuments.length ? <>{isStaffCapture ? <p className="db-helper" style={{ margin: 0 }}>Documents are optional for manual capture and can be uploaded later from the learner profile.</p> : null}<div style={{ display: "grid", gap: 8 }}>{requiredDocuments.map((documentName) => { const configured = info?.document_requirements?.find((item) => item.title === documentName); const isResponsibleDocument = documentName === responsibleGuardianDocument || /(parent|guardian).*(id|identity|passport)|(id|identity|passport).*(parent|guardian)/i.test(documentName) && documentName !== secondGuardianDocument; const isGuardianDocument = documentName === secondGuardianDocument || isResponsibleDocument; const documentHint = isStaffCapture ? (isResponsibleDocument ? "ID or passport can be uploaded later from the learner profile." : "Optional now — PDF, JPG, PNG or WEBP up to 10 MB.") : (documentName === secondGuardianDocument ? "Required when second guardian details are supplied." : isResponsibleDocument ? "Upload an ID or passport for the responsible parent or guardian." : "PDF, JPG, PNG or WEBP up to 10 MB"); return <label key={documentName} className="db-soft-card" style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span><strong>{documentName}{!isStaffCapture && (configured?.is_required || isGuardianDocument) ? " *" : ""}</strong><br /><small className="db-helper">{documentUploads[documentName]?.name || configured?.instructions || documentHint}</small></span><span className="db-button-secondary" style={{ cursor: isPreview ? "default" : "pointer" }}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={isPreview || uploadingDocument === documentName} onChange={(event) => void uploadDocument(documentName, event.target.files?.[0])} />{uploadingDocument === documentName ? "Uploading..." : documentUploads[documentName] ? "Replace" : "Upload"}</span></label>; })}</div></> : <p className="db-helper">The school has not requested any document uploads for this form.</p>}
              </div>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>Stationery and items to bring</h3>
                {requirementTemplates.length ? <div style={{ display: "grid", gap: 10 }}>{(["0_2", "2_6", "babies", "toddlers", "grade_r"] as const).map((templateKey) => { const items = requirementTemplates.filter((item) => (item.template_key || "2_6") === templateKey); if (!items.length) return null; const label = templateKey === "0_2" ? "0–2 Years" : templateKey === "2_6" ? "2–6 Years" : templateKey === "babies" ? "Babies" : templateKey === "toddlers" ? "Toddlers" : "Grade R"; return <div key={templateKey} className="db-soft-card" style={{ padding: 10 }}><strong>{label} requirements</strong><div className="db-requirement-categories">{(["stationery", "hygiene"] as const).map((category) => { const categoryItems = items.filter((item) => item.category === category); if (!categoryItems.length) return null; const fromMonths = Math.min(...categoryItems.map((item) => item.available_from_months ?? (templateKey === "0_2" && category === "hygiene" ? 0 : templateKey === "0_2" ? 6 : templateKey === "babies" ? 0 : templateKey === "toddlers" ? 24 : templateKey === "grade_r" ? 60 : 24))); const toMonths = Math.max(...categoryItems.map((item) => item.available_to_months ?? (templateKey === "0_2" ? 24 : templateKey === "babies" ? 24 : templateKey === "toddlers" ? 48 : templateKey === "grade_r" ? 84 : 72))); return <div key={category} style={{ marginTop: 8 }}><strong style={{ textTransform: "capitalize" }}>{category}</strong><small className="db-helper" style={{ display: "block", marginTop: 2 }}>Age requirement: {fromMonths}–{toMonths} months</small><ul className="db-compact-list">{categoryItems.map((item) => { const itemKey = `${templateKey}|${category}|${item.item_name}`; return <li key={itemKey}><label style={{ display: "flex", gap: 8, alignItems: "center", cursor: isPreview ? "default" : "pointer" }}><input type="checkbox" checked={Boolean(purchasedRequirementItems[itemKey])} disabled={isPreview} onChange={(event) => setPurchasedRequirementItems((current) => ({ ...current, [itemKey]: event.target.checked }))} /><span>{item.item_name}{item.quantity ? ` (${item.quantity})` : ""}</span></label></li>; })}</ul></div>; })}</div></div>; })}</div> : legacyStationeryList.length ? <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{legacyStationeryList.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="db-helper">{fields.date_of_birth ? "The school has no learner-requirement list for this age range yet." : "Enter the learner’s date of birth or a valid South African ID to see the applicable requirements."}</p>}
              </div>
            </div> : null}
            {step === 4 ? <div style={{ display: "grid", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 10px" }}>Important health information</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 7 }}><strong>Allergies (optional)</strong><textarea className="db-input" rows={2} value={fields.allergies} onChange={(event) => setField("allergies", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Medical conditions (optional)</strong><textarea className="db-input" rows={2} value={fields.medical_conditions} onChange={(event) => setField("medical_conditions", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Medical aid name</strong><input className="db-input" value={fields.medical_aid_name} onChange={(event) => setField("medical_aid_name", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Medical aid membership number</strong><input className="db-input" value={fields.medical_aid_number} onChange={(event) => setField("medical_aid_number", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Main member</strong><input className="db-input" value={fields.medical_aid_main_member} onChange={(event) => setField("medical_aid_main_member", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Preferred doctor</strong><input className="db-input" value={fields.preferred_doctor_name} onChange={(event) => setField("preferred_doctor_name", event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 7 }}><strong>Doctor contact number</strong><input className="db-input" inputMode="tel" value={fields.preferred_doctor_phone} onChange={(event) => setField("preferred_doctor_phone", event.target.value)} disabled={isPreview} /></label></div><div className="db-soft-card" style={{ padding: 10, display: "grid", gap: 8 }}><div><strong>Immunisation</strong><small className="db-helper" style={{ display: "block", marginTop: 2 }}>Please support the information below by uploading the learner&apos;s latest immunisation record or clinic card in Required Documents.</small></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 7 }}><strong>Are immunisations up to date?</strong><select className="db-input" value={fields.immunisation_status} onChange={(event) => setField("immunisation_status", event.target.value)} disabled={isPreview}><option value="">Select</option><option value="up_to_date">Yes, up to date</option><option value="outstanding">No, vaccines are outstanding</option><option value="scheduled">Updates are scheduled</option><option value="not_applicable">Not applicable / exempt</option></select></label><label style={{ display: "grid", gap: 7 }}><strong>Immunisation notes</strong><textarea className="db-input" rows={2} value={fields.immunisation_notes} onChange={(event) => setField("immunisation_notes", event.target.value)} disabled={isPreview} placeholder="List outstanding vaccines, scheduled dates or exemption details." /></label></div></div>
              </div>
              {customFields.length ? <div>
              <h3 style={{ margin: "0 0 10px" }}>Additional information</h3>
              <div style={{ display: "grid", gap: 14 }}>
                {customFields.map((field) => <label key={field.id} style={{ display: "grid", gap: 7 }}><strong>{field.label}{field.required ? " *" : ""}</strong>{field.type === "textarea" ? <textarea className="db-input" rows={4} value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required} /> : field.type === "select" ? <select className="db-input" value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required}><option value="">Select</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className="db-input" value={customAnswers[field.id] || ""} onChange={(event) => setCustomAnswers((current) => ({ ...current, [field.id]: event.target.value }))} disabled={isPreview} required={field.required} />}</label>)}
              </div>
              </div> : null}
              {consents.length ? <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Consent & permissions</h3><p className="db-helper" style={{ margin: 0 }}>Detailed consent requests for specific outings, activities, treatment or other situations will be sent through the Parent Portal when required by the school.</p>{consents.map((consent) => <label key={consent.id} className="db-soft-card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={Boolean(consentResponses[consent.id])} onChange={(event) => setConsentResponses((current) => ({ ...current, [consent.id]: event.target.checked }))} disabled={isPreview} /><span><strong>{consent.title}{consent.is_required ? " *" : ""}</strong><br /><small className="db-helper">{consent.wording}</small></span></label>)}</div> : null}
              <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>School fees</h3>{info?.fees?.length ? <><div className="blank-fee-grid">{info.fees.filter((fee) => fee.fee_category !== "recurring_addon").map((fee, index) => <p key={`${fee.fee_code || fee.fee_name}-${index}`}><strong>{fee.fee_name || "School fee"}</strong><span>R{Number(fee.amount || 0).toFixed(2)}</span>{fee.fee_category ? <small>{fee.fee_category}</small> : null}</p>)}</div>{monthlyFees.length > 1 ? <div className="db-soft-card" style={{ padding: 12, display: "grid", gap: 8 }}><strong>Choose the monthly school-fee option *</strong><p className="db-helper" style={{ margin: 0 }}>The school will confirm this choice before billing begins.</p>{monthlyFees.map((fee) => <label key={fee.id} className="db-checkbox-row"><input type="radio" name="monthly-fee" disabled={isPreview} checked={selectedMonthlyFeeId === Number(fee.id)} onChange={() => setSelectedMonthlyFeeId(Number(fee.id))} /><span>{fee.fee_name || "Monthly school fee"} · R{Number(fee.amount || 0).toFixed(2)} per month</span></label>)}</div> : null}</> : <p className="db-helper" style={{ margin: 0 }}>No active fee amounts have been configured in School Fee Setup.</p>}</div>
              {recurringAddons.length ? <div className="db-soft-card" style={{ padding: 12, display: "grid", gap: 8 }}><div><strong>Optional monthly services</strong><p className="db-helper" style={{ margin: "3px 0 0" }}>Select services you would like to request. The school confirms them before any monthly charge starts.</p></div>{recurringAddons.map((fee, index) => { const id = Number(fee.fee_code?.replace(/^recurring_addon_/, "")); return <label key={`${fee.fee_code || fee.fee_name}-${index}`} className="db-checkbox-row"><input type="checkbox" disabled={isPreview || !Number.isInteger(id)} checked={Number.isInteger(id) && requestedRecurringAddonIds.includes(id)} onChange={(event) => { if (!Number.isInteger(id)) return; setRequestedRecurringAddonIds((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)); }} /><span>{fee.fee_name || "Monthly service"} · R{Number(fee.amount || 0).toFixed(2)} per month</span></label>; })}</div> : null}
              <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Banking details</h3><div className="db-soft-card" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}><p style={{ margin: 0 }}><strong>Account name:</strong> {info?.banking_details?.bank_account_name || "Not configured"}</p><p style={{ margin: 0 }}><strong>Bank:</strong> {info?.banking_details?.bank_name || "Not configured"}</p><p style={{ margin: 0 }}><strong>Account number:</strong> {info?.banking_details?.bank_account_number || "Not configured"}</p><p style={{ margin: 0 }}><strong>Branch code:</strong> {info?.banking_details?.bank_branch_code || "Not configured"}</p><p style={{ margin: 0 }}><strong>Account type:</strong> {info?.banking_details?.bank_account_type || "Not configured"}</p></div></div>
              {terms.length ? <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Terms & conditions</h3><p className="db-helper" style={{ margin: 0 }}>Additional policy details, material updates and any request for fresh acceptance will be sent through the Parent Portal when required.</p>{terms.map((term) => <div key={term.id} className="db-soft-card" style={{ padding: 12 }}><strong>{term.title}</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>{term.content}</p></div>)}<label><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} disabled={isPreview} /> I accept the terms and conditions.</label></div> : null}
              <div style={{ display: "grid", gap: 10 }}><h3 style={{ margin: "0 0 2px" }}>Declaration</h3>{info?.enrolment_configuration?.additional_declaration ? <p className="db-helper" style={{ margin: 0 }}>{info.enrolment_configuration.additional_declaration}</p> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 5 }}><strong>Parent/guardian full name</strong><input className="db-input" value={declarationName} onChange={(event) => setDeclarationName(event.target.value)} disabled={isPreview} /></label><label style={{ display: "grid", gap: 5 }}><strong>Relationship to learner</strong><input className="db-input" value={declarationRelationship} onChange={(event) => setDeclarationRelationship(event.target.value)} disabled={isPreview} /></label></div></div>
              <div className="db-soft-card" style={{ padding: 12 }}><strong>Ready to submit</strong><p className="db-helper" style={{ margin: "4px 0 0" }}>Check that the information and requested documents are complete before submitting.</p></div>
            </div> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="db-button-secondary" type="button" disabled={step === 1 || savingDraft || submitting} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
              {!isPreview ? <button className="db-button-secondary" type="button" disabled={savingDraft || submitting} onClick={() => void saveDraft()}>{savingDraft ? "Saving draft..." : "Save Draft"}</button> : null}
            </div>
            {step < 4 ? <button className="db-button-primary" type="button" disabled={savingDraft || submitting} onClick={() => void continueToNextStep()}>{isPreview ? "Continue" : savingDraft ? "Saving..." : "Save & Continue"}</button> : <button className="db-button-primary" type="button" disabled={submitting || savingDraft || isPreview} onClick={() => void submit()}>{isPreview ? "Preview only" : submitting ? "Submitting..." : isStaffCapture ? "Submit Captured Form" : "Submit Enrolment Form"}</button>}
          </div>
        </section>
      ) : null}
    </main>
  );
}

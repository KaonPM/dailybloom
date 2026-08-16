import { NextResponse } from "next/server";
import {
  accessCookieName,
  hashEnrolmentSecret,
  hasMatchingSecret,
  readRequestCookie,
} from "@/app/lib/enrolment-form-security";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function fileName(value: unknown) {
  return text(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function findEnquiry(token: string) {
  if (!token || token.length < 30) return null;
  const { data } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, school_id, enquiry_reference, parent_name, status, form_token_expires_at, form_access_session_hash, form_access_session_expires_at, school_enrolment_forms(form_name, form_type, instructions, custom_fields, required_documents, stationery_list), schools(school_name, logo_url, primary_color)")
    .eq("form_token_hash", hashEnrolmentSecret(token))
    .maybeSingle();
  if (!data || !data.form_token_expires_at || new Date(data.form_token_expires_at).getTime() < Date.now()) return null;
  return data;
}

function hasFormAccess(
  request: Request,
  token: string,
  enquiry: {
    form_access_session_hash?: string | null;
    form_access_session_expires_at?: string | null;
  },
) {
  if (
    !enquiry.form_access_session_hash ||
    !enquiry.form_access_session_expires_at ||
    new Date(enquiry.form_access_session_expires_at).getTime() < Date.now()
  ) {
    return false;
  }

  return hasMatchingSecret(
    readRequestCookie(request, accessCookieName(token)),
    enquiry.form_access_session_hash,
  );
}

function accessCodeRequiredResponse() {
  return NextResponse.json(
    {
      requires_access_code: true,
      error:
        "Request and enter the WhatsApp verification code to open this secure enrolment form.",
    },
    { status: 401 },
  );
}

function savedCustomAnswers(value: unknown, fields: unknown) {
  const answers = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const configuredFields = Array.isArray(fields) ? fields : [];
  const result: Record<string, string> = {};
  for (const field of configuredFields) {
    if (!field || typeof field !== "object") continue;
    const definition = field as Record<string, unknown>;
    const id = text(definition.id, 80);
    const label = text(definition.label, 120);
    if (!id || !label) continue;
    const answer = text(answers[id], 2000);
    if (definition.required === true && !answer) {
      throw new Error(`Complete “${label}” before submitting.`);
    }
    if (answer) result[id] = answer;
  }
  return result;
}

function uploadedDocuments(value: unknown, requirements: unknown, enquiry: { school_id: number; id: string }) {
  const uploads = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const configured = Array.isArray(requirements) ? requirements.slice(0, 10).flatMap((item) => {
    if (typeof item === "string") return [{ title: text(item, 180), is_required: true }];
    if (!item || typeof item !== "object") return [];
    const field = item as Record<string, unknown>;
    const title = text(field.title, 180);
    return title ? [{ title, is_required: field.is_required === true }] : [];
  }) : [];
  const result: Record<string, { name: string; path: string }> = {};
  for (const { title: documentName, is_required } of configured) {
    const upload = uploads[documentName];
    const item = upload && typeof upload === "object" ? upload as Record<string, unknown> : null;
    const path = text(item?.path, 500);
    if (is_required && !path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) {
      throw new Error(`Upload “${documentName}” before submitting.`);
    }
    if (path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) result[documentName] = { name: text(item?.name, 180) || documentName, path };
  }
  return result;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const enquiry = await findEnquiry(token);
  if (!enquiry || !["form_issued", "submitted"].includes(String(enquiry.status))) {
    return NextResponse.json({ error: "This enrolment link is invalid or has expired." }, { status: 404 });
  }
  if (!hasFormAccess(request, token, enquiry)) {
    return accessCodeRequiredResponse();
  }
  const school = one(enquiry.schools as { school_name?: string; logo_url?: string; primary_color?: string } | { school_name?: string; logo_url?: string; primary_color?: string }[] | null);
  const form = one(enquiry.school_enrolment_forms as Record<string, unknown> | Record<string, unknown>[] | null);
  const { data: configuration, error: configurationError } = await supabaseAdmin
    .from("school_enrolment_configurations")
    .select("form_title, introduction, is_open, second_guardian_mode, emergency_contact_mode, previous_school_enabled, additional_declaration, custom_fields")
    .eq("school_id", enquiry.school_id)
    .maybeSingle();
  if (configurationError) return NextResponse.json({ error: configurationError.message }, { status: 500 });
  if (configuration?.is_open === false) return NextResponse.json({ error: "Enrolments are not open at the moment. Please contact the school." }, { status: 403 });
  const [{ data: documents }, { data: requirements }, { data: consents }, { data: terms }] = await Promise.all([
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("category, item_name, quantity, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("id, title, wording, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("id, title, content, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
  ]);
  return NextResponse.json({
    reference: enquiry.enquiry_reference,
    parent_name: enquiry.parent_name,
    status: enquiry.status,
    school_name: school?.school_name || "School",
    school_logo_url: school?.logo_url || null,
    school_primary_color: school?.primary_color || null,
    form: { ...form, form_name: configuration?.form_title || form?.form_name, instructions: configuration?.introduction || form?.instructions, custom_fields: configuration ? configuration.custom_fields : form?.custom_fields },
    enrolment_configuration: configuration,
    document_requirements: documents || [], requirement_templates: requirements || [], consents: consents || [], terms: terms || [],
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = text(body.token, 200);
  const enquiry = await findEnquiry(token);
  if (!enquiry || enquiry.status !== "form_issued") {
    return NextResponse.json({ error: "This enrolment link is invalid, expired or already submitted." }, { status: 400 });
  }
  if (!hasFormAccess(request, token, enquiry)) {
    return accessCodeRequiredResponse();
  }
  if (body.action === "create_document_upload") {
    const size = Number(body.file_size || 0);
    const contentType = text(body.content_type, 100).toLowerCase();
    if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENT_BYTES || !ALLOWED_DOCUMENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Use a PDF, JPG, PNG or WEBP document no larger than 10 MB." }, { status: 400 });
    }
    const path = `${enquiry.school_id}/enrolment-submissions/${enquiry.id}/${Date.now()}-${fileName(body.file_name)}`;
    const { data, error } = await supabaseAdmin.storage.from("school-enrolment-forms").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || "Could not prepare the document upload." }, { status: 500 });
    return NextResponse.json({ path, signed_url: data.signedUrl, token: data.token });
  }
  const learnerFirstName = text(body.learner_first_name, 120);
  const learnerSurname = text(body.learner_surname, 120);
  const dateOfBirth = text(body.date_of_birth, 30);
  const guardianName = text(body.guardian_name, 180);
  const guardianPhone = text(body.guardian_phone, 40);
  const parentPortalPhone = toSouthAfricanSmsNumber(text(body.parent_portal_phone, 40));
  if (!learnerFirstName || !learnerSurname || !dateOfBirth || !guardianName || !guardianPhone || !parentPortalPhone) {
    return NextResponse.json({ error: "Complete the learner, parent or guardian and Parent Portal mobile number before submitting." }, { status: 400 });
  }
  const form = one(enquiry.school_enrolment_forms as Record<string, unknown> | Record<string, unknown>[] | null);
  const [{ data: configuration }, { data: configuredDocuments }, { data: requirements }, { data: consents }, { data: terms }] = await Promise.all([
    supabaseAdmin.from("school_enrolment_configurations").select("form_title, introduction, is_open, second_guardian_mode, emergency_contact_mode, previous_school_enabled, additional_declaration, custom_fields").eq("school_id", enquiry.school_id).maybeSingle(),
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("category, item_name, quantity, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("id, title, wording, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("title, content, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
  ]);
  if (configuration?.is_open === false) return NextResponse.json({ error: "Enrolments are currently closed by the school." }, { status: 403 });
  const consentResponses = body.consent_responses && typeof body.consent_responses === "object" && !Array.isArray(body.consent_responses) ? body.consent_responses as Record<string, unknown> : {};
  const missingConsent = (consents || []).find((consent) => consent.is_required && consentResponses[String(consent.id)] !== true);
  if (missingConsent) return NextResponse.json({ error: `Please accept “${missingConsent.title}” before submitting.` }, { status: 400 });
  if ((terms || []).length && body.terms_accepted !== true) return NextResponse.json({ error: "Accept the school terms and conditions before submitting." }, { status: 400 });
  const declarationName = text(body.declaration_name, 180);
  const declarationRelationship = text(body.declaration_relationship, 80);
  if (!declarationName || !declarationRelationship) return NextResponse.json({ error: "Complete the declaration name and relationship before submitting." }, { status: 400 });
  let customAnswers: Record<string, string>;
  try {
    customAnswers = savedCustomAnswers(
      body.custom_answers,
      configuration ? configuration.custom_fields : form?.custom_fields,
    );
  } catch (validationError) {
    return NextResponse.json({ error: validationError instanceof Error ? validationError.message : "Complete the required custom questions." }, { status: 400 });
  }
  let documents: Record<string, { name: string; path: string }>;
  try {
    documents = uploadedDocuments(body.uploaded_documents, configuredDocuments || form?.required_documents, enquiry);
  } catch (validationError) {
    return NextResponse.json({ error: validationError instanceof Error ? validationError.message : "Upload the required documents before submitting." }, { status: 400 });
  }
  const submittedData = {
    learner_first_name: learnerFirstName,
    learner_surname: learnerSurname,
    date_of_birth: dateOfBirth,
    gender: text(body.gender, 40),
    learner_id_or_birth_certificate: text(body.learner_id_or_birth_certificate, 120),
    guardian_name: guardianName,
    guardian_relationship: text(body.guardian_relationship, 80),
    guardian_phone: guardianPhone,
    parent_portal_phone: parentPortalPhone,
    guardian_email: text(body.guardian_email, 180),
    home_address: text(body.home_address, 1000),
    medical_notes: text(body.medical_notes, 2000),
    custom_answers: customAnswers,
    consent_responses: (consents || []).map((consent) => ({ title: consent.title, wording: consent.wording, required: consent.is_required, accepted: consentResponses[String(consent.id)] === true })),
    terms_accepted: body.terms_accepted === true,
    declaration: { name: declarationName, relationship: declarationRelationship, acknowledged_at: new Date().toISOString() },
    uploaded_documents: documents,
    submitted_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .update({
      status: "submitted",
      submitted_data: submittedData,
      configuration_snapshot: { configuration: configuration || {}, documents: configuredDocuments || [], requirements: requirements || [], consents: consents || [], terms: terms || [] },
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      form_access_session_hash: null,
      form_access_session_expires_at: null,
      form_access_otp_hash: null,
      form_access_otp_expires_at: null,
    })
    .eq("id", enquiry.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

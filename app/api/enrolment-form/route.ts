import { NextResponse } from "next/server";
import {
  hashEnrolmentSecret,
} from "@/app/lib/enrolment-form-security";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PARENT_DECLARATION = "I confirm that the information provided in this enrolment application is true and complete to the best of my knowledge and that I have read and accepted the applicable school terms and requirements.";

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function fileName(value: unknown) {
  return text(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function selectedRequirementTemplateKeys(configuration: Record<string, unknown> | null | undefined) {
  const keys = Array.isArray(configuration?.requirement_template_keys)
    ? configuration.requirement_template_keys.filter((key): key is string => ["0_2", "2_6", "babies", "toddlers", "grade_r"].includes(String(key)))
    : ["0_2", "2_6"];
  return keys;
}

function requirementItemKey(item: { template_key?: unknown; category?: unknown; item_name?: unknown }) {
  return `${text(item.template_key, 20)}|${text(item.category, 20)}|${text(item.item_name, 180)}`;
}

function southAfricanIdDetails(value: unknown) {
  const id = text(value, 120).replace(/\D/g, "");
  if (id.length !== 13) return null;
  const currentYear = new Date().getFullYear();
  const yearPart = Number(id.slice(0, 2));
  const year = 2000 + yearPart > currentYear ? 1900 + yearPart : 2000 + yearPart;
  const month = Number(id.slice(2, 4));
  const day = Number(id.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { date_of_birth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, gender: Number(id.slice(6, 10)) >= 5000 ? "Male" : "Female" };
}

function ageInMonths(dateOfBirth: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return null;
  return Math.max(0, (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0));
}

function matchingRequirementTemplateKey(requirements: Array<{ template_key?: unknown; available_from_months?: unknown; available_to_months?: unknown }>, dateOfBirth: string) {
  const ageMonths = ageInMonths(dateOfBirth);
  if (ageMonths === null) return null;
  for (const key of ["babies", "toddlers", "grade_r", "0_2", "2_6"]) {
    if (requirements.some((item) => String(item.template_key) === key && ageMonths >= Number(item.available_from_months ?? 0) && ageMonths <= Number(item.available_to_months ?? 84))) return key;
  }
  return null;
}

const DRAFT_TEXT_FIELDS = {
  learner_first_name: 120,
  learner_surname: 120,
  date_of_birth: 30,
  gender: 40,
  learner_id_or_birth_certificate: 120,
  guardian_name: 180,
  guardian_relationship: 80,
  guardian_id_or_passport: 120,
  guardian_phone: 40,
  guardian_daytime_phone: 40,
  parent_portal_phone: 40,
  guardian_email: 180,
  guardian_employer: 180,
  guardian_occupation: 120,
  guardian_work_phone: 40,
  second_guardian_name: 180,
  second_guardian_id_or_passport: 120,
  second_guardian_phone: 40,
  emergency_contact_name: 180,
  emergency_contact_phone: 40,
  previous_school: 180,
  home_address: 1000,
  allergies: 2000,
  medical_conditions: 2000,
  medical_aid_name: 180,
  medical_aid_number: 120,
  medical_aid_main_member: 180,
  preferred_doctor_name: 180,
  preferred_doctor_phone: 40,
  immunisation_status: 40,
  immunisation_notes: 1000,
} as const;

function draftTextValues(value: unknown) {
  const source = record(value);
  const employment = record(source.guardian_employment);
  const secondGuardian = record(source.second_guardian);
  const emergencyContact = record(source.emergency_contact);
  const medical = record(source.medical);
  const result: Record<string, string> = {};
  for (const [key, max] of Object.entries(DRAFT_TEXT_FIELDS)) {
    let fieldValue = source[key];
    if (key === "guardian_employer") fieldValue ||= employment.employer;
    if (key === "guardian_occupation") fieldValue ||= employment.occupation;
    if (key === "guardian_work_phone") fieldValue ||= employment.work_phone;
    if (key === "second_guardian_name") fieldValue ||= secondGuardian.name;
    if (key === "second_guardian_id_or_passport") fieldValue ||= secondGuardian.id_or_passport;
    if (key === "second_guardian_phone") fieldValue ||= secondGuardian.phone;
    if (key === "emergency_contact_name") fieldValue ||= emergencyContact.name;
    if (key === "emergency_contact_phone") fieldValue ||= emergencyContact.phone;
    if (key === "allergies") fieldValue ||= medical.allergies;
    if (key === "medical_conditions") fieldValue ||= medical.conditions;
    if (key === "medical_aid_name") fieldValue ||= medical.medical_aid_name;
    if (key === "medical_aid_number") fieldValue ||= medical.medical_aid_number;
    if (key === "medical_aid_main_member") fieldValue ||= medical.medical_aid_main_member;
    if (key === "preferred_doctor_name") fieldValue ||= medical.preferred_doctor_name;
    if (key === "preferred_doctor_phone") fieldValue ||= medical.preferred_doctor_phone;
    if (key === "immunisation_status") fieldValue ||= medical.immunisation_status;
    if (key === "immunisation_notes") fieldValue ||= medical.immunisation_notes;
    result[key] = text(fieldValue, max);
  }
  return result;
}

function draftStringMap(value: unknown) {
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(record(value)).slice(0, 24)) {
    const key = text(rawKey, 80);
    const answer = text(rawValue, 2000);
    if (key && answer) result[key] = answer;
  }
  return result;
}

function draftBooleanMap(value: unknown) {
  const result: Record<string, boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(record(value)).slice(0, 40)) {
    const key = text(rawKey, 80);
    if (key && typeof rawValue === "boolean") result[key] = rawValue;
  }
  return result;
}

function restoredConsentResponses(value: unknown) {
  if (!Array.isArray(value)) return draftBooleanMap(value);
  const result: Record<string, boolean> = {};
  for (const item of value.slice(0, 40)) {
    const consent = record(item);
    const id = text(consent.id, 80);
    if (id) result[id] = consent.accepted === true;
  }
  return result;
}

function safeDraftDocuments(value: unknown, enquiry: { school_id: number; id: string }) {
  const result: Record<string, { name: string; path: string }> = {};
  const prefix = `${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`;
  for (const [rawTitle, rawUpload] of Object.entries(record(value)).slice(0, 20)) {
    const title = text(rawTitle, 180);
    const upload = record(rawUpload);
    const path = text(upload.path, 500);
    if (title && path.startsWith(prefix)) {
      result[title] = { name: text(upload.name, 180) || title, path };
    }
  }
  return result;
}

function buildDraftData(body: Record<string, unknown>, enquiry: { school_id: number; id: string }, savedAt: string) {
  const declaration = record(body.declaration);
  const draftFields = draftTextValues(body);
  const learnerIdDetails = southAfricanIdDetails(draftFields.learner_id_or_birth_certificate);
  return {
    ...draftFields,
    date_of_birth: draftFields.date_of_birth || learnerIdDetails?.date_of_birth || "",
    gender: draftFields.gender || learnerIdDetails?.gender || "",
    custom_answers: draftStringMap(body.custom_answers),
    consent_responses: draftBooleanMap(body.consent_responses),
    terms_accepted: body.terms_accepted === true,
    declaration_name: text(body.declaration_name || declaration.name, 180),
    declaration_relationship: text(body.declaration_relationship || declaration.relationship, 80),
    uploaded_documents: safeDraftDocuments(body.uploaded_documents, enquiry),
    purchased_requirement_items: draftBooleanMap(body.purchased_requirement_items),
    requested_recurring_addon_ids: Array.isArray(body.requested_recurring_addon_ids)
      ? body.requested_recurring_addon_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0).slice(0, 20)
      : [],
    selected_monthly_fee_id: Number.isInteger(Number(body.selected_monthly_fee_id)) ? Number(body.selected_monthly_fee_id) : null,
    _draft_saved_at: savedAt,
  };
}

async function findEnquiry(token: string) {
  if (!token || token.length < 30) return null;
  const { data } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, school_id, enquiry_reference, parent_name, parent_phone, submitted_data, status, form_token_expires_at, form_access_session_hash, form_access_session_expires_at, school_enrolment_forms(form_name, form_type, instructions, custom_fields, required_documents, stationery_list), schools(school_name, logo_url, primary_color, contact_number, emis_number)")
    .eq("form_token_hash", hashEnrolmentSecret(token))
    .maybeSingle();
  if (!data || !data.form_token_expires_at || new Date(data.form_token_expires_at).getTime() < Date.now()) return null;
  return data;
}

async function findStaffCaptureEnquiry(request: Request, enquiryId: string, schoolId: number) {
  if (!enquiryId || !Number.isInteger(schoolId) || schoolId <= 0) return { enquiry: null, response: NextResponse.json({ error: "Choose a valid paper enrolment." }, { status: 400 }) };
  const authorization = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!authorization.ok) return { enquiry: null, response: authorization.response };
  const { data, error } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, school_id, enquiry_reference, parent_name, parent_phone, submitted_data, status, enrolment_source, paper_received_at, form_token_expires_at, form_access_session_hash, form_access_session_expires_at, school_enrolment_forms(form_name, form_type, instructions, custom_fields, required_documents, stationery_list), schools(school_name, logo_url, primary_color, contact_number, emis_number)")
    .eq("id", enquiryId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error || !data || !["printed_blank_form", "paper_manual_capture"].includes(String(data.enrolment_source)) || !data.paper_received_at || !["payment_pending", "form_issued"].includes(String(data.status))) {
    return { enquiry: null, response: NextResponse.json({ error: error?.message || "This returned paper form is not available for capture." }, { status: 404 }) };
  }
  return { enquiry: data, authorization, response: null };
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

type EnrolmentFee = { id?: number | string | null; fee_code?: string | null; fee_name?: string | null; fee_category?: string | null; amount?: number | string | null };
type EnrolmentTerm = { id: string; title: string; content: string; display_order?: number };
type EnrolmentConfiguration = {
  form_title?: string | null;
  introduction?: string | null;
  is_open?: boolean | null;
  second_guardian_mode?: "hidden" | "optional" | "required" | null;
  emergency_contact_mode?: "hidden" | "optional" | "required" | null;
  previous_school_enabled?: boolean | null;
  additional_declaration?: string | null;
  custom_fields?: unknown;
};

async function loadEnrolmentConfiguration(schoolId: number) {
  const fullResult = await supabaseAdmin
    .from("school_enrolment_configurations")
    .select("form_title, introduction, is_open, second_guardian_mode, emergency_contact_mode, previous_school_enabled, additional_declaration, custom_fields")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!fullResult.error || !fullResult.error.message.includes("custom_fields")) {
    return { data: fullResult.data as EnrolmentConfiguration | null, error: fullResult.error };
  }
  const compatibleResult = await supabaseAdmin
    .from("school_enrolment_configurations")
    .select("form_title, introduction, is_open, second_guardian_mode, emergency_contact_mode, previous_school_enabled, additional_declaration")
    .eq("school_id", schoolId)
    .maybeSingle();
  return { data: compatibleResult.data as EnrolmentConfiguration | null, error: compatibleResult.error };
}

function termsWithConfiguredFees(terms: EnrolmentTerm[] | null, fees: EnrolmentFee[] | null) {
  return (terms || []).map((term) => {
    const title = term.title.trim().toLowerCase();
    let applicable: EnrolmentFee[] = [];
    if (title === "registration fee") applicable = (fees || []).filter((fee) => fee.fee_code === "registration");
    else if (title === "fees and payment obligations") applicable = (fees || []).filter((fee) => fee.fee_category === "monthly");
    else if (title === "aftercare") applicable = (fees || []).filter((fee) => `${fee.fee_code || ""} ${fee.fee_name || ""}`.toLowerCase().includes("aftercare"));
    else if (title === "late collection") applicable = (fees || []).filter((fee) => `${fee.fee_code || ""} ${fee.fee_name || ""}`.toLowerCase().includes("late collect"));
    if (!applicable.length) return term;
    const amounts = applicable.map((fee) => `${fee.fee_name || "Applicable fee"}: ${new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(fee.amount || 0))}`).join("; ");
    return { ...term, content: `${term.content}\n\nCurrent amount from School Fees: ${amounts}` };
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") || "";
  const staffCaptureId = params.get("staff_capture_id") || "";
  const staffSchoolId = Number(params.get("school_id"));
  const staffResult = staffCaptureId ? await findStaffCaptureEnquiry(request, staffCaptureId, staffSchoolId) : null;
  if (staffResult?.response) return staffResult.response;
  const enquiry = staffResult?.enquiry || await findEnquiry(token);
  if (!enquiry || (!staffCaptureId && enquiry.status !== "form_issued")) {
    return NextResponse.json({ error: "This enrolment link is no longer valid. Please contact the preschool for a new secure link." }, { status: 404 });
  }
  const school = one(enquiry.schools as { school_name?: string; logo_url?: string; primary_color?: string; contact_number?: string; emis_number?: string } | { school_name?: string; logo_url?: string; primary_color?: string; contact_number?: string; emis_number?: string }[] | null);
  const form = one(enquiry.school_enrolment_forms as Record<string, unknown> | Record<string, unknown>[] | null);
  const { data: configuration, error: configurationError } = await loadEnrolmentConfiguration(enquiry.school_id);
  if (configurationError) return NextResponse.json({ error: configurationError.message }, { status: 500 });
  if (!staffCaptureId && configuration?.is_open === false) return NextResponse.json({ error: "Enrolments are not open at the moment. Please contact the school." }, { status: 403 });
  const [{ data: documents }, { data: requirements }, { data: consents }, { data: terms }, { data: fees }, { data: settings }, { data: registration }, { data: signupRows }] = await Promise.all([
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("template_key, available_from_months, available_to_months, category, item_name, quantity, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("template_key").order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("id, title, wording, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("id, title, content, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_fee_types").select("id, fee_code, fee_name, fee_category, amount").eq("school_id", enquiry.school_id).eq("is_active", true),
    supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code, bank_account_type").eq("school_id", enquiry.school_id).maybeSingle(),
    supabaseAdmin.from("dbe_registration").select("registration_number, email_address, physical_address, contact_number").eq("school_id", enquiry.school_id).maybeSingle(),
    supabaseAdmin.from("school_signup_requests").select("school_email, school_phone, school_address").eq("school_id", enquiry.school_id).order("created_at", { ascending: false }).limit(1),
  ]);
  const presentedTerms = termsWithConfiguredFees(terms as EnrolmentTerm[] | null, fees);
  const signup = signupRows?.[0];
  const initialValues = enquiry.submitted_data && typeof enquiry.submitted_data === "object" && !Array.isArray(enquiry.submitted_data)
    ? enquiry.submitted_data as Record<string, unknown>
    : {};
  const declaration = record(initialValues.declaration);
  return NextResponse.json({
    reference: enquiry.enquiry_reference,
    parent_name: enquiry.parent_name,
    initial_values: {
      ...draftTextValues(initialValues),
      guardian_name: text(initialValues.guardian_name, 180) || enquiry.parent_name,
      guardian_phone: text(initialValues.guardian_phone, 40) || text(enquiry.parent_phone, 40),
      parent_portal_phone: text(initialValues.parent_portal_phone, 40) || text(enquiry.parent_phone, 40),
    },
    initial_custom_answers: draftStringMap(initialValues.custom_answers),
    initial_consent_responses: restoredConsentResponses(initialValues.consent_responses),
    initial_terms_accepted: initialValues.terms_accepted === true,
    initial_declaration_name: text(initialValues.declaration_name || declaration.name, 180),
    initial_declaration_relationship: text(initialValues.declaration_relationship || declaration.relationship, 80),
    initial_uploaded_documents: safeDraftDocuments(initialValues.uploaded_documents, enquiry),
    initial_purchased_requirement_items: draftBooleanMap(initialValues.purchased_requirement_items),
    initial_requested_recurring_addon_ids: Array.isArray(initialValues.requested_recurring_addon_ids) ? initialValues.requested_recurring_addon_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0) : [],
    initial_selected_monthly_fee_id: Number.isInteger(Number(initialValues.selected_monthly_fee_id)) ? Number(initialValues.selected_monthly_fee_id) : null,
    draft_saved_at: text(initialValues._draft_saved_at, 50) || null,
    status: enquiry.status,
    school_name: school?.school_name || "School",
    school_logo_url: school?.logo_url || null,
    school_primary_color: school?.primary_color || null,
    school_registration_number: registration?.registration_number || school?.emis_number || null,
    school_contact_number: registration?.contact_number || signup?.school_phone || school?.contact_number || null,
    school_email_address: registration?.email_address || signup?.school_email || null,
    school_physical_address: registration?.physical_address || signup?.school_address || null,
    form: { ...form, form_name: configuration?.form_title || form?.form_name, instructions: configuration?.introduction || form?.instructions, custom_fields: configuration?.custom_fields || form?.custom_fields },
    enrolment_configuration: configuration ? { ...configuration, additional_declaration: configuration.additional_declaration || DEFAULT_PARENT_DECLARATION } : { additional_declaration: DEFAULT_PARENT_DECLARATION },
    document_requirements: documents || [], requirement_templates: (requirements || []).filter((item) => selectedRequirementTemplateKeys(configuration).includes(String(item.template_key))), consents: consents || [], terms: presentedTerms,
    fees: fees || [], banking_details: settings || null,
    staff_capture: Boolean(staffCaptureId),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = text(body.token, 200);
  const staffCaptureId = text(body.staff_capture_id, 80);
  const staffSchoolId = Number(body.school_id);
  const staffResult = staffCaptureId ? await findStaffCaptureEnquiry(request, staffCaptureId, staffSchoolId) : null;
  if (staffResult?.response) return staffResult.response;
  const enquiry = staffResult?.enquiry || await findEnquiry(token);
  if (!enquiry || (!staffCaptureId && enquiry.status !== "form_issued")) {
    return NextResponse.json({ error: "This enrolment link is invalid, expired or already submitted." }, { status: 400 });
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
  const draftSavedAt = new Date().toISOString();
  const draftData = buildDraftData(body, enquiry, draftSavedAt);
  const { error: draftError } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .update({ submitted_data: draftData, updated_at: draftSavedAt })
    .eq("id", enquiry.id)
    .eq("school_id", enquiry.school_id);
  if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });
  if (body.action === "save_draft") {
    return NextResponse.json({ success: true, saved_at: draftSavedAt });
  }
  const draftValidationError = (message: string, status = 400) => NextResponse.json(
    { error: message, draft_saved: true, saved_at: draftSavedAt },
    { status },
  );
  const learnerFirstName = text(body.learner_first_name, 120);
  const learnerSurname = text(body.learner_surname, 120);
  const learnerIdentityNumber = text(body.learner_id_or_birth_certificate, 120);
  const learnerIdDetails = southAfricanIdDetails(learnerIdentityNumber);
  const dateOfBirth = text(body.date_of_birth, 30) || learnerIdDetails?.date_of_birth || "";
  const guardianName = text(body.guardian_name, 180);
  const guardianIdOrPassport = text(body.guardian_id_or_passport, 120);
  const guardianPhone = text(body.guardian_phone, 40);
  const parentPortalPhone = toSouthAfricanSmsNumber(text(body.parent_portal_phone, 40));
  if (!learnerFirstName || !learnerSurname || !dateOfBirth || !guardianName || !guardianIdOrPassport || !guardianPhone || !parentPortalPhone) {
    return draftValidationError("Complete the learner, responsible guardian ID or passport, guardian contact and Parent Portal mobile number before submitting.");
  }
  const form = one(enquiry.school_enrolment_forms as Record<string, unknown> | Record<string, unknown>[] | null);
  const [{ data: configuration }, { data: configuredDocuments }, { data: requirements }, { data: consents }, { data: terms }, { data: fees }] = await Promise.all([
    loadEnrolmentConfiguration(enquiry.school_id),
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("template_key, available_from_months, available_to_months, category, item_name, quantity, instructions, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("template_key").order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("id, title, wording, is_required, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("id, title, content, display_order").eq("school_id", enquiry.school_id).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_fee_types").select("id, fee_code, fee_name, fee_category, amount").eq("school_id", enquiry.school_id).eq("is_active", true),
  ]);
  const presentedTerms = termsWithConfiguredFees(terms as EnrolmentTerm[] | null, fees);
  const configuredRequirements = (requirements || []).filter((item) => selectedRequirementTemplateKeys(configuration).includes(String(item.template_key)));
  const matchingRequirementTemplate = matchingRequirementTemplateKey(configuredRequirements, dateOfBirth);
  const selectedRequirements = matchingRequirementTemplate ? configuredRequirements.filter((item) => String(item.template_key) === matchingRequirementTemplate) : [];
  const monthlyFees = (fees || []).filter((fee) => fee.fee_category === "monthly");
  const selectedMonthlyFeeId = Number(body.selected_monthly_fee_id);
  if (monthlyFees.length > 1 && !monthlyFees.some((fee) => Number(fee.id) === selectedMonthlyFeeId)) {
    return draftValidationError("Choose one of the available monthly school-fee options before submitting.");
  }
  if (!staffCaptureId && configuration?.is_open === false) return draftValidationError("Enrolments are currently closed by the school.", 403);
  const consentResponses = body.consent_responses && typeof body.consent_responses === "object" && !Array.isArray(body.consent_responses) ? body.consent_responses as Record<string, unknown> : {};
  const missingConsent = (consents || []).find((consent) => consent.is_required && consentResponses[String(consent.id)] !== true);
  if (missingConsent) return draftValidationError(`Please accept “${missingConsent.title}” before submitting.`);
  if (presentedTerms.length && body.terms_accepted !== true) return draftValidationError("Accept the school terms and conditions before submitting.");
  const declarationName = text(body.declaration_name, 180);
  const declarationRelationship = text(body.declaration_relationship, 80);
  if (!declarationName || !declarationRelationship) return draftValidationError("Complete the declaration name and relationship before submitting.");
  const secondGuardianName = text(body.second_guardian_name, 180);
  const secondGuardianIdOrPassport = text(body.second_guardian_id_or_passport, 120);
  const secondGuardianPhone = text(body.second_guardian_phone, 40);
  const emergencyContactName = text(body.emergency_contact_name, 180);
  const emergencyContactPhone = text(body.emergency_contact_phone, 40);
  if (configuration?.second_guardian_mode === "required" && (!secondGuardianName || !secondGuardianIdOrPassport || !secondGuardianPhone)) {
    return draftValidationError("Complete the required second parent or guardian details.");
  }
  if (configuration?.second_guardian_mode === "optional" && (secondGuardianName || secondGuardianIdOrPassport || secondGuardianPhone) && (!secondGuardianName || !secondGuardianIdOrPassport || !secondGuardianPhone)) {
    return draftValidationError("Complete the second parent or guardian name, ID or passport number and mobile number.");
  }
  if (configuration?.emergency_contact_mode === "required" && (!emergencyContactName || !emergencyContactPhone)) {
    return draftValidationError("Complete the required emergency contact details.");
  }
  let customAnswers: Record<string, string>;
  try {
    customAnswers = savedCustomAnswers(
      body.custom_answers,
      configuration?.custom_fields || form?.custom_fields,
    );
  } catch (validationError) {
    return draftValidationError(validationError instanceof Error ? validationError.message : "Complete the required custom questions.");
  }
  let documents: Record<string, { name: string; path: string }>;
  try {
    documents = uploadedDocuments(body.uploaded_documents, configuredDocuments || form?.required_documents, enquiry);
  } catch (validationError) {
    return draftValidationError(validationError instanceof Error ? validationError.message : "Upload the required documents before submitting.");
  }
  if (configuration?.second_guardian_mode === "required") {
    const documentName = "Second parent/guardian identification document";
    const uploads = body.uploaded_documents && typeof body.uploaded_documents === "object" && !Array.isArray(body.uploaded_documents) ? body.uploaded_documents as Record<string, unknown> : {};
    const upload = uploads[documentName] && typeof uploads[documentName] === "object" ? uploads[documentName] as Record<string, unknown> : null;
    const path = text(upload?.path, 500);
    if (!path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) {
      return draftValidationError(`Upload “${documentName}” before submitting.`);
    }
    documents[documentName] = { name: text(upload?.name, 180) || documentName, path };
  }
  const responsibleDocumentName = "Responsible parent/guardian identification document";
  const configuredResponsibleId = (configuredDocuments || []).find((item) => /(parent|guardian).*(id|identity|passport)|(id|identity|passport).*(parent|guardian)/i.test(String(item.title || "")) && String(item.title || "") !== "Second parent/guardian identification document");
  const configuredHasResponsibleId = Boolean(configuredResponsibleId);
  if (configuredResponsibleId && !documents[String(configuredResponsibleId.title)]) {
    const documentName = String(configuredResponsibleId.title);
    const uploads = body.uploaded_documents && typeof body.uploaded_documents === "object" && !Array.isArray(body.uploaded_documents) ? body.uploaded_documents as Record<string, unknown> : {};
    const upload = uploads[documentName] && typeof uploads[documentName] === "object" ? uploads[documentName] as Record<string, unknown> : null;
    const path = text(upload?.path, 500);
    if (!path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) return draftValidationError(`Upload “${documentName}” before submitting.`);
    documents[documentName] = { name: text(upload?.name, 180) || documentName, path };
  }
  if (!configuredHasResponsibleId) {
    const uploads = body.uploaded_documents && typeof body.uploaded_documents === "object" && !Array.isArray(body.uploaded_documents) ? body.uploaded_documents as Record<string, unknown> : {};
    const upload = uploads[responsibleDocumentName] && typeof uploads[responsibleDocumentName] === "object" ? uploads[responsibleDocumentName] as Record<string, unknown> : null;
    const path = text(upload?.path, 500);
    if (!path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) return draftValidationError(`Upload “${responsibleDocumentName}” before submitting.`);
    documents[responsibleDocumentName] = { name: text(upload?.name, 180) || responsibleDocumentName, path };
  }
  if (configuration?.second_guardian_mode !== "hidden" && (secondGuardianName || secondGuardianPhone)) {
    const documentName = "Second parent/guardian identification document";
    if (!documents[documentName]) {
      const uploads = body.uploaded_documents && typeof body.uploaded_documents === "object" && !Array.isArray(body.uploaded_documents) ? body.uploaded_documents as Record<string, unknown> : {};
      const upload = uploads[documentName] && typeof uploads[documentName] === "object" ? uploads[documentName] as Record<string, unknown> : null;
      const path = text(upload?.path, 500);
      if (!path.startsWith(`${enquiry.school_id}/enrolment-submissions/${enquiry.id}/`)) return draftValidationError(`Upload “${documentName}” before submitting.`);
      documents[documentName] = { name: text(upload?.name, 180) || documentName, path };
    }
  }
  const submittedData = {
    learner_first_name: learnerFirstName,
    learner_surname: learnerSurname,
    date_of_birth: dateOfBirth,
    gender: text(body.gender, 40) || learnerIdDetails?.gender || "",
    learner_id_or_birth_certificate: learnerIdentityNumber,
    guardian_name: guardianName,
    guardian_relationship: text(body.guardian_relationship, 80),
    guardian_id_or_passport: guardianIdOrPassport,
    guardian_phone: guardianPhone,
    guardian_daytime_phone: text(body.guardian_daytime_phone, 40),
    parent_portal_phone: parentPortalPhone,
    guardian_email: text(body.guardian_email, 180),
    guardian_employment: { employer: text(body.guardian_employer, 180), occupation: text(body.guardian_occupation, 120), work_phone: text(body.guardian_work_phone, 40) },
    second_guardian: configuration?.second_guardian_mode === "hidden" ? null : { name: secondGuardianName, id_or_passport: secondGuardianIdOrPassport, phone: secondGuardianPhone },
    emergency_contact: configuration?.emergency_contact_mode === "hidden" ? null : { name: emergencyContactName, phone: emergencyContactPhone },
    previous_school: configuration?.previous_school_enabled ? text(body.previous_school, 180) : null,
    home_address: text(body.home_address, 1000),
    medical: { allergies: text(body.allergies, 2000), conditions: text(body.medical_conditions, 2000), medical_aid_name: text(body.medical_aid_name, 180), medical_aid_number: text(body.medical_aid_number, 120), medical_aid_main_member: text(body.medical_aid_main_member, 180), preferred_doctor_name: text(body.preferred_doctor_name, 180), preferred_doctor_phone: text(body.preferred_doctor_phone, 40), immunisation_status: text(body.immunisation_status, 40), immunisation_notes: text(body.immunisation_notes, 1000) },
    custom_answers: customAnswers,
    consent_responses: (consents || []).map((consent) => ({ id: consent.id, title: consent.title, wording: consent.wording, required: consent.is_required, accepted: consentResponses[String(consent.id)] === true, responded_at: new Date().toISOString() })),
    terms: presentedTerms.map((term) => ({ id: term.id, title: term.title, content: term.content, accepted: body.terms_accepted === true, accepted_at: new Date().toISOString() })),
    terms_accepted: body.terms_accepted === true,
    declaration: { statement: configuration?.additional_declaration || DEFAULT_PARENT_DECLARATION, name: declarationName, relationship: declarationRelationship, acknowledged_at: new Date().toISOString() },
    uploaded_documents: documents,
    selected_requirement_template_key: matchingRequirementTemplate,
    purchased_requirement_items: Object.fromEntries(Object.entries(draftBooleanMap(body.purchased_requirement_items)).filter(([key, purchased]) => purchased && selectedRequirements.some((item) => requirementItemKey(item) === key))),
    requested_recurring_addon_ids: Array.isArray(body.requested_recurring_addon_ids)
      ? body.requested_recurring_addon_ids.map((item: unknown) => Number(item)).filter((item: number) => Number.isInteger(item) && item > 0 && (fees || []).some((fee) => Number((fee as { id?: unknown }).id) === item && (fee as { fee_category?: unknown }).fee_category === "recurring_addon")).slice(0, 20)
      : [],
    selected_monthly_fee_id: monthlyFees.some((fee) => Number(fee.id) === selectedMonthlyFeeId) ? selectedMonthlyFeeId : (monthlyFees.length === 1 ? Number(monthlyFees[0].id) : null),
    submitted_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .update({
      status: "submitted",
      submitted_data: submittedData,
      configuration_snapshot: { configuration: configuration || {}, documents: configuredDocuments || [], requirements: selectedRequirements, consents: consents || [], terms: presentedTerms },
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      form_access_session_hash: null,
      form_access_session_expires_at: null,
      form_access_otp_hash: null,
      form_access_otp_expires_at: null,
      form_token_hash: null,
      form_token_expires_at: null,
    })
    .eq("id", enquiry.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (staffCaptureId && staffResult && "authorization" in staffResult && staffResult.authorization) {
    await writeSecurityAudit(staffResult.authorization.staff, "enrolment.paper_form_captured", { school_id: enquiry.school_id, enquiry_id: enquiry.id, reference: enquiry.enquiry_reference });
  }
  return NextResponse.json({ success: true });
}

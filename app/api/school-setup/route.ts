import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const FORM_TYPES = new Set(["general", "babies", "grade_r"]);
const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TEMPLATE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const CUSTOM_FIELD_TYPES = new Set(["text", "textarea", "select"]);

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function fileName(value: unknown) {
  return text(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_") || "enrolment-form";
}

function customFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((field, index) => {
    if (!field || typeof field !== "object") return [];
    const candidate = field as Record<string, unknown>;
    const label = text(candidate.label, 120);
    const type = text(candidate.type, 20);
    if (!label || !CUSTOM_FIELD_TYPES.has(type)) return [];
    const options = Array.isArray(candidate.options)
      ? candidate.options.map((option) => text(option, 80)).filter(Boolean).slice(0, 20)
      : [];
    if (type === "select" && options.length < 2) return [];
    return [{
      id: text(candidate.id, 80).replace(/[^a-zA-Z0-9_-]/g, "") || `question_${index + 1}`,
      label,
      type,
      required: candidate.required === true,
      ...(type === "select" ? { options } : {}),
    }];
  });
}

function textList(value: unknown, maximum = 20) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 180)).filter(Boolean).slice(0, maximum);
}

const CONFIGURATION_TABLES = {
  document: "school_enrolment_document_requirements",
  requirement: "school_enrolment_requirement_templates",
  consent: "school_enrolment_consents",
  term: "school_enrolment_terms_sections",
} as const;

const STARTER_DOCUMENTS = [
  { title: "Birth Certificate", instructions: "Upload a clear copy of the learner's birth certificate or identity document.", is_required: true, display_order: 1 },
  { title: "Immunisation / Clinic Card", instructions: "Upload the learner's most recent immunisation or clinic card.", is_required: true, display_order: 2 },
  { title: "Parent/Guardian ID", instructions: "Upload an identity document for the responsible parent or guardian.", is_required: true, display_order: 3 },
  { title: "Signed Parent/Guardian Enrolment Contract", instructions: "Upload the signed enrolment contract where applicable.", is_required: true, display_order: 4 },
];
const HYGIENE_REQUIREMENTS = [
  ["Toilet Rolls", "10"], ["Tissue Box", "3"], ["Wipes (80 per pack)", "6"],
  ["Big Vaseline", "3"], ["Lifebuoy Soap / Sunlight Bar Soap", "4"],
] as const;
const OLDER_LEARNER_STATIONERY = [
  ["Flip File (20 pages)", "1"], ["College Book Exercise (72 pages)", "1"], ["Colouring Book", "1"],
  ["Typek", "1"], ["Wax Crayons (box of 12)", "1"], ["Long Pencils", "4"], ["Rubber (eraser)", "1"],
  ["Glue Stick (Pritt)", "1"], ["Sharpener", "1"],
] as const;
const STARTER_REQUIREMENTS = [
  ...HYGIENE_REQUIREMENTS.map(([item_name, quantity], index) => ({ template_key: "0_2", available_from_months: 0, available_to_months: 24, category: "hygiene", item_name, quantity, instructions: null, is_required: true, display_order: index + 1 })),
  ...OLDER_LEARNER_STATIONERY.map(([item_name, quantity], index) => ({ template_key: "0_2", available_from_months: 6, available_to_months: 24, category: "stationery", item_name, quantity, instructions: null, is_required: true, display_order: HYGIENE_REQUIREMENTS.length + index + 1 })),
  ...HYGIENE_REQUIREMENTS.map(([item_name, quantity], index) => ({ template_key: "2_6", available_from_months: 24, available_to_months: 72, category: "hygiene", item_name, quantity, instructions: null, is_required: true, display_order: index + 1 })),
  ...OLDER_LEARNER_STATIONERY.map(([item_name, quantity], index) => ({ template_key: "2_6", available_from_months: 24, available_to_months: 72, category: "stationery", item_name, quantity, instructions: null, is_required: true, display_order: HYGIENE_REQUIREMENTS.length + index + 1 })),
];
const STARTER_CONSENTS = [
  { title: "Emergency Medical Treatment", wording: "I authorise the school to obtain reasonable emergency medical assistance for the learner when necessary and when the parent or guardian cannot be reached promptly.", is_required: true, display_order: 1 },
  { title: "Administration of Medication", wording: "I understand that medication may only be administered according to the school's procedures and any instructions or authorisation provided by the parent or guardian.", is_required: true, display_order: 2 },
  { title: "Educational Outings and Excursions", wording: "I give permission for the learner to participate in school-approved educational outings or excursions, subject to the school's applicable procedures. A detailed consent request for a specific outing or excursion will be sent through the Parent Portal when required by the school.", is_required: false, display_order: 3 },
  { title: "Electronic Communication", wording: "I consent to the school using the contact information supplied for relevant school communication, including WhatsApp, SMS, email or Parent Portal communication where applicable.", is_required: true, display_order: 4 },
  { title: "Processing of Learner and Parent Information", wording: "I consent to the school processing the learner and parent or guardian information supplied for enrolment, administration, learner support and related school purposes.", is_required: true, display_order: 5 },
];
const STARTER_TERMS = [
  { title: "Learner Information and Enrolment", content: "The parent or legal guardian confirms that the learner information supplied is accurate and agrees to notify the school promptly of any changes.", display_order: 1 },
  { title: "Health, Safety and Emergency Care", content: "The parent or legal guardian must disclose information reasonably required for the safe care of the learner, including medical conditions, allergies, medication and emergency contact information.", display_order: 2 },
  { title: "Fees and Payment Obligations", content: "The parent or legal guardian agrees to pay applicable school fees and charges according to the school's current fee structure and payment terms.", display_order: 3 },
  { title: "Registration Fee", content: "Add this school's registration-fee terms, including any applicable refund or transfer arrangements.", display_order: 4 },
  { title: "Operating Hours and Collection", content: "The parent or legal guardian agrees to observe the school's operating hours and collection arrangements, including any applicable late collection rules.", display_order: 5 },
  { title: "Late Collection", content: "Add this school's late collection policy, including any grace period or charges where applicable.", display_order: 6 },
  { title: "Aftercare", content: "Add this school's aftercare conditions, availability, collection arrangements and charges where applicable.", display_order: 7 },
  { title: "Illness and Attendance", content: "A learner who is ill, has a contagious condition, or presents a health risk to others may be required to remain at home in accordance with the school's health procedures.", display_order: 8 },
  { title: "Medication", content: "Parents or legal guardians must provide the school with relevant information and instructions regarding medication required by the learner.", display_order: 9 },
  { title: "Personal Belongings", content: "Personal belongings brought to school should be clearly marked with the learner's name. The school may apply its own rules regarding responsibility for lost or damaged items.", display_order: 10 },
  { title: "Notice and Withdrawal", content: "The parent or legal guardian agrees to comply with the school's applicable notice requirements when withdrawing the learner.", display_order: 11 },
  { title: "Refunds", content: "Add this school's refund policy and any conditions that apply.", display_order: 12 },
  { title: "Information Updates", content: "The parent or legal guardian must inform the school when important learner, parent, guardian, medical, address or contact information changes.", display_order: 13 },
  { title: "Parent Declaration", content: "I confirm that the information provided in this enrolment application is true and complete to the best of my knowledge and that I have read and accepted the applicable school terms and requirements.", display_order: 14 },
];
const DEFAULT_PARENT_DECLARATION = "I confirm that the information provided in this enrolment application is true and complete to the best of my knowledge and that I have read and accepted the applicable school terms and requirements.";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = Number(searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;

  const [{ data: settings, error: settingsError }, { data: forms, error: formsError }, { data: registrationFee, error: feeError }, { data: school, error: schoolError }, { data: enrolmentConfiguration, error: configurationError }, { data: documentRequirements, error: documentsError }, { data: requirementTemplates, error: requirementsError }, { data: consents, error: consentsError }, { data: terms, error: termsError }, { data: registration, error: registrationError }, { data: signupRows, error: signupError }] = await Promise.all([
    supabaseAdmin.from("school_setup_settings").select("*").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_forms").select("*").eq("school_id", schoolId).order("form_type"),
    supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
    supabaseAdmin.from("schools").select("school_name, logo_url, primary_color").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_configurations").select("*").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_document_requirements").select("*").eq("school_id", schoolId).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("*").eq("school_id", schoolId).order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("*").eq("school_id", schoolId).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("*").eq("school_id", schoolId).order("display_order"),
    supabaseAdmin.from("dbe_registration").select("registration_number, physical_address, contact_number, email_address").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_signup_requests").select("school_address, school_phone, school_email").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1),
  ]);
  const error = settingsError || formsError || feeError || schoolError || configurationError || documentsError || requirementsError || consentsError || termsError || registrationError || signupError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const audit = { school_id: schoolId, created_by: authorization.staff.userId, updated_by: authorization.staff.userId };
  const [seededDocuments, seededRequirements, seededConsents, seededTerms] = await Promise.all([
    (documentRequirements || []).length ? Promise.resolve({ data: documentRequirements, error: null }) : supabaseAdmin.from("school_enrolment_document_requirements").insert(STARTER_DOCUMENTS.map((item) => ({ ...audit, ...item }))).select(),
    (requirementTemplates || []).length ? Promise.resolve({ data: requirementTemplates, error: null }) : supabaseAdmin.from("school_enrolment_requirement_templates").insert(STARTER_REQUIREMENTS.map((item) => ({ ...audit, ...item }))).select(),
    (consents || []).length ? Promise.resolve({ data: consents, error: null }) : supabaseAdmin.from("school_enrolment_consents").insert(STARTER_CONSENTS.map((item) => ({ ...audit, ...item }))).select(),
    (terms || []).length ? Promise.resolve({ data: terms, error: null }) : supabaseAdmin.from("school_enrolment_terms_sections").insert(STARTER_TERMS.map((item) => ({ ...audit, ...item }))).select(),
  ]);
  const seedError = seededDocuments.error || seededRequirements.error || seededConsents.error || seededTerms.error;
  if (seedError) return NextResponse.json({ error: seedError.message }, { status: 500 });
  const signup = signupRows?.[0];
  return NextResponse.json({ settings, forms: forms || [], registration_fee: registrationFee, school, registration: { registration_number: registration?.registration_number || null, physical_address: registration?.physical_address || signup?.school_address || null, contact_number: registration?.contact_number || signup?.school_phone || null, email_address: registration?.email_address || signup?.school_email || null }, enrolment_configuration: enrolmentConfiguration ? { ...enrolmentConfiguration, additional_declaration: enrolmentConfiguration.additional_declaration || DEFAULT_PARENT_DECLARATION } : null, document_requirements: seededDocuments.data || [], requirement_templates: seededRequirements.data || [], consents: seededConsents.data || [], terms: seededTerms.data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  const action = text(body.action, 50);

  if (action === "save_settings") {
    const reminderDay = Number(body.payment_reminder_day || 1);
    if (!Number.isInteger(reminderDay) || reminderDay < 1 || reminderDay > 28) {
      return NextResponse.json({ error: "Choose a payment reminder day from 1 to 28." }, { status: 400 });
    }
    const settings = {
      school_id: schoolId,
      bank_account_name: text(body.bank_account_name),
      bank_name: text(body.bank_name),
      bank_account_number: text(body.bank_account_number, 80),
      bank_branch_code: text(body.bank_branch_code, 60),
      bank_account_type: text(body.bank_account_type, 80),
      payment_reminder_day: reminderDay,
      updated_by: authorization.staff.userId,
      updated_at: new Date().toISOString(),
    };
    const { data: existingSettings } = await supabaseAdmin
      .from("school_setup_settings")
      .select("created_by")
      .eq("school_id", schoolId)
      .maybeSingle();
    const { data, error } = await supabaseAdmin
      .from("school_setup_settings")
      .upsert({
        ...settings,
        created_by: existingSettings?.created_by || authorization.staff.userId,
      }, { onConflict: "school_id" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "school_setup.settings_saved", { school_id: schoolId });
    return NextResponse.json({ settings: data });
  }

  if (action === "save_universal_enrolment_configuration") {
    const formTitle = text(body.form_title, 180) || "Enrolment Form";
    const secondGuardianMode = text(body.second_guardian_mode, 20);
    const emergencyContactMode = text(body.emergency_contact_mode, 20);
    if (!["hidden", "optional", "required"].includes(secondGuardianMode) || !["hidden", "optional", "required"].includes(emergencyContactMode)) {
      return NextResponse.json({ error: "Choose valid guardian and emergency-contact settings." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from("school_enrolment_configurations").upsert({
      school_id: schoolId, form_title: formTitle, introduction: text(body.introduction, 3000) || null,
      is_open: body.is_open !== false, second_guardian_mode: secondGuardianMode,
      emergency_contact_mode: emergencyContactMode, previous_school_enabled: body.previous_school_enabled !== false,
      additional_declaration: text(body.additional_declaration, 3000) || null,
      custom_fields: customFields(body.custom_fields),
      updated_by: authorization.staff.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "school_id" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // The universal configuration is the source of truth for the current
    // enrolment form. Keep the legacy/general form record in sync because
    // Enrolments uses it to decide whether a new enquiry may be started.
    const { data: existingForm, error: existingFormError } = await supabaseAdmin
      .from("school_enrolment_forms")
      .select("created_by")
      .eq("school_id", schoolId)
      .eq("form_type", "general")
      .maybeSingle();
    if (existingFormError) return NextResponse.json({ error: existingFormError.message }, { status: 500 });

    const { error: formError } = await supabaseAdmin
      .from("school_enrolment_forms")
      .upsert({
        school_id: schoolId,
        form_type: "general",
        form_name: formTitle,
        instructions: text(body.introduction, 3000) || null,
        custom_fields: customFields(body.custom_fields),
        required_documents: [],
        stationery_list: [],
        is_active: body.is_open !== false,
        created_by: existingForm?.created_by || authorization.staff.userId,
        updated_by: authorization.staff.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,form_type" });
    if (formError) return NextResponse.json({ error: formError.message }, { status: 500 });

    await writeSecurityAudit(authorization.staff, "school_setup.universal_enrolment_saved", { school_id: schoolId });
    return NextResponse.json({ enrolment_configuration: data });
  }

  if (action === "save_enrolment_item") {
    const kind = text(body.kind, 20) as keyof typeof CONFIGURATION_TABLES;
    const table = CONFIGURATION_TABLES[kind];
    if (!table) return NextResponse.json({ error: "Choose a valid enrolment setting." }, { status: 400 });
    const id = text(body.id, 80);
    const base = { school_id: schoolId, is_active: body.is_active !== false, display_order: Math.max(0, Number(body.display_order) || 0), updated_by: authorization.staff.userId, updated_at: new Date().toISOString() };
    const values = kind === "document"
      ? { ...base, title: text(body.title, 180), instructions: text(body.instructions, 1000) || null, is_required: body.is_required === true }
      : kind === "requirement"
        ? { ...base, template_key: text(body.template_key, 10) === "0_2" ? "0_2" : "2_6", available_from_months: Math.max(0, Math.min(84, Number(body.available_from_months) || 0)), available_to_months: Math.max(0, Math.min(84, Number(body.available_to_months) || 0)), category: ["stationery", "hygiene"].includes(text(body.category, 20)) ? text(body.category, 20) : "stationery", item_name: text(body.item_name, 180), quantity: text(body.quantity, 80) || null, instructions: text(body.instructions, 1000) || null, is_required: body.is_required === true }
        : kind === "consent"
          ? { ...base, title: text(body.title, 180), wording: text(body.wording, 3000), is_required: body.is_required !== false }
          : { ...base, title: text(body.title, 180), content: text(body.content, 5000) };
    const title = text(body.title, 180);
    const itemName = text(body.item_name, 180);
    const wording = text(body.wording, 3000);
    const content = text(body.content, 5000);
    if (!(kind === "requirement" ? itemName : title) || (kind === "consent" && !wording) || (kind === "term" && !content)) return NextResponse.json({ error: "Complete the required setting information." }, { status: 400 });
    const query = id ? supabaseAdmin.from(table).update(values).eq("id", id).eq("school_id", schoolId) : supabaseAdmin.from(table).insert({ ...values, created_by: authorization.staff.userId });
    const { data, error } = await query.select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, `school_setup.enrolment_${kind}_saved`, { school_id: schoolId, id: data.id });
    return NextResponse.json({ item: data });
  }

  if (action === "save_requirement_template_months") {
    const templateKey = text(body.template_key, 10) === "0_2" ? "0_2" : "2_6";
    const category = text(body.category, 20) === "hygiene" ? "hygiene" : "stationery";
    const months = Math.max(0, Math.min(84, Number(body.available_from_months) || 0));
    const toMonths = Math.max(months, Math.min(84, Number(body.available_to_months) || months));
    const { error } = await supabaseAdmin.from("school_enrolment_requirement_templates").update({ available_from_months: months, available_to_months: toMonths, updated_by: authorization.staff.userId, updated_at: new Date().toISOString() }).eq("school_id", schoolId).eq("template_key", templateKey).eq("category", category);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, available_from_months: months, available_to_months: toMonths });
  }

  if (action === "archive_enrolment_item") {
    const kind = text(body.kind, 20) as keyof typeof CONFIGURATION_TABLES;
    const table = CONFIGURATION_TABLES[kind];
    const id = text(body.id, 80);
    if (!table || !id) return NextResponse.json({ error: "Choose a valid enrolment setting." }, { status: 400 });
    const { error } = await supabaseAdmin.from(table).update({ is_active: false, updated_by: authorization.staff.userId, updated_at: new Date().toISOString() }).eq("id", id).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, `school_setup.enrolment_${kind}_archived`, { school_id: schoolId, id });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_enrolment_item") {
    const kind = text(body.kind, 20) as keyof typeof CONFIGURATION_TABLES;
    const table = CONFIGURATION_TABLES[kind];
    const id = text(body.id, 80);
    if (!table || !id) return NextResponse.json({ error: "Choose a valid enrolment setting." }, { status: 400 });
    const { error } = await supabaseAdmin.from(table).delete().eq("id", id).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, `school_setup.enrolment_${kind}_deleted`, { school_id: schoolId, id });
    return NextResponse.json({ success: true });
  }

  const formType = text(body.form_type, 30);
  if (!FORM_TYPES.has(formType)) {
    return NextResponse.json({ error: "Choose a valid enrolment form type." }, { status: 400 });
  }

  if (action === "save_form") {
    const formName = text(body.form_name, 180);
    if (!formName) return NextResponse.json({ error: "Enter a name for this enrolment form." }, { status: 400 });
    const { data: existingForm } = await supabaseAdmin
      .from("school_enrolment_forms")
      .select("created_by")
      .eq("school_id", schoolId)
      .eq("form_type", formType)
      .maybeSingle();
    const { data, error } = await supabaseAdmin
      .from("school_enrolment_forms")
      .upsert({
        school_id: schoolId,
        form_type: formType,
        form_name: formName,
        instructions: text(body.instructions, 3000) || null,
        custom_fields: customFields(body.custom_fields),
        required_documents: textList(body.required_documents, 10),
        stationery_list: textList(body.stationery_list, 40),
        is_active: body.is_active !== false,
        created_by: existingForm?.created_by || authorization.staff.userId,
        updated_by: authorization.staff.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,form_type" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "school_setup.form_saved", { school_id: schoolId, form_type: formType });
    return NextResponse.json({ form: data });
  }

  if (action === "create_form_upload") {
    const formId = text(body.form_id, 80);
    const size = Number(body.file_size || 0);
    const contentType = text(body.content_type, 100).toLowerCase();
    if (!formId || !Number.isFinite(size) || size <= 0 || size > MAX_TEMPLATE_BYTES || !ALLOWED_TEMPLATE_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Use a PDF, JPG, PNG or WEBP enrolment form no larger than 10 MB." }, { status: 400 });
    }
    const { data: form } = await supabaseAdmin.from("school_enrolment_forms").select("id").eq("id", formId).eq("school_id", schoolId).maybeSingle();
    if (!form) return NextResponse.json({ error: "Enrolment form not found." }, { status: 404 });
    const path = `${schoolId}/forms/${formId}/${Date.now()}-${fileName(body.file_name)}`;
    const { data, error } = await supabaseAdmin.storage.from("school-enrolment-forms").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || "Could not prepare upload." }, { status: 500 });
    return NextResponse.json({ path, signed_url: data.signedUrl, token: data.token });
  }

  if (action === "complete_form_upload") {
    const formId = text(body.form_id, 80);
    const path = text(body.path, 500);
    if (!formId || !path.startsWith(`${schoolId}/forms/${formId}/`)) {
      return NextResponse.json({ error: "Invalid enrolment form upload." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("school_enrolment_forms")
      .update({
        source_document_path: path,
        source_document_name: text(body.file_name, 180),
        source_document_content_type: text(body.content_type, 100),
        source_document_size: Number(body.file_size || 0),
        updated_by: authorization.staff.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", formId)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "school_setup.form_template_uploaded", { school_id: schoolId, form_id: formId });
    return NextResponse.json({ form: data });
  }

  return NextResponse.json({ error: "Unknown School Setup action." }, { status: 400 });
}

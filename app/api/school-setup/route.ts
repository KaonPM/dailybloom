import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const FORM_TYPES = new Set(["general", "babies", "grade_r"]);
const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TEMPLATE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function fileName(value: unknown) {
  return text(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_") || "enrolment-form";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = Number(searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;

  const [{ data: settings, error: settingsError }, { data: forms, error: formsError }, { data: registrationFee, error: feeError }] = await Promise.all([
    supabaseAdmin.from("school_setup_settings").select("*").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_forms").select("*").eq("school_id", schoolId).order("form_type"),
    supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
  ]);
  const error = settingsError || formsError || feeError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings, forms: forms || [], registration_fee: registrationFee });
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

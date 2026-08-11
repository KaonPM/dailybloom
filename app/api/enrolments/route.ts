import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { FORM_LINK_LIFETIME_MS, hashEnrolmentSecret } from "@/app/lib/enrolment-form-security";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTrackedEnrolmentWhatsApp } from "@/app/lib/enrolment-whatsapp-delivery";

function text(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function paymentMessage(input: { schoolName: string; parentName: string; reference: string; amount: number; bankAccountName: string; bankName: string; bankAccountNumber: string; bankBranchCode: string }) {
  const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(input.amount || 0));
  const bankLines = [
    input.bankAccountName && `Account name: ${input.bankAccountName}`,
    input.bankName && `Bank: ${input.bankName}`,
    input.bankAccountNumber && `Account number: ${input.bankAccountNumber}`,
    input.bankBranchCode && `Branch code: ${input.bankBranchCode}`,
  ].filter(Boolean);
  return [
    `Hello ${input.parentName},`,
    `Thank you for enquiring at ${input.schoolName}.`,
    `The Registration Fee is ${money}. Please use ${input.reference} as your payment reference and send proof of payment to the school.`,
    ...bankLines,
    "Once payment is confirmed, we will send your secure digital enrolment form.",
  ].join("\n");
}

async function sendEnrolmentWhatsAppMessage(input: {
    enquiryId: string;
    schoolId: number;
    phone: string;
    bodyParameters: string[];
    kind: "registration" | "form";
}) {
  const delivery = await sendTrackedEnrolmentWhatsApp({
    enquiryId: input.enquiryId,
    schoolId: input.schoolId,
    kind: input.kind,
    phone: input.phone,
    bodyParameters: input.bodyParameters,
  });
  return { sent: delivery.sent, error: delivery.error, retryScheduled: delivery.retryScheduled };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = Number(searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;

  const [{ data: enquiries, error: enquiryError }, { data: forms, error: formError }, { data: school, error: schoolError }] = await Promise.all([
    supabaseAdmin
      .from("school_enrolment_enquiries")
      .select("id, school_id, form_id, enquiry_reference, parent_name, parent_phone, registration_fee_amount, registration_payment_status, registration_payment_reference, registration_payment_verified_at, status, submitted_data, submitted_at, reviewed_at, decline_reason, created_at, school_enrolment_forms(form_name, form_type)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("school_enrolment_forms").select("id, form_name, form_type, is_active").eq("school_id", schoolId).eq("is_active", true).order("form_type"),
    supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle(),
  ]);
  const error = enquiryError || formError || schoolError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enquiryIds = (enquiries || []).map((enquiry) => enquiry.id).filter(Boolean);
  const { data: deliveries } = enquiryIds.length
    ? await supabaseAdmin
        .from("enrolment_message_deliveries")
        .select("id, enquiry_id, message_kind, template_name, template_version, template_category, status, attempt_count, next_retry_at, last_error, sent_at, delivered_at, read_at, failed_at, created_at")
        .in("enquiry_id", enquiryIds)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };
  const deliveriesByEnquiry = new Map<string, unknown[]>();
  for (const delivery of deliveries || []) {
    const enquiryDeliveries = deliveriesByEnquiry.get(delivery.enquiry_id) || [];
    enquiryDeliveries.push(delivery);
    deliveriesByEnquiry.set(delivery.enquiry_id, enquiryDeliveries);
  }
  const enrichedEnquiries = (enquiries || []).map((enquiry) => ({
    ...enquiry,
    deliveries: deliveriesByEnquiry.get(enquiry.id) || [],
  }));
  return NextResponse.json({ enquiries: enrichedEnquiries, forms: forms || [], school_name: school?.school_name || "Your school" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const action = text(body.action, 60);
  const requestedPermission = action === "review" ? PERMISSIONS.SCHOOL_MANAGE : PERMISSIONS.LEARNERS_MANAGE;
  const authorization = await requireStaffPermission(request, requestedPermission, schoolId);
  if (!authorization.ok) return authorization.response;

  if (action === "create") {
    const parentName = text(body.parent_name, 180);
    const parentPhone = text(body.parent_phone, 40);
    const formId = text(body.form_id, 80);
    if (!parentName || !parentPhone || !formId) {
      return NextResponse.json({ error: "Choose a form and enter the parent name and mobile number." }, { status: 400 });
    }
    const [{ data: form }, { data: fee }, { data: school }, { data: setup }] = await Promise.all([
      supabaseAdmin.from("school_enrolment_forms").select("id, form_name").eq("id", formId).eq("school_id", schoolId).eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
      supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle(),
      supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code").eq("school_id", schoolId).maybeSingle(),
    ]);
    if (!form) return NextResponse.json({ error: "Set up an active enrolment form before creating an enquiry." }, { status: 400 });
    if (!fee) return NextResponse.json({ error: "Registration Fee is not available. Open School Fee Setup first." }, { status: 400 });

    const { data: reference, error: referenceError } = await supabaseAdmin.rpc("next_school_enrolment_reference", { p_school_id: schoolId });
    if (referenceError || !reference) return NextResponse.json({ error: referenceError?.message || "Could not create an enrolment reference." }, { status: 500 });
    const { data: enquiry, error: createError } = await supabaseAdmin
      .from("school_enrolment_enquiries")
      .insert({
        school_id: schoolId,
        form_id: form.id,
        enquiry_reference: reference,
        parent_name: parentName,
        parent_phone: parentPhone,
        registration_fee_type_id: fee.id,
        registration_fee_amount: Number(fee.amount || 0),
        created_by: authorization.staff.userId,
      })
      .select("id, enquiry_reference, registration_fee_amount")
      .single();
    if (createError || !enquiry) return NextResponse.json({ error: createError?.message || "Could not save enrolment enquiry." }, { status: 500 });
    const whatsappMessage = paymentMessage({
      schoolName: school?.school_name || "Your school",
      parentName,
      reference,
      amount: Number(enquiry.registration_fee_amount || 0),
      bankAccountName: setup?.bank_account_name || "",
      bankName: setup?.bank_name || "",
      bankAccountNumber: setup?.bank_account_number || "",
      bankBranchCode: setup?.bank_branch_code || "",
    });
    const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(enquiry.registration_fee_amount || 0));
    const bankSummary = [
      setup?.bank_account_name && `Account name: ${setup.bank_account_name}`,
      setup?.bank_name && `Bank: ${setup.bank_name}`,
      setup?.bank_account_number && `Account number: ${setup.bank_account_number}`,
      setup?.bank_branch_code && `Branch code: ${setup.bank_branch_code}`,
    ].filter(Boolean).join(" | ") || "Please contact the school for banking details.";
    const delivery = await sendEnrolmentWhatsAppMessage({
      enquiryId: enquiry.id,
      schoolId,
      phone: parentPhone,
      kind: "registration",
      bodyParameters: [parentName, school?.school_name || "your school", money, reference, bankSummary],
    });
    await writeSecurityAudit(authorization.staff, "enrolment.enquiry_created", { school_id: schoolId, enquiry_id: enquiry.id, reference, whatsapp_sent: delivery.sent });
    return NextResponse.json({
      enquiry,
      whatsapp_message: whatsappMessage,
      whatsapp_sent: delivery.sent,
      whatsapp_retry_scheduled: delivery.retryScheduled,
      whatsapp_error: delivery.error || null,
    });
  }

  const enquiryId = text(body.enquiry_id, 80);
  if (!enquiryId) return NextResponse.json({ error: "Choose an enrolment enquiry." }, { status: 400 });
  const { data: enquiry, error: enquiryError } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, parent_name, parent_phone, enquiry_reference, registration_payment_status, status, school_enrolment_forms(form_name), schools(school_name)")
    .eq("id", enquiryId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (enquiryError || !enquiry) return NextResponse.json({ error: enquiryError?.message || "Enrolment enquiry not found." }, { status: 404 });

  if (action === "verify_registration_payment") {
    if (enquiry.registration_payment_status !== "pending") {
      return NextResponse.json({ error: "The registration payment has already been handled." }, { status: 400 });
    }
    const paymentReference = text(body.payment_reference, 180);
    if (!paymentReference) return NextResponse.json({ error: "Enter the payment reference or proof reference." }, { status: 400 });
    const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({
      registration_payment_status: "verified",
      registration_payment_reference: paymentReference,
      registration_payment_verified_at: new Date().toISOString(),
      registration_payment_verified_by: authorization.staff.userId,
      updated_at: new Date().toISOString(),
    }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "enrolment.registration_payment_verified", { school_id: schoolId, enquiry_id: enquiryId });
    return NextResponse.json({ success: true });
  }

  if (action === "issue_form") {
    if (!["verified", "waived"].includes(String(enquiry.registration_payment_status))) {
      return NextResponse.json({ error: "Confirm the Registration Fee payment before issuing the form." }, { status: 400 });
    }
    if (!["payment_pending", "form_issued"].includes(String(enquiry.status))) {
      return NextResponse.json({ error: "This enrolment form has already been submitted or reviewed." }, { status: 400 });
    }
    const token = randomBytes(32).toString("base64url");
    const expiry = new Date(Date.now() + FORM_LINK_LIFETIME_MS).toISOString();
    const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({
      form_token_hash: hashEnrolmentSecret(token),
      form_token_expires_at: expiry,
      form_access_otp_hash: null,
      form_access_otp_expires_at: null,
      form_access_otp_sent_at: null,
      form_access_otp_resend_available_at: null,
      form_access_otp_attempts: 0,
      form_access_otp_send_count: 0,
      form_access_otp_locked_until: null,
      form_access_session_hash: null,
      form_access_session_expires_at: null,
      status: "form_issued",
      updated_at: new Date().toISOString(),
    }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const formUrl = `${new URL(request.url).origin}/enrolment/${token}`;
    const school = Array.isArray(enquiry.schools) ? enquiry.schools[0] : enquiry.schools;
    const message = `Hello ${enquiry.parent_name}, your secure enrolment form for ${enquiry.enquiry_reference} is ready. Use this link within 24 hours: ${formUrl}. A verification code will be sent by WhatsApp when you open it.`;
    const delivery = await sendEnrolmentWhatsAppMessage({
      enquiryId,
      schoolId,
      phone: enquiry.parent_phone,
      kind: "form",
      bodyParameters: [enquiry.parent_name, school?.school_name || "your school", enquiry.enquiry_reference, formUrl, "24 hours"],
    });
    await writeSecurityAudit(authorization.staff, "enrolment.form_issued", { school_id: schoolId, enquiry_id: enquiryId, whatsapp_sent: delivery.sent });
    return NextResponse.json({ form_url: formUrl, whatsapp_message: message, whatsapp_sent: delivery.sent, whatsapp_retry_scheduled: delivery.retryScheduled, whatsapp_error: delivery.error || null, expires_at: expiry });
  }

  if (action === "review") {
    const decision = text(body.decision, 20);
    if (!["approved", "declined"].includes(decision) || (decision === "declined" && !text(body.decline_reason, 1000))) {
      return NextResponse.json({ error: "Approve the enrolment or add a reason for declining it." }, { status: 400 });
    }
    if (enquiry.status !== "submitted") return NextResponse.json({ error: "Only submitted enrolment forms can be reviewed." }, { status: 400 });
    const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({
      status: decision,
      decline_reason: decision === "declined" ? text(body.decline_reason, 1000) : null,
      reviewed_by: authorization.staff.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, `enrolment.${decision}`, { school_id: schoolId, enquiry_id: enquiryId });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown enrolment action." }, { status: 400 });
}

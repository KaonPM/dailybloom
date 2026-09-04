import { randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { FORM_LINK_LIFETIME_MS, hashEnrolmentSecret } from "@/app/lib/enrolment-form-security";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTrackedEnrolmentWhatsApp } from "@/app/lib/enrolment-whatsapp-delivery";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";

function text(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function learnerAgeOnDate(dateOfBirth: string, onDate: Date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  if (!Number.isInteger(birthYear) || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  return onDate.getFullYear() - birthYear - (onDate.getMonth() + 1 < birthMonth || (onDate.getMonth() + 1 === birthMonth && onDate.getDate() < birthDay) ? 1 : 0);
}

function classroomAcceptsLearnerAge(ageGroups: unknown, age: number) {
  return Array.isArray(ageGroups) && ageGroups.some((group) => {
    const match = /^(\d+)\s*-\s*(\d+)\s*years?$/i.exec(String(group || "").trim());
    return Boolean(match && age >= Number(match[1]) && age <= Number(match[2]));
  });
}

function classroomMatchesSelectedMonthlyFee(classroom: { classroom_name?: string | null; age_groups?: unknown }, feeName?: string | null) {
  const fee = String(feeName || "").trim().toLowerCase();
  const classroomName = String(classroom.classroom_name || "").trim().toLowerCase();
  const ageGroups = Array.isArray(classroom.age_groups) ? classroom.age_groups.map((group) => String(group || "").toLowerCase()) : [];
  if (/\bgrade\s*r\b/.test(fee)) return /\bgrade\s*r\b/.test(classroomName) || ageGroups.some((group) => /\b5\s*-\s*6\s*years?\b/.test(group));
  if (/\bbab(?:y|ies)\b/.test(fee)) return /\bbab(?:y|ies)\b/.test(classroomName) || ageGroups.some((group) => /\b0\s*-\s*[12]\s*years?\b/.test(group));
  if (/\btoddler/.test(fee)) return /\btoddler/.test(classroomName) || ageGroups.some((group) => /\b2\s*-\s*[34]\s*years?\b/.test(group));
  return false;
}

function publicAppOrigin(request: Request) {
  const configured = text(process.env.NEXT_PUBLIC_APP_URL, 500).replace(/\/+$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the request origin when the optional public URL is malformed.
    }
  }
  const requestOrigin = new URL(request.url).origin;
  return process.env.VERCEL_ENV === "production" && requestOrigin.endsWith(".vercel.app")
    ? "https://dailybloom.co.za"
    : requestOrigin;
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

  const [{ data: enquiries, error: enquiryError }, { data: forms, error: formError }, { data: school, error: schoolError }, { data: classrooms, error: classroomError }, { data: recurringAddons, error: recurringAddonsError }] = await Promise.all([
    supabaseAdmin
      .from("school_enrolment_enquiries")
      .select("id, school_id, form_id, learner_id, enquiry_reference, parent_name, parent_phone, registration_fee_amount, registration_payment_status, registration_payment_reference, registration_payment_verified_at, status, enrolment_source, academic_year, printed_at, paper_received_at, submitted_data, submitted_at, reviewed_at, decline_reason, created_at, school_enrolment_forms(form_name, form_type)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("school_enrolment_forms").select("id, form_name, form_type, is_active").eq("school_id", schoolId).eq("form_type", "general").eq("is_active", true).order("form_type"),
    supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId).order("classroom_name"),
    supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_category", "recurring_addon").eq("is_active", true).order("fee_name"),
  ]);
  const error = enquiryError || formError || schoolError || classroomError || recurringAddonsError;
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
  const learnerIds = (enquiries || []).map((enquiry) => enquiry.learner_id).filter(Boolean);
  const { data: placements, error: placementError } = learnerIds.length
    ? await supabaseAdmin.from("learner_placements").select("learner_id, academic_year, classroom_id, placement_status, classrooms(classroom_name)").eq("school_id", schoolId).in("learner_id", learnerIds)
    : { data: [], error: null };
  if (placementError) return NextResponse.json({ error: placementError.message }, { status: 500 });
  const placementByLearner = new Map((placements || []).map((placement) => [`${placement.learner_id}:${placement.academic_year}`, placement]));
  const enrichedEnquiries = (enquiries || []).map((enquiry) => ({
    ...enquiry,
    deliveries: deliveriesByEnquiry.get(enquiry.id) || [],
    placement: enquiry.learner_id ? placementByLearner.get(`${enquiry.learner_id}:${enquiry.academic_year}`) || null : null,
  }));
  return NextResponse.json({ enquiries: enrichedEnquiries, forms: forms || [], classrooms: classrooms || [], recurring_addons: recurringAddons || [], school_name: school?.school_name || "Your school" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const action = text(body.action, 60);
  const requestedPermission = ["review", "reopen_form", "delete_withdrawn"].includes(action) ? PERMISSIONS.SCHOOL_MANAGE : PERMISSIONS.LEARNERS_MANAGE;
  const authorization = await requireStaffPermission(request, requestedPermission, schoolId);
  if (!authorization.ok) return authorization.response;

  if (action === "create") {
    const parentName = text(body.parent_name, 180);
    const parentPhone = text(body.parent_phone, 40);
    const learnerFirstName = text(body.learner_first_name, 120);
    const learnerSurname = text(body.learner_surname, 120);
    const normalizedParentPhone = toSouthAfricanSmsNumber(parentPhone);
    const requestedAcademicYear = Number(body.academic_year);
    const academicYear = Number.isInteger(requestedAcademicYear) && requestedAcademicYear >= 2020 && requestedAcademicYear <= 2100
      ? requestedAcademicYear
      : new Date().getFullYear();
    if (!learnerFirstName || !learnerSurname || !parentName || !parentPhone) {
      return NextResponse.json({ error: "Enter the learner's first name and surname, plus the parent name and mobile number." }, { status: 400 });
    }
    if (!/\p{L}/u.test(parentName)) {
      return NextResponse.json({ error: "Enter the parent or guardian's name in the name field, not their mobile number." }, { status: 400 });
    }
    if (!/^27\d{9}$/.test(normalizedParentPhone)) {
      return NextResponse.json({ error: "Enter a valid 10-digit South African mobile number, for example 082 000 0000." }, { status: 400 });
    }
    const [{ data: form }, { data: fee }, { data: school }, { data: setup }] = await Promise.all([
      supabaseAdmin.from("school_enrolment_forms").select("id, form_name").eq("school_id", schoolId).eq("form_type", "general").eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
      supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle(),
      supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code").eq("school_id", schoolId).maybeSingle(),
    ]);
    if (!form) return NextResponse.json({ error: "Set up an active enrolment form before creating an enquiry." }, { status: 400 });
    if (!fee) return NextResponse.json({ error: "Registration Fee is not available. Open School Fee Setup first." }, { status: 400 });

    const { data: reference, error: referenceError } = await supabaseAdmin.rpc("next_school_enrolment_reference_for_year", { p_school_id: schoolId, p_academic_year: academicYear });
    if (referenceError || !reference) return NextResponse.json({ error: referenceError?.message || "Could not create an enrolment reference." }, { status: 500 });
    const { data: enquiry, error: createError } = await supabaseAdmin
      .from("school_enrolment_enquiries")
      .insert({
        school_id: schoolId,
        form_id: form.id,
        enquiry_reference: reference,
        academic_year: academicYear,
        parent_name: parentName,
        parent_phone: `+${normalizedParentPhone}`,
        submitted_data: {
          learner_first_name: learnerFirstName,
          learner_surname: learnerSurname,
          guardian_name: parentName,
          guardian_phone: `+${normalizedParentPhone}`,
          parent_portal_phone: `+${normalizedParentPhone}`,
        },
        registration_fee_type_id: fee.id,
        registration_fee_amount: Number(fee.amount || 0),
        created_by: authorization.staff.userId,
      })
      .select("id, enquiry_reference, academic_year, registration_fee_amount")
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
      phone: normalizedParentPhone,
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

  if (action === "start_manual_application") {
    const academicYear = Number(body.academic_year);
    const source = text(body.enrolment_source, 40);
    if (!Number.isInteger(academicYear) || academicYear < 2020 || academicYear > 2100 || !["paper_manual_capture", "printed_blank_form"].includes(source)) {
      return NextResponse.json({ error: "Choose a valid academic year and manual enrolment pathway." }, { status: 400 });
    }
    const [{ data: form }, { data: fee }] = await Promise.all([
      supabaseAdmin.from("school_enrolment_forms").select("id").eq("school_id", schoolId).eq("form_type", "general").maybeSingle(),
      supabaseAdmin.from("school_fee_types").select("id, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
    ]);
    if (!form) return NextResponse.json({ error: "Set up the universal enrolment form first." }, { status: 400 });
    const { data: reference, error: referenceError } = await supabaseAdmin.rpc("next_school_enrolment_reference_for_year", { p_school_id: schoolId, p_academic_year: academicYear });
    if (referenceError || !reference) {
      const missingReferenceFunction = referenceError?.message?.includes("next_school_enrolment_reference_for_year");
      return NextResponse.json({ error: missingReferenceFunction ? "The enrolment reference generator is not installed in Supabase. Run migration 20260823_restore_enrolment_reference_function.sql, then try again." : referenceError?.message || "Could not create an enrolment reference." }, { status: 500 });
    }
    const now = new Date().toISOString();
    const { data: enquiry, error } = await supabaseAdmin.from("school_enrolment_enquiries").insert({
      school_id: schoolId, form_id: form.id, enquiry_reference: reference, parent_name: "Paper enrolment", parent_phone: "Pending", academic_year: academicYear, enrolment_source: source,
      registration_fee_type_id: fee?.id || null, registration_fee_amount: Number(fee?.amount || 0), created_by: authorization.staff.userId,
      ...(source === "printed_blank_form" ? { printed_at: now, printed_by: authorization.staff.userId } : {}),
      ...(source === "paper_manual_capture" ? { paper_received_at: now, paper_captured_by: authorization.staff.userId } : {}),
    }).select("id, enquiry_reference, academic_year, enrolment_source").single();
    if (error || !enquiry) return NextResponse.json({ error: error?.message || "Could not start the manual enrolment." }, { status: 500 });
    await writeSecurityAudit(authorization.staff, source === "printed_blank_form" ? "enrolment.blank_form_printed" : "enrolment.manual_capture_started", { school_id: schoolId, enquiry_id: enquiry.id, reference, academic_year: academicYear });
    return NextResponse.json({ enquiry });
  }

  if (action === "mark_paper_received") {
    const enquiryId = text(body.enquiry_id, 80);
    if (!enquiryId) return NextResponse.json({ error: "Choose the returned paper form." }, { status: 400 });
    const { data: enquiry, error: enquiryError } = await supabaseAdmin.from("school_enrolment_enquiries").select("id, enrolment_source, paper_received_at").eq("id", enquiryId).eq("school_id", schoolId).maybeSingle();
    if (enquiryError || !enquiry || !["printed_blank_form", "paper_manual_capture"].includes(String(enquiry.enrolment_source))) return NextResponse.json({ error: "Paper enrolment application not found." }, { status: 404 });
    if (!enquiry.paper_received_at) {
      const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({ paper_received_at: new Date().toISOString(), paper_captured_by: authorization.staff.userId, updated_at: new Date().toISOString() }).eq("id", enquiryId).eq("school_id", schoolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await writeSecurityAudit(authorization.staff, "enrolment.paper_received", { school_id: schoolId, enquiry_id: enquiryId });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "capture_by_reference") {
    const reference = text(body.enquiry_reference, 80).toUpperCase();
    if (!reference) return NextResponse.json({ error: "Enter the enrolment reference printed on the form." }, { status: 400 });
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("school_enrolment_enquiries")
      .select("id, status, enrolment_source, paper_received_at")
      .eq("school_id", schoolId)
      .ilike("enquiry_reference", reference)
      .maybeSingle();
    if (lookupError || !existing) return NextResponse.json({ error: "No enrolment form with that reference was found for this school." }, { status: 404 });
    if (!['printed_blank_form', 'paper_manual_capture'].includes(String(existing.enrolment_source))) {
      return NextResponse.json({ error: "This reference belongs to a digital parent application. Open it from the Enrolment Pipeline instead." }, { status: 400 });
    }
    if (!["payment_pending", "form_issued"].includes(String(existing.status))) {
      return NextResponse.json({ error: "This enrolment form has already been submitted, reviewed or closed." }, { status: 400 });
    }
    if (!existing.paper_received_at) {
      const { error: updateError } = await supabaseAdmin.from("school_enrolment_enquiries").update({
        paper_received_at: new Date().toISOString(),
        paper_captured_by: authorization.staff.userId,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).eq("school_id", schoolId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      await writeSecurityAudit(authorization.staff, "enrolment.paper_received", { school_id: schoolId, enquiry_id: existing.id, located_by_reference: true });
    }
    return NextResponse.json({ enquiry_id: existing.id });
  }

  const enquiryId = text(body.enquiry_id, 80);
  if (!enquiryId) return NextResponse.json({ error: "Choose an enrolment enquiry." }, { status: 400 });
  const { data: enquiry, error: enquiryError } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, parent_name, parent_phone, enquiry_reference, registration_fee_amount, registration_payment_status, registration_payment_reference, registration_payment_verified_at, status, enrolment_source, academic_year, learner_id, submitted_data, school_enrolment_forms(form_name), schools(school_name)")
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

  if (action === "issue_form" || action === "reopen_form") {
    if (!["verified", "waived"].includes(String(enquiry.registration_payment_status))) {
      return NextResponse.json({ error: "Confirm the Registration Fee payment before issuing the form." }, { status: 400 });
    }
    const reopening = action === "reopen_form";
    if ((!reopening && !["payment_pending", "form_issued"].includes(String(enquiry.status))) || (reopening && enquiry.status !== "submitted")) {
      return NextResponse.json({ error: reopening ? "Only a submitted application can be reopened for parent editing." : "This enrolment form has already been submitted or reviewed." }, { status: 400 });
    }
    const issuedAt = new Date().toISOString();
    await supabaseAdmin.from("enrolment_message_deliveries").update({
      status: "failed",
      next_retry_at: null,
      retry_payload_encrypted: null,
      failed_at: issuedAt,
      last_error: "Superseded by a newly issued secure enrolment link.",
    }).eq("enquiry_id", enquiryId).eq("message_kind", "form").eq("status", "retry_scheduled");
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
      updated_at: issuedAt,
    }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const formUrl = `${publicAppOrigin(request)}/enrolment/${token}`;
    const school = Array.isArray(enquiry.schools) ? enquiry.schools[0] : enquiry.schools;
    const message = `Hello ${enquiry.parent_name}, your private enrolment form for ${school?.school_name || "your school"} is ready. Reference: ${enquiry.enquiry_reference}. Complete it here: ${formUrl}. This link expires in 72 hours, is tied to one learner, and must not be forwarded or shared.`;
    const delivery = await sendEnrolmentWhatsAppMessage({
      enquiryId,
      schoolId,
      phone: enquiry.parent_phone,
      kind: "form",
      bodyParameters: [enquiry.parent_name, school?.school_name || "your school", enquiry.enquiry_reference, formUrl, "72 hours"],
    });
    await writeSecurityAudit(authorization.staff, reopening ? "enrolment.form_reopened" : "enrolment.form_issued", { school_id: schoolId, enquiry_id: enquiryId, previous_token_revoked: true, expires_at: expiry, whatsapp_sent: delivery.sent });
    return NextResponse.json({ form_url: formUrl, whatsapp_message: message, whatsapp_sent: delivery.sent, whatsapp_retry_scheduled: delivery.retryScheduled, whatsapp_error: delivery.error || null, expires_at: expiry });
  }

  if (action === "review") {
    const decision = text(body.decision, 20);
    if (!["approved", "declined"].includes(decision) || (decision === "declined" && !text(body.decline_reason, 1000))) {
      return NextResponse.json({ error: "Approve the enrolment or add a reason for declining it." }, { status: 400 });
    }
    if (enquiry.status !== "submitted") return NextResponse.json({ error: "Only submitted enrolment forms can be reviewed." }, { status: 400 });
    const isCurrentYearManualCapture = Number(enquiry.academic_year) === new Date().getFullYear()
      && ["printed_blank_form", "paper_manual_capture"].includes(String(enquiry.enrolment_source));
    if (decision === "approved" && !isCurrentYearManualCapture && !["verified", "waived"].includes(String(enquiry.registration_payment_status))) {
      return NextResponse.json({ error: "Confirm the Registration Fee reference before approving this enrolment." }, { status: 400 });
    }
    let learnerId = enquiry.learner_id ? String(enquiry.learner_id) : "";
    if (decision === "approved" && !learnerId) {
      const submitted = enquiry.submitted_data && typeof enquiry.submitted_data === "object" && !Array.isArray(enquiry.submitted_data)
        ? enquiry.submitted_data as Record<string, unknown>
        : {};
      const medical = submitted.medical && typeof submitted.medical === "object" && !Array.isArray(submitted.medical) ? submitted.medical as Record<string, unknown> : {};
      const firstName = text(submitted.learner_first_name, 120);
      const surname = text(submitted.learner_surname, 120);
      const guardianName = text(submitted.guardian_name, 180);
      const parentPhone = text(submitted.parent_portal_phone || submitted.guardian_phone, 40);
      if (!firstName || !surname || !text(submitted.date_of_birth, 10) || !guardianName || !parentPhone) {
        return NextResponse.json({ error: "The captured form is missing required learner or guardian information." }, { status: 400 });
      }
      const selectedMonthlyFeeId = Number(submitted.selected_monthly_fee_id);
      const { data: selectedMonthlyFee, error: selectedMonthlyFeeError } = Number.isInteger(selectedMonthlyFeeId) && selectedMonthlyFeeId > 0
        ? await supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("id", selectedMonthlyFeeId).eq("school_id", schoolId).eq("fee_category", "monthly").eq("is_active", true).maybeSingle()
        : { data: null, error: null };
      if (selectedMonthlyFeeError) return NextResponse.json({ error: selectedMonthlyFeeError.message }, { status: 500 });
      const academicYear = Number(enquiry.academic_year);
      let ageMatchedClassroom: { id: number; classroom_name: string } | null = null;

      if (isCurrentYearManualCapture) {
        const learnerAge = learnerAgeOnDate(text(submitted.date_of_birth, 10), new Date());
        if (learnerAge !== null) {
          const [classroomResult, placementResult] = await Promise.all([
            supabaseAdmin.from("classrooms").select("id, classroom_name, age_groups").eq("school_id", schoolId).order("id"),
            supabaseAdmin.from("learner_placements").select("classroom_id").eq("school_id", schoolId).eq("academic_year", academicYear).not("classroom_id", "is", null),
          ]);
          const allocationError = classroomResult.error || placementResult.error;
          if (allocationError) return NextResponse.json({ error: allocationError.message }, { status: 500 });
          const classroomLoad = new Map<number, number>();
          for (const placement of placementResult.data || []) {
            const classroomId = Number(placement.classroom_id);
            if (Number.isInteger(classroomId)) classroomLoad.set(classroomId, (classroomLoad.get(classroomId) || 0) + 1);
          }
          const matchingClassrooms = (classroomResult.data || []).filter((classroom) =>
            classroomAcceptsLearnerAge(classroom.age_groups, learnerAge)
          );
          const feeMatchedClassrooms = matchingClassrooms.filter((classroom) => classroomMatchesSelectedMonthlyFee(classroom, selectedMonthlyFee?.fee_name));
          const allocationCandidates = feeMatchedClassrooms.length ? feeMatchedClassrooms : matchingClassrooms;
          ageMatchedClassroom = allocationCandidates.sort((left, right) =>
            (classroomLoad.get(left.id) || 0) - (classroomLoad.get(right.id) || 0) || left.id - right.id
          )[0] || null;
        }
      }
      learnerId = randomUUID();
      const { error: learnerError } = await supabaseAdmin.from("learners").insert({
        id: learnerId,
        school_id: schoolId,
        name: firstName,
        legal_name: `${firstName} ${surname}`.trim(),
        class: ageMatchedClassroom?.classroom_name || "Waiting list",
        classroom_id: ageMatchedClassroom?.id || null,
        date_of_birth: text(submitted.date_of_birth, 10),
        gender: text(submitted.gender, 40) || null,
        birth_certificate_number: text(submitted.learner_id_or_birth_certificate, 120) || null,
        guardian_name: guardianName,
        guardian_relationship: text(submitted.guardian_relationship, 80) || null,
        guardian_id_number: text(submitted.guardian_id_or_passport, 120) || null,
        parent_phone: parentPhone,
        parent_email: text(submitted.guardian_email, 180) || null,
        home_address: text(submitted.home_address, 1000) || null,
        has_medical_aid: Boolean(text(medical.medical_aid_name, 180) || text(medical.medical_aid_number, 120)),
        medical_aid_name: text(medical.medical_aid_name, 180) || null,
        medical_aid_number: text(medical.medical_aid_number, 120) || null,
        medical_aid_main_member: text(medical.medical_aid_main_member, 180) || null,
        family_doctor_name: text(medical.preferred_doctor_name, 180) || null,
        family_doctor_phone: text(medical.preferred_doctor_phone, 40) || null,
        allergies: text(medical.allergies, 2000) || null,
        medical_conditions: text(medical.conditions, 2000) || null,
        medical_instructions: [text(medical.immunisation_status, 80) && `Immunisation: ${text(medical.immunisation_status, 80)}`, text(medical.immunisation_notes, 1000)].filter(Boolean).join("\n") || null,
        registration_fee_amount: Number(enquiry.registration_fee_amount || 0),
        registration_fee_paid_at: enquiry.registration_payment_status === "verified" ? new Date(enquiry.registration_payment_verified_at || Date.now()).toISOString().slice(0, 10) : null,
        registration_fee_reference: text(enquiry.registration_payment_reference, 180) || null,
        monthly_fee_type_id: selectedMonthlyFee?.id || null,
        monthly_fee: selectedMonthlyFee ? Number(selectedMonthlyFee.amount || 0) : 0,
      });
      if (learnerError) return NextResponse.json({ error: learnerError.message }, { status: learnerError.code === "23505" ? 409 : 500 });
      const { error: placementError } = await supabaseAdmin.from("learner_placements").insert({ learner_id: learnerId, school_id: schoolId, academic_year: academicYear, classroom_id: ageMatchedClassroom?.id || null, placement_status: ageMatchedClassroom ? "current" : "pending" });
      if (placementError) {
        await supabaseAdmin.from("learners").delete().eq("id", learnerId).eq("school_id", schoolId);
        return NextResponse.json({ error: placementError.message }, { status: 500 });
      }
    }
    if (decision === "approved") {
      const submitted = enquiry.submitted_data && typeof enquiry.submitted_data === "object" && !Array.isArray(enquiry.submitted_data)
        ? enquiry.submitted_data as Record<string, unknown>
        : {};
      const requestedAddonIds = Array.isArray(submitted.requested_recurring_addon_ids)
        ? submitted.requested_recurring_addon_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
        : [];
      if (requestedAddonIds.length) {
        const { data: addons, error: addonError } = await supabaseAdmin.from("school_fee_types").select("id, amount").eq("school_id", schoolId).eq("fee_category", "recurring_addon").eq("is_active", true).in("id", requestedAddonIds);
        if (addonError) return NextResponse.json({ error: addonError.message }, { status: 500 });
        const startDate = Number(enquiry.academic_year) > new Date().getFullYear()
          ? `${enquiry.academic_year}-01-01`
          : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10);
        const assignments = (addons || []).map((addon) => ({ school_id: schoolId, learner_id: learnerId, fee_type_id: addon.id, assigned_amount: Number(addon.amount || 0), start_date: startDate, is_active: true, assigned_by: authorization.staff.userId }));
        if (assignments.length) {
          const { error: assignmentError } = await supabaseAdmin.from("learner_recurring_fee_assignments").upsert(assignments, { onConflict: "school_id,learner_id,fee_type_id" });
          if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
        }
      }
    }
    const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({
      status: decision,
      learner_id: decision === "approved" ? learnerId : enquiry.learner_id,
      decline_reason: decision === "declined" ? text(body.decline_reason, 1000) : null,
      reviewed_by: authorization.staff.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) {
      if (decision === "approved" && !enquiry.learner_id && learnerId) await supabaseAdmin.from("learners").delete().eq("id", learnerId).eq("school_id", schoolId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await writeSecurityAudit(authorization.staff, `enrolment.${decision}`, { school_id: schoolId, enquiry_id: enquiryId, learner_id: learnerId || null, classroom_allocation: decision === "approved" ? "age_matched_for_current_year_manual_capture" : null });
    return NextResponse.json({ success: true, learner_id: decision === "approved" ? learnerId : null });
  }

  if (action === "assign_waiting_classroom") {
    if (enquiry.status !== "approved" || !enquiry.learner_id) return NextResponse.json({ error: "Only an approved waiting-list learner can be placed." }, { status: 400 });
    const classroomId = Number(body.classroom_id);
    const { data: classroom, error: classroomError } = await supabaseAdmin.from("classrooms").select("id, classroom_name").eq("id", classroomId).eq("school_id", schoolId).maybeSingle();
    if (classroomError || !classroom) return NextResponse.json({ error: "Choose a classroom from this school." }, { status: 400 });
    const { error: placementError } = await supabaseAdmin.from("learner_placements").update({ classroom_id: classroom.id, placement_status: Number(enquiry.academic_year) > new Date().getFullYear() ? "future" : "current", updated_at: new Date().toISOString() }).eq("learner_id", enquiry.learner_id).eq("school_id", schoolId).eq("academic_year", enquiry.academic_year);
    if (placementError) return NextResponse.json({ error: placementError.message }, { status: 500 });
    if (Number(enquiry.academic_year) <= new Date().getFullYear()) {
      const { error: learnerError } = await supabaseAdmin.from("learners").update({ classroom_id: classroom.id, class: classroom.classroom_name }).eq("id", enquiry.learner_id).eq("school_id", schoolId);
      if (learnerError) return NextResponse.json({ error: learnerError.message }, { status: 500 });
    }
    await writeSecurityAudit(authorization.staff, "enrolment.waiting_list_placed", { school_id: schoolId, enquiry_id: enquiry.id, learner_id: enquiry.learner_id, academic_year: enquiry.academic_year, classroom_id: classroom.id });
    return NextResponse.json({ success: true });
  }

  if (action === "withdraw") {
    const reason = text(body.withdraw_reason, 1000);
    if (!reason) return NextResponse.json({ error: "Add a reason for withdrawing this enrolment." }, { status: 400 });
    if (["approved", "withdrawn"].includes(String(enquiry.status))) return NextResponse.json({ error: "This enrolment cannot be withdrawn." }, { status: 400 });
    const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({ status: "withdrawn", decline_reason: reason, form_token_hash: null, form_token_expires_at: null, form_access_session_hash: null, form_access_session_expires_at: null, updated_at: new Date().toISOString() }).eq("id", enquiryId).eq("school_id", schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "enrolment.withdrawn", { school_id: schoolId, enquiry_id: enquiryId, reason });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_withdrawn") {
    if (enquiry.status !== "withdrawn") return NextResponse.json({ error: "Only withdrawn enrolments can be deleted." }, { status: 400 });
    const { data: deleted, error } = await supabaseAdmin.from("school_enrolment_enquiries").delete().eq("id", enquiryId).eq("school_id", schoolId).eq("status", "withdrawn").select("id").maybeSingle();
    if (error || !deleted) return NextResponse.json({ error: error?.message || "The withdrawn enrolment could not be deleted." }, { status: 500 });
    await writeSecurityAudit(authorization.staff, "enrolment.withdrawn_deleted", { school_id: schoolId, enquiry_id: enquiryId, reference: enquiry.enquiry_reference });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown enrolment action." }, { status: 400 });
}

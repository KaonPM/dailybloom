import { NextResponse } from "next/server";
import { createEnrolmentAccessCode, FORM_ACCESS_CODE_LIFETIME_MS, hashEnrolmentSecret } from "@/app/lib/enrolment-form-security";
import { sendTrackedEnrolmentWhatsApp } from "@/app/lib/enrolment-whatsapp-delivery";
import { enforceRateLimit } from "@/app/lib/rate-limit";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

async function findEnquiry(token: string) {
  if (!token || token.length < 30) return null;
  const { data } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, school_id, parent_name, parent_phone, enquiry_reference, status, form_token_expires_at, form_access_otp_resend_available_at, form_access_otp_send_count, schools(school_name)")
    .eq("form_token_hash", hashEnrolmentSecret(token))
    .maybeSingle();
  if (!data || !data.form_token_expires_at || new Date(data.form_token_expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = text(body.token, 200);
  const limit = await enforceRateLimit(request, "enrolment-form-access-request", 5, 60 * 60, hashEnrolmentSecret(token));
  if (limit) return limit;

  const enquiry = await findEnquiry(token);
  if (!enquiry || enquiry.status !== "form_issued") {
    return NextResponse.json({ error: "This enrolment link is invalid, expired or has already been submitted." }, { status: 400 });
  }

  const now = Date.now();
  const resendAvailableAt = enquiry.form_access_otp_resend_available_at
    ? new Date(enquiry.form_access_otp_resend_available_at).getTime()
    : 0;
  if (resendAvailableAt > now) {
    return NextResponse.json({ error: "Please wait one minute before requesting another verification code." }, { status: 429 });
  }
  if (Number(enquiry.form_access_otp_send_count || 0) >= 3) {
    return NextResponse.json({ error: "For security, this form has reached its code resend limit. Please ask the school to resend a new secure form link." }, { status: 429 });
  }

  const code = createEnrolmentAccessCode();
  const expiresAt = new Date(now + FORM_ACCESS_CODE_LIFETIME_MS).toISOString();
  const nextResendAt = new Date(now + 60 * 1000).toISOString();
  const { error: prepareError } = await supabaseAdmin.from("school_enrolment_enquiries").update({
    form_access_otp_hash: hashEnrolmentSecret(code),
    form_access_otp_expires_at: expiresAt,
    form_access_otp_resend_available_at: nextResendAt,
    form_access_otp_attempts: 0,
    form_access_otp_locked_until: null,
    form_access_otp_send_count: Number(enquiry.form_access_otp_send_count || 0) + 1,
    form_access_otp_delivery_status: "sending",
    form_access_otp_delivery_error: null,
  }).eq("id", enquiry.id);
  if (prepareError) return NextResponse.json({ error: prepareError.message }, { status: 500 });

  const school = Array.isArray(enquiry.schools) ? enquiry.schools[0] : enquiry.schools;
  const delivery = await sendTrackedEnrolmentWhatsApp({
    enquiryId: enquiry.id,
    schoolId: Number(enquiry.school_id),
    kind: "access_code",
    phone: enquiry.parent_phone,
    bodyParameters: [enquiry.parent_name, school?.school_name || "your school", code, "10 minutes"],
    accessCode: code,
  });
  if (delivery.sent) {
    return NextResponse.json({ success: true, expires_at: expiresAt, resend_available_at: nextResendAt });
  }
  await supabaseAdmin.from("school_enrolment_enquiries").update({
    form_access_otp_hash: null,
    form_access_otp_expires_at: null,
    form_access_otp_delivery_status: "failed",
    form_access_otp_delivery_error: delivery.error,
  }).eq("id", enquiry.id);
  return NextResponse.json({ error: "The verification code could not be sent. Please try again or contact the school." }, { status: 502 });
}

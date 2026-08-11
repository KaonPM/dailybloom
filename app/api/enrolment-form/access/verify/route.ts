import { NextResponse } from "next/server";
import { accessCookieName, createEnrolmentAccessSession, FORM_ACCESS_SESSION_LIFETIME_MS, hashEnrolmentSecret, hasMatchingSecret } from "@/app/lib/enrolment-form-security";
import { enforceRateLimit } from "@/app/lib/rate-limit";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

async function findEnquiry(token: string) {
  if (!token || token.length < 30) return null;
  const { data } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, status, form_token_expires_at, form_access_otp_hash, form_access_otp_expires_at, form_access_otp_attempts, form_access_otp_locked_until")
    .eq("form_token_hash", hashEnrolmentSecret(token))
    .maybeSingle();
  if (!data || !data.form_token_expires_at || new Date(data.form_token_expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = text(body.token, 200);
  const code = text(body.code, 10);
  const limit = await enforceRateLimit(request, "enrolment-form-access-verify", 10, 60 * 60, hashEnrolmentSecret(token));
  if (limit) return limit;

  const enquiry = await findEnquiry(token);
  if (!enquiry || enquiry.status !== "form_issued") {
    return NextResponse.json({ error: "This enrolment link is invalid, expired or has already been submitted." }, { status: 400 });
  }

  const now = Date.now();
  if (enquiry.form_access_otp_locked_until && new Date(enquiry.form_access_otp_locked_until).getTime() > now) {
    return NextResponse.json({ error: "Too many incorrect attempts. Please wait 15 minutes or ask the school to resend the form." }, { status: 429 });
  }
  if (!enquiry.form_access_otp_hash || !enquiry.form_access_otp_expires_at || new Date(enquiry.form_access_otp_expires_at).getTime() < now) {
    return NextResponse.json({ error: "Request a new WhatsApp verification code before continuing." }, { status: 400 });
  }
  if (!hasMatchingSecret(code, enquiry.form_access_otp_hash)) {
    const attempts = Number(enquiry.form_access_otp_attempts || 0) + 1;
    await supabaseAdmin.from("school_enrolment_enquiries").update({
      form_access_otp_attempts: attempts,
      form_access_otp_locked_until: attempts >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null,
    }).eq("id", enquiry.id);
    return NextResponse.json({ error: attempts >= 5 ? "Too many incorrect attempts. Please wait 15 minutes before trying again." : "That verification code is incorrect." }, { status: 400 });
  }

  const session = createEnrolmentAccessSession();
  const formExpiry = new Date(enquiry.form_token_expires_at).getTime();
  const sessionExpiresAt = new Date(Math.min(formExpiry, now + FORM_ACCESS_SESSION_LIFETIME_MS));
  const { error } = await supabaseAdmin.from("school_enrolment_enquiries").update({
    form_access_otp_hash: null,
    form_access_otp_expires_at: null,
    form_access_otp_attempts: 0,
    form_access_otp_locked_until: null,
    form_access_session_hash: hashEnrolmentSecret(session),
    form_access_session_expires_at: sessionExpiresAt.toISOString(),
  }).eq("id", enquiry.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ success: true });
  response.cookies.set(accessCookieName(token), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: sessionExpiresAt,
  });
  return response;
}

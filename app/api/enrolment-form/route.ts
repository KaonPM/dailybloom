import { NextResponse } from "next/server";
import {
  accessCookieName,
  hashEnrolmentSecret,
  hasMatchingSecret,
  readRequestCookie,
} from "@/app/lib/enrolment-form-security";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function text(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function findEnquiry(token: string) {
  if (!token || token.length < 30) return null;
  const { data } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .select("id, school_id, enquiry_reference, parent_name, status, form_token_expires_at, form_access_session_hash, form_access_session_expires_at, school_enrolment_forms(form_name, form_type, instructions), schools(school_name)")
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

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const enquiry = await findEnquiry(token);
  if (!enquiry || !["form_issued", "submitted"].includes(String(enquiry.status))) {
    return NextResponse.json({ error: "This enrolment link is invalid or has expired." }, { status: 404 });
  }
  if (!hasFormAccess(request, token, enquiry)) {
    return accessCodeRequiredResponse();
  }
  const school = one(enquiry.schools as { school_name?: string } | { school_name?: string }[] | null);
  const form = one(enquiry.school_enrolment_forms as Record<string, unknown> | Record<string, unknown>[] | null);
  return NextResponse.json({
    reference: enquiry.enquiry_reference,
    parent_name: enquiry.parent_name,
    status: enquiry.status,
    school_name: school?.school_name || "School",
    form,
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
  const learnerFirstName = text(body.learner_first_name, 120);
  const learnerSurname = text(body.learner_surname, 120);
  const dateOfBirth = text(body.date_of_birth, 30);
  const guardianName = text(body.guardian_name, 180);
  const guardianPhone = text(body.guardian_phone, 40);
  const parentPortalPhone = toSouthAfricanSmsNumber(text(body.parent_portal_phone, 40));
  if (!learnerFirstName || !learnerSurname || !dateOfBirth || !guardianName || !guardianPhone || !parentPortalPhone) {
    return NextResponse.json({ error: "Complete the learner, parent or guardian and Parent Portal mobile number before submitting." }, { status: 400 });
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
    submitted_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("school_enrolment_enquiries")
    .update({
      status: "submitted",
      submitted_data: submittedData,
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

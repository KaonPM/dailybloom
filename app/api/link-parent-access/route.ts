import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { sendSms } from "@/app/lib/sms-portal";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("27") ? `0${digits.slice(2)}` : digits;
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const learnerId = String(body.learner_id || "");
  const phone = normalizePhone(String(body.phone || ""));
  const authorization = await requireStaffPermission(request, PERMISSIONS.PARENT_ACCESS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (!schoolId || !learnerId || !phone) return NextResponse.json({ error: "School, learner and parent phone are required." }, { status: 400 });

  const { data: learner } = await supabaseAdmin.from("learners").select("id, parent_phone")
    .eq("id", learnerId).eq("school_id", schoolId).maybeSingle();
  if (!learner || normalizePhone(String(learner.parent_phone || "")) !== phone) {
    return NextResponse.json({ error: "Parent contact does not match this learner." }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin.from("parent_access").select("id, pin_hash")
    .eq("phone", phone).eq("learner_id", learnerId).maybeSingle();
  if (existing?.pin_hash) return NextResponse.json({ success: true, temporary_pin: null });

  const { data: existingPhoneAccess } = await supabaseAdmin.from("parent_access")
    .select("pin_hash, must_change_pin").eq("phone", phone).not("pin_hash", "is", null).limit(1).maybeSingle();
  if (existingPhoneAccess?.pin_hash) {
    const { error: linkError } = await supabaseAdmin.from("parent_access").upsert({
      phone, learner_id: learnerId, pin_hash: existingPhoneAccess.pin_hash,
      must_change_pin: Boolean(existingPhoneAccess.must_change_pin),
      failed_login_attempts: 0, locked_until: null,
    }, { onConflict: "phone,learner_id" });
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "parent.learner_linked", { learner_id: learnerId, school_id: schoolId });
    return NextResponse.json({ success: true, temporary_pin: null });
  }

  const temporaryPin = String(crypto.randomInt(100000, 1000000));
  const pinHash = await bcrypt.hash(temporaryPin, 10);
  const temporaryPinExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from("parent_access").upsert({
    phone, learner_id: learnerId, pin_hash: pinHash, must_change_pin: true,
    failed_login_attempts: 0, locked_until: null, session_token: null,
    session_token_hash: null, session_expires_at: null, temporary_pin_expires_at: temporaryPinExpiresAt,
    invite_delivery_status: "pending", invite_error: null,
  }, { onConflict: "phone,learner_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: school } = await supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle();
  const schoolName = school?.school_name || "Your preschool";
  try {
    const sms = await sendSms(phone, `${schoolName} invited you to DailyBloom. Temporary Parent Portal PIN: ${temporaryPin}. Sign in at dailybloom.co.za/parent-login. Expires in 24 hours. Do not share this code.`);
    await supabaseAdmin.from("parent_access").update({ invite_sent_at: new Date().toISOString(), invite_delivery_status: "sent", invite_provider_message_id: sms.providerMessageId, invite_error: null }).eq("phone", phone);
    await writeSecurityAudit(authorization.staff, "parent.access_invited", { learner_id: learnerId, school_id: schoolId, sms_sent: true });
    return NextResponse.json({ success: true, sms_sent: true, temporary_pin: null });
  } catch (smsError: any) {
    await supabaseAdmin.from("parent_access").update({ invite_delivery_status: "failed", invite_error: smsError?.message || "SMS failed" }).eq("phone", phone);
    await writeSecurityAudit(authorization.staff, "parent.access_invited", { learner_id: learnerId, school_id: schoolId, sms_sent: false });
    return NextResponse.json({ success: true, sms_sent: false, temporary_pin: temporaryPin, warning: "SMS could not be delivered. Verify the parent before sharing the temporary PIN." });
  }
}

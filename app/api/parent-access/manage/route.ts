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

async function loadGroups(schoolId: number) {
  const { data: learners, error } = await supabaseAdmin.from("learners")
    .select("id, name, parent_name, parent_phone").eq("school_id", schoolId)
    .or("is_deleted.is.null,is_deleted.eq.false").order("name");
  if (error) throw error;
  const phones = [...new Set((learners || []).map((row) => normalizePhone(String(row.parent_phone || ""))).filter(Boolean))];
  const { data: accessRows } = phones.length ? await supabaseAdmin.from("parent_access")
    .select("phone, pin_hash, must_change_pin, invite_sent_at, invite_delivery_status, invite_error, temporary_pin_expires_at").in("phone", phones) : { data: [] };
  return phones.map((phone) => {
    const linkedLearners = (learners || []).filter((row) => normalizePhone(String(row.parent_phone || "")) === phone);
    const access = (accessRows || []).find((row) => normalizePhone(String(row.phone || "")) === phone);
    return { phone, parent_name: linkedLearners[0]?.parent_name || "Parent/guardian", learners: linkedLearners.map((row) => ({ id: row.id, name: row.name })), status: access?.pin_hash && !access.must_change_pin ? "active" : access?.invite_delivery_status || "not_invited", invite_sent_at: access?.invite_sent_at || null, invite_error: access?.invite_error || null };
  });
}

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.PARENT_ACCESS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  try { return NextResponse.json({ groups: await loadGroups(schoolId) }); }
  catch (error: any) { return NextResponse.json({ error: error?.message || "Could not load parent access." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const requestedPhones = [...new Set((body.phones || []).map((value: unknown) => normalizePhone(String(value))).filter(Boolean))] as string[];
  const authorization = await requireStaffPermission(request, PERMISSIONS.PARENT_ACCESS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (!requestedPhones.length) return NextResponse.json({ error: "Select at least one parent." }, { status: 400 });
  const groups = (await loadGroups(schoolId)).filter((group) => requestedPhones.includes(group.phone));
  const { data: school } = await supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle();
  const results = [];
  for (const group of groups) {
    const temporaryPin = String(crypto.randomInt(100000, 1000000));
    const pinHash = await bcrypt.hash(temporaryPin, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const learner of group.learners) {
      await supabaseAdmin.from("parent_access").upsert({ phone: group.phone, learner_id: learner.id, pin_hash: pinHash, must_change_pin: true, temporary_pin_expires_at: expiresAt, failed_login_attempts: 0, locked_until: null, session_token: null, session_token_hash: null, session_expires_at: null, invite_delivery_status: "pending", invite_error: null }, { onConflict: "phone,learner_id" });
    }
    try {
      const sms = await sendSms(group.phone, `${school?.school_name || "Your preschool"} invited you to DailyBloom. Temporary Parent Portal PIN: ${temporaryPin}. Sign in at dailybloom.co.za/parent-login. Expires in 24 hours. Do not share this code.`);
      await supabaseAdmin.from("parent_access").update({ invite_sent_at: new Date().toISOString(), invite_delivery_status: "sent", invite_provider_message_id: sms.providerMessageId, invite_error: null }).eq("phone", group.phone);
      results.push({ phone: group.phone, sent: true });
    } catch (error: any) {
      await supabaseAdmin.from("parent_access").update({ invite_delivery_status: "failed", invite_error: error?.message || "SMS failed" }).eq("phone", group.phone);
      results.push({ phone: group.phone, sent: false, error: error?.message || "SMS failed" });
    }
  }
  await writeSecurityAudit(authorization.staff, "parent.bulk_invited", { school_id: schoolId, requested: groups.length, sent: results.filter((item) => item.sent).length });
  return NextResponse.json({ results });
}

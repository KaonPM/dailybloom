import "server-only";

import { Resend } from "resend";
import { getJohannesburgDate } from "@/app/lib/classroom-activity-dates";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type HealthRow = {
  school_id: number;
  school_name?: string | null;
  classroom_count?: number | null;
  learner_count?: number | null;
  practitioner_count?: number | null;
  attendance_count?: number | null;
  summary_count?: number | null;
  broadcast_count?: number | null;
};

type Recipient = {
  id: string;
  school_id: number;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function startOfWeek(date = new Date()) {
  const today = getJohannesburgDate(date);
  const midnight = new Date(`${today}T00:00:00+02:00`);
  const day = midnight.getUTCDay();
  midnight.setUTCDate(midnight.getUTCDate() - (day === 0 ? 6 : day - 1));
  return midnight.toISOString().slice(0, 10);
}

function digestStatus(row: HealthRow) {
  const classrooms = Number(row.classroom_count || 0);
  const learners = Number(row.learner_count || 0);
  const practitioners = Number(row.practitioner_count || 0);
  const activity = Number(row.attendance_count || 0) + Number(row.summary_count || 0) + Number(row.broadcast_count || 0);
  const nextStep = classrooms === 0 ? "Add a classroom" : learners === 0 ? "Add learners" : practitioners === 0 ? "Invite a practitioner" : activity === 0 ? "Record attendance or share an update this week" : "Keep your weekly routine going";
  return { classrooms, learners, practitioners, activity, nextStep, needsAttention: classrooms === 0 || learners === 0 || practitioners === 0 || activity === 0 };
}

function appUrl() {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return configured.startsWith("https://") ? configured.replace(/\/+$/, "") : "https://dailybloom.co.za";
}

async function reserveDelivery(row: HealthRow, recipient: Recipient, weekStart: string, sourceType: string) {
  const sourceId = `${row.school_id}:${recipient.id}:${weekStart}`;
  const { error } = await supabaseAdmin.from("communication_notifications").insert({
    school_id: row.school_id,
    recipient_user_id: recipient.id,
    recipient_name: recipient.full_name || null,
    recipient_email: recipient.email || null,
    channel: "email",
    communication_type: "School adoption weekly digest",
    source_type: sourceType,
    source_id: sourceId,
    subject: `Your weekly DailyBloom summary — ${row.school_name || "School"}`,
    body_preview: "Weekly school activity and next-step summary.",
    status: "sending",
    attempt_count: 1,
  });
  if (!error) return sourceId;
  if (error.code === "23505") return null;
  throw error;
}

async function updateDelivery(sourceId: string, values: Record<string, unknown>, sourceType: string) {
  await supabaseAdmin.from("communication_notifications").update(values).eq("source_type", sourceType).eq("source_id", sourceId).eq("channel", "email");
}

export async function sendSchoolAdoptionWeeklyDigests(options: { schoolId?: number; test?: boolean } = {}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("Missing Resend API key.");

  const weekStart = startOfWeek();
  const [{ data: health, error: healthError }, { data: recipients, error: recipientError }] = await Promise.all([
    supabaseAdmin.rpc("school_adoption_weekly_health", { p_week_start: weekStart }),
    supabaseAdmin.from("profiles").select("id, school_id, full_name, email, role").in("role", ["principal", "admin", "owner"]).eq("is_active", true).not("email", "is", null),
  ]);
  if (healthError || recipientError) throw healthError || recipientError;

  const recipientsBySchool = new Map<number, Recipient[]>();
  for (const recipient of (recipients || []) as Recipient[]) {
    const schoolId = Number(recipient.school_id || 0);
    if (!schoolId || !recipient.email) continue;
    recipientsBySchool.set(schoolId, [...(recipientsBySchool.get(schoolId) || []), recipient]);
  }

  const resend = new Resend(resendKey);
  const sourceType = options.test ? "school_adoption_test_digest" : "school_adoption_weekly_digest";
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const url = `${appUrl()}/dashboard`;

  for (const row of (health || []) as HealthRow[]) {
    if (options.schoolId && Number(row.school_id) !== options.schoolId) continue;
    const summary = digestStatus(row);
    for (const recipient of recipientsBySchool.get(Number(row.school_id)) || []) {
      const sourceId = await reserveDelivery(row, recipient, options.test ? `${weekStart}:test:${Date.now()}` : weekStart, sourceType);
      if (!sourceId) { skipped += 1; continue; }
      const schoolName = escapeHtml(row.school_name || "your school");
      const greeting = escapeHtml(recipient.full_name || "School leader");
      const subject = `${options.test ? "[Test] " : ""}${summary.needsAttention ? "Action needed" : "Weekly summary"} — ${row.school_name || "DailyBloom"}`;
      const result = await resend.emails.send({
        from: process.env.DAILYBLOOM_FROM_EMAIL || "DailyBloom <onboarding@resend.dev>",
        to: recipient.email || "",
        subject,
        html: `<div style="font-family:Arial,sans-serif;background:#FFF8F2;padding:24px;color:#2D2A3E"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #F0E3D8;border-radius:18px;padding:26px">${options.test ? '<p style="margin:0 0 12px;color:#8A5D00;font-weight:700">Test email — no action is required.</p>' : ""}<h1 style="margin:0 0 8px">Your weekly school summary</h1><p>Hello ${greeting},</p><p>Here is this week’s DailyBloom activity for <strong>${schoolName}</strong>.</p><div style="background:#EAF7FD;border:1px solid #CBEAF7;border-radius:14px;padding:16px;margin:20px 0"><p><strong>Classrooms:</strong> ${summary.classrooms}</p><p><strong>Learners:</strong> ${summary.learners}</p><p><strong>Practitioners:</strong> ${summary.practitioners}</p><p><strong>Attendance records:</strong> ${Number(row.attendance_count || 0)}</p><p><strong>Daily summaries:</strong> ${Number(row.summary_count || 0)}</p><p><strong>Parent broadcasts:</strong> ${Number(row.broadcast_count || 0)}</p></div><p><strong>Suggested next step:</strong> ${escapeHtml(summary.nextStep)}</p><p><a href="${url}" style="display:inline-block;background:#75C7EA;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px">Open School Dashboard</a></p><p style="color:#6D6888">Thank you for keeping your school connected and up to date.</p></div></div>`,
      });
      if (result.error) {
        failed += 1;
        await updateDelivery(sourceId, { status: "failed", failed_at: new Date().toISOString(), error_message: result.error.message }, sourceType);
      } else {
        sent += 1;
        await updateDelivery(sourceId, { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.data?.id || null }, sourceType);
      }
    }
  }
  return { week_start: weekStart, sent, skipped, failed };
}

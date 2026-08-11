import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const ALLOWED_CHANNELS = new Set(["parent_portal", "in_app", "push", "sms", "whatsapp", "email"]);
const ALLOWED_STATUSES = new Set(["queued", "sending", "sent", "delivered", "read", "retry_scheduled", "failed", "skipped"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id") || 0);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(request, PERMISSIONS.COMMUNICATIONS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const channel = String(url.searchParams.get("channel") || "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const learnerId = String(url.searchParams.get("learner_id") || "").trim();
  const search = String(url.searchParams.get("search") || "").trim().slice(0, 100);

  let query = supabaseAdmin
    .from("communication_notifications")
    .select("id, school_id, learner_id, recipient_name, recipient_phone, recipient_email, recipient_count, channel, communication_type, direction, subject, body_preview, status, attempt_count, next_retry_at, sent_at, delivered_at, read_at, failed_at, error_message, metadata, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  if (ALLOWED_CHANNELS.has(channel)) query = query.eq("channel", channel);
  if (ALLOWED_STATUSES.has(status)) query = query.eq("status", status);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(learnerId)) {
    query = query.eq("learner_id", learnerId);
  }
  if (search) {
    const safe = search.replace(/[,%()]/g, " ").trim();
    if (safe) query = query.or(`recipient_name.ilike.%${safe}%,recipient_phone.ilike.%${safe}%,recipient_email.ilike.%${safe}%,communication_type.ilike.%${safe}%,subject.ilike.%${safe}%,body_preview.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data || [] });
}

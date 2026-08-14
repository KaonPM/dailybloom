import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const ALLOWED_CHANNELS = new Set(["parent_portal", "in_app", "push", "sms", "whatsapp", "email"]);
const ALLOWED_STATUSES = new Set(["queued", "sending", "sent", "delivered", "read", "retry_scheduled", "failed", "skipped"]);

type NotificationRow = Record<string, unknown> & {
  id: string;
  learner_id?: string | null;
  created_by?: string | null;
  channel?: string | null;
  communication_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  metadata?: unknown;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  subject?: string | null;
  body_preview?: string | null;
};

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id") || 0);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(request, PERMISSIONS.MESSAGE_VIEW, schoolId);
  if (!authorization.ok) return authorization.response;

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const channel = String(url.searchParams.get("channel") || "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const learnerId = String(url.searchParams.get("learner_id") || "").trim();
  const classroomId = Number(url.searchParams.get("classroom_id") || 0);
  const communicationType = String(url.searchParams.get("communication_type") || "").trim().toLowerCase();
  const search = String(url.searchParams.get("search") || "").trim().slice(0, 100).toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size") || 20)));

  let query = supabaseAdmin
    .from("communication_notifications")
    .select("id, school_id, learner_id, recipient_name, recipient_phone, recipient_email, recipient_count, channel, communication_type, direction, subject, body_preview, status, attempt_count, next_retry_at, sent_at, delivered_at, read_at, failed_at, error_message, metadata, source_type, source_id, created_by, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  if (ALLOWED_CHANNELS.has(channel)) query = query.eq("channel", channel);
  if (ALLOWED_STATUSES.has(status)) query = query.eq("status", status);
  if (learnerId) query = query.eq("learner_id", learnerId);

  const [{ data: rawNotifications, error }, { data: learners }, { data: classrooms }] = await Promise.all([
    query,
    supabaseAdmin.from("learners").select("id, name, class, classroom_id, parent_phone").eq("school_id", schoolId),
    supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId).order("classroom_name"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const learnerMap = new Map((learners || []).map((item) => [String(item.id), item]));
  const classroomMap = new Map((classrooms || []).map((item) => [Number(item.id), String(item.classroom_name || "")]));
  const assignedId = Number(authorization.staff.profile.classroom_id || 0);
  const assignedName = String(authorization.staff.profile.classroom_name || "").trim().toLowerCase();
  const practitionerClassroomId = authorization.staff.role === "teacher"
    ? assignedId || Number((classrooms || []).find((item) => String(item.classroom_name || "").trim().toLowerCase() === assignedName)?.id || 0)
    : 0;

  let enriched = ((rawNotifications || []) as NotificationRow[]).map((row) => {
    const learner = learnerMap.get(String(row.learner_id || ""));
    const metadata = metadataOf(row.metadata);
    const rowClassroomId = Number(learner?.classroom_id || metadata.classroom_id || 0);
    const metadataClassroomName = String(metadata.classroom_name || "").trim();
    return {
      ...row,
      learner_name: String(learner?.name || row.recipient_name || "General communication"),
      classroom_id: rowClassroomId || null,
      classroom_name: classroomMap.get(rowClassroomId) || String(learner?.class || "") || metadataClassroomName || "School-wide",
    };
  });

  if (authorization.staff.role === "teacher") {
    enriched = practitionerClassroomId
      ? enriched.filter((row) => Number(row.classroom_id || 0) === practitionerClassroomId)
      : [];
  }
  if (classroomId > 0) enriched = enriched.filter((row) => Number(row.classroom_id || 0) === classroomId);
  if (communicationType) enriched = enriched.filter((row) => String(row.communication_type || "").toLowerCase() === communicationType);
  if (search) {
    enriched = enriched.filter((row) => [row.learner_name, row.recipient_name, row.recipient_phone, row.recipient_email, row.communication_type, row.subject, row.body_preview, row.classroom_name]
      .some((value) => String(value || "").toLowerCase().includes(search)));
  }

  const creatorIds = [...new Set(enriched.map((row) => String(row.created_by || "")).filter(Boolean))];
  const creatorMap = new Map<string, string>();
  if (creatorIds.length) {
    const { data: creators } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", creatorIds);
    (creators || []).forEach((creator) => creatorMap.set(String(creator.id), String(creator.full_name || creator.email || "Staff member")));
  }
  enriched = enriched.map((row) => ({ ...row, sent_by_name: creatorMap.get(String(row.created_by || "")) || "DailyBloom" }));

  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (row: Record<string, unknown>) => String(row.status || "").toLowerCase();
  const summary = {
    sentToday: enriched.filter((row) => String(row.sent_at || row.created_at || "").slice(0, 10) === today && !["failed", "skipped"].includes(statusOf(row))).length,
    delivered: enriched.filter((row) => ["delivered", "read"].includes(statusOf(row))).length,
    read: enriched.filter((row) => statusOf(row) === "read").length,
    failed: enriched.filter((row) => statusOf(row) === "failed").length,
    awaiting: enriched.filter((row) => ["queued", "sending", "retry_scheduled"].includes(statusOf(row))).length,
  };
  const total = enriched.length;
  const start = (page - 1) * pageSize;
  const communicationTypes = [...new Set(enriched.map((row) => String(row.communication_type || "")).filter(Boolean))].sort();

  return NextResponse.json({
    notifications: enriched.slice(start, start + pageSize),
    summary,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    classrooms: authorization.staff.role === "teacher"
      ? (classrooms || []).filter((item) => Number(item.id) === practitionerClassroomId)
      : classrooms || [],
    communicationTypes,
  });
}

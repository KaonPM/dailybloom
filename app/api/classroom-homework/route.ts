import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  authenticatedRoleCanAccessLearner,
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "classroom-homework";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

async function notifyClassroomParents(schoolId: number, classroomId: number) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) return;
  const [{ data: learners }, { data: school }] = await Promise.all([
    supabaseAdmin.from("learners").select("parent_phone").eq("school_id", schoolId).eq("classroom_id", classroomId),
    supabaseAdmin.from("schools").select("school_name").eq("id", schoolId).maybeSingle(),
  ]);
  const phones = [...new Set((learners || []).map((row) => String(row.parent_phone || "").trim()).filter(Boolean))];
  if (!phones.length) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: phones },
      headings: { en: school?.school_name || "DailyBloom" },
      contents: { en: "New homework is ready to view and print." },
      url: `${siteUrl}/parent/homework`,
    }),
  });
  if (!response.ok) console.error("Homework push notification failed:", await response.text());
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const classroomId = Number(params.get("classroom_id"));
  const weekStart = String(params.get("week_start") || "");
  const activityDate = String(params.get("activity_date") || "");
  const homeworkId = Number(params.get("homework_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (classroomId && !(await authenticatedRoleCanAccessLearner(authorization.staff, classroomId))) {
    return NextResponse.json({ error: "Practitioners can only allocate homework to their assigned classroom." }, { status: 403 });
  }

  if (homeworkId) {
    const { data: item } = await supabaseAdmin.from("homework_library").select("file_path").eq("id", homeworkId).eq("school_id", schoolId).maybeSingle();
    if (!item?.file_path) return NextResponse.json({ error: "Homework not found." }, { status: 404 });
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(item.file_path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || "Homework could not be opened." }, { status: 400 });
    return NextResponse.json({ url: data.signedUrl });
  }

  const [libraryResult, assignmentResult] = await Promise.all([
    supabaseAdmin.from("homework_library").select("id, title, file_name, notes").eq("school_id", schoolId).eq("archived", false).order("title"),
    classroomId && weekStart && activityDate
      ? supabaseAdmin.from("homework_assignments").select("id, homework_id, instruction_note, due_date, position").eq("school_id", schoolId).eq("classroom_id", classroomId).eq("week_start", weekStart).eq("activity_date", activityDate).order("position")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (libraryResult.error || assignmentResult.error) return NextResponse.json({ error: libraryResult.error?.message || assignmentResult.error?.message }, { status: 400 });
  return NextResponse.json({ homework: libraryResult.data || [], assignments: assignmentResult.data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action || "");
  const schoolId = Number(body.school_id);
  const classroomId = Number(body.classroom_id);
  const title = String(body.title || "").trim().slice(0, 160);
  const authorization = await requireStaffPermission(
    request,
    classroomId
      ? PERMISSIONS.ACTIVITIES_MANAGE
      : PERMISSIONS.HOMEWORK_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;
  if (
    classroomId &&
    !(await authenticatedRoleCanAccessLearner(authorization.staff, classroomId))
  ) {
    return NextResponse.json({ error: "Practitioners can only upload homework for their assigned classroom." }, { status: 403 });
  }
  if (
    !classroomId &&
    !["principal", "admin"].includes(authorization.staff.role)
  ) {
    return NextResponse.json(
      { error: "Select a classroom before uploading homework." },
      { status: 400 }
    );
  }

  if (action === "create_upload") {
    const fileName = String(body.file_name || "").trim().slice(0, 240);
    const fileType = String(body.file_type || "");
    const fileSize = Number(body.file_size);
    if (!title || !fileName) {
      return NextResponse.json(
        { error: "Homework name and file are required." },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.has(fileType) || fileSize <= 0 || fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: "Upload a PDF, Word, JPG or PNG file no larger than 15 MB." },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${schoolId}/${crypto.randomUUID()}-${safeName}`;
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(filePath);
    if (error || !data?.token) {
      return NextResponse.json(
        { error: error?.message || "Homework upload could not be prepared." },
        { status: 400 }
      );
    }
    return NextResponse.json({ path: filePath, token: data.token });
  }

  if (action !== "complete_upload") {
    return NextResponse.json(
      { error: "Unsupported homework upload action." },
      { status: 400 }
    );
  }

  const fileName = String(body.file_name || "").trim().slice(0, 240);
  const filePath = String(body.file_path || "");
  if (!title || !fileName || !filePath.startsWith(`${schoolId}/`)) {
    return NextResponse.json(
      { error: "The completed homework upload details are invalid." },
      { status: 400 }
    );
  }
  const { data, error } = await supabaseAdmin.from("homework_library").insert({
    school_id: schoolId, title, notes: null, file_name: fileName, file_path: filePath, uploaded_by: authorization.staff.userId,
  }).select("id, title, file_name, notes").single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await writeSecurityAudit(authorization.staff, "homework.uploaded", { homework_id: data.id, title });
  return NextResponse.json({ homework: data });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const homeworkId = Number(params.get("homework_id"));
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.HOMEWORK_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;
  if (!["principal", "admin"].includes(authorization.staff.role)) {
    return NextResponse.json(
      { error: "Only a principal or authorised preschool administrator can archive homework." },
      { status: 403 }
    );
  }
  if (!homeworkId) {
    return NextResponse.json(
      { error: "Homework item is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("homework_library")
    .update({ archived: true })
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Homework item was not found." },
      { status: error ? 400 : 404 }
    );
  }
  await writeSecurityAudit(authorization.staff, "homework.archived", {
    homework_id: homeworkId,
  });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const classroomId = Number(body.classroom_id);
  const weekStart = String(body.week_start || "");
  const activityDate = String(body.activity_date || "");
  const items = Array.isArray(body.items) ? body.items.slice(0, 1) : [];
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (
    !classroomId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)
  ) {
    return NextResponse.json(
      { error: "Classroom, week and teaching date are required." },
      { status: 400 }
    );
  }
  if (!(await authenticatedRoleCanAccessLearner(authorization.staff, classroomId))) {
    return NextResponse.json({ error: "Practitioners can only allocate homework to their assigned classroom." }, { status: 403 });
  }

  const seenHomeworkIds = new Set<number>();
  const cleanItems = items
    .map((item: { homework_id?: unknown; instruction_note?: unknown; due_date?: unknown }, position: number) => ({
      homework_id:
        item.homework_id === null || item.homework_id === ""
          ? null
          : Number(item.homework_id),
      instruction_note: String(item.instruction_note || "").trim().slice(0, 500),
      due_date: String(item.due_date || ""),
      position,
    }))
    .filter((item: { homework_id: number | null; instruction_note: string; due_date: string }) => {
      if (item.homework_id === null) {
        return Boolean(item.instruction_note);
      }
      if (!Number.isFinite(item.homework_id) || item.homework_id <= 0 || seenHomeworkIds.has(item.homework_id)) {
        return false;
      }
      seenHomeworkIds.add(item.homework_id);
      return true;
    })
    .map((item: { homework_id: number | null; instruction_note: string; due_date: string; position: number }, position: number) => ({
      ...item,
      due_date:
        /^\d{4}-\d{2}-\d{2}$/.test(item.due_date) &&
        item.due_date >= activityDate
          ? item.due_date
          : activityDate,
      position,
    }));
  const { error } = await supabaseAdmin.rpc("replace_classroom_homework", {
    p_school_id: schoolId,
    p_classroom_id: classroomId,
    p_week_start: weekStart,
    p_activity_date: activityDate,
    p_assigned_by: authorization.staff.userId,
    p_items: cleanItems,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (body.notify_parent === true && body.week_has_homework === true) {
    await notifyClassroomParents(schoolId, classroomId);
  }
  await writeSecurityAudit(authorization.staff, "homework.week_published", {
    classroom_id: classroomId,
    week_start: weekStart,
    activity_date: activityDate,
    homework_count: cleanItems.length,
  });
  return NextResponse.json({ success: true });
}

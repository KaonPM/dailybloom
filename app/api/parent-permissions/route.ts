import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const permissionTypes = new Set(["photos_videos", "general", "school_excursion"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = Number(searchParams.get("school_id"));
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.PARENT_PERMISSIONS_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const { data, error } = await supabaseAdmin
    .from("parent_permission_requests")
    .select(`
      id, school_id, permission_type, title, description, event_date,
      response_deadline, status, created_at,
      parent_permission_request_learners(learner_id),
      parent_permission_responses(learner_id, response, parent_name, responded_at)
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.PARENT_PERMISSIONS_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const permissionType = String(body.permission_type || "");
  const title = String(body.title || "").trim().slice(0, 180);
  const description = String(body.description || "").trim().slice(0, 4000);
  const learnerIds = [...new Set(
    (Array.isArray(body.learner_ids) ? body.learner_ids : [])
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean)
  )];

  if (!permissionTypes.has(permissionType) || !title || !description || learnerIds.length === 0) {
    return NextResponse.json(
      { error: "Select a consent type and learners, then add a title and explanation." },
      { status: 400 }
    );
  }

  const { data: eligibleLearners, error: learnerError } = await supabaseAdmin
    .from("learners")
    .select("id, parent_phone")
    .eq("school_id", schoolId)
    .in("id", learnerIds);
  if (learnerError) return NextResponse.json({ error: learnerError.message }, { status: 500 });
  if ((eligibleLearners || []).length !== learnerIds.length) {
    return NextResponse.json({ error: "One or more selected learners are not available." }, { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("parent_permission_requests")
    .insert({
      school_id: schoolId,
      permission_type: permissionType,
      title,
      description,
      event_date: body.event_date || null,
      response_deadline: body.response_deadline || null,
      status: "sent",
      created_by: authorization.staff.userId,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return NextResponse.json({ error: createError?.message || "Could not create consent request." }, { status: 500 });
  }

  const { error: targetError } = await supabaseAdmin
    .from("parent_permission_request_learners")
    .insert(learnerIds.map((learnerId) => ({
      request_id: created.id,
      learner_id: learnerId,
      school_id: schoolId,
    })));
  if (targetError) {
    await supabaseAdmin.from("parent_permission_requests").delete().eq("id", created.id);
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  await writeSecurityAudit(authorization.staff, "parent_permission.sent", {
    school_id: schoolId,
    request_id: created.id,
    permission_type: permissionType,
    learners: learnerIds.length,
  });

  return NextResponse.json({
    request_id: created.id,
    parent_phones: [...new Set((eligibleLearners || [])
      .map((learner) => String(learner.parent_phone || "").trim())
      .filter(Boolean))],
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const requestId = Number(body.request_id);
  const status = String(body.status || "");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.PARENT_PERMISSIONS_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;
  if (!requestId || !["sent", "closed"].includes(status)) {
    return NextResponse.json({ error: "A valid request and status are required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("parent_permission_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("school_id", schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeSecurityAudit(authorization.staff, "parent_permission.status_updated", {
    school_id: schoolId,
    request_id: requestId,
    status,
  });
  return NextResponse.json({ success: true });
}

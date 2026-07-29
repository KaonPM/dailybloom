import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const learnerId = String(searchParams.get("learner_id") || "");
  const schoolId = Number(searchParams.get("school_id"));
  if (!parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("parent_permission_request_learners")
    .select(`
      request_id, learner_id,
      parent_permission_requests!inner(
        id, permission_type, title, description, event_date,
        response_deadline, status, created_at
      )
    `)
    .eq("learner_id", learnerId)
    .eq("school_id", schoolId)
    .eq("parent_permission_requests.status", "sent")
    .order("created_at", {
      ascending: false,
      referencedTable: "parent_permission_requests",
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const requestIds = (data || []).map((row) => row.request_id);
  const { data: responseRows, error: responseError } = requestIds.length
    ? await supabaseAdmin
        .from("parent_permission_responses")
        .select("request_id, learner_id, response, parent_name, responded_at")
        .eq("learner_id", learnerId)
        .in("request_id", requestIds)
    : { data: [], error: null };
  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });
  const responseByRequest = new Map((responseRows || []).map((row) => [row.request_id, row]));
  return NextResponse.json({
    requests: (data || []).map((row) => ({
      ...row,
      parent_permission_responses: responseByRequest.get(row.request_id) || null,
    })),
  });
}

export async function PATCH(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  const body = await request.json();
  const learnerId = String(body.learner_id || "");
  const schoolId = Number(body.school_id);
  const requestId = Number(body.request_id);
  const response = String(body.response || "");
  const parentName = String(body.parent_name || "").trim().slice(0, 160);
  if (!parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!requestId || !["granted", "declined"].includes(response) || !parentName) {
    return NextResponse.json({ error: "Choose a response and enter your full name." }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("parent_permission_request_learners")
    .select("request_id, parent_permission_requests!inner(status, response_deadline)")
    .eq("request_id", requestId)
    .eq("learner_id", learnerId)
    .eq("school_id", schoolId)
    .eq("parent_permission_requests.status", "sent")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Permission request is no longer available." }, { status: 404 });

  const requestRecord = Array.isArray(target.parent_permission_requests)
    ? target.parent_permission_requests[0]
    : target.parent_permission_requests;
  if (requestRecord?.response_deadline && requestRecord.response_deadline < new Date().toISOString().split("T")[0]) {
    return NextResponse.json({ error: "The response deadline has passed. Please contact the school." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("parent_permission_responses")
    .upsert({
      request_id: requestId,
      learner_id: learnerId,
      school_id: schoolId,
      response,
      parent_name: parentName,
      parent_phone: parent.phone || null,
      responded_at: now,
      updated_at: now,
    }, { onConflict: "request_id,learner_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, responded_at: now });
}

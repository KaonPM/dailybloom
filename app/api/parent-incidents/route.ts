import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getParentSessionHash } from "@/app/lib/parent-session";

async function getParentSession() {
  const sessionHash = await getParentSessionHash();
  if (!sessionHash) return null;
  const { data } = await supabaseAdmin.from("parent_access")
    .select("phone, learner_id").eq("session_token_hash", sessionHash)
    .gt("session_expires_at", new Date().toISOString());
  if (!data?.length) return null;
  const learnerIds = data.map((row) => String(row.learner_id));
  const { data: learners } = await supabaseAdmin.from("learners").select("parent_name").in("id", learnerIds).limit(1);
  return { phone: data[0].phone, learnerIds, name: learners?.[0]?.parent_name || "Parent/guardian" };
}

const parentSafeFields = `id, learner_id, learner_name, report_reference, incident_date,
  incident_time, incident_location, incident_type, description, action_taken, urgency,
  injury_occurred, injury_description, medical_assistance_required, parent_portal_message,
  parent_portal_published_at, parent_acknowledged_at, parent_acknowledged_by, parent_comment`;

export async function GET() {
  const parent = await getParentSession();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("incident_reports").select(parentSafeFields)
    .in("learner_id", parent.learnerIds).not("parent_portal_published_at", "is", null)
    .order("parent_portal_published_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data || [] });
}

export async function PATCH(request: Request) {
  const parent = await getParentSession();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  const body = await request.json();
  const reportId = Number(body.report_id);
  if (!reportId) return NextResponse.json({ error: "Report is required." }, { status: 400 });
  const { data: report } = await supabaseAdmin.from("incident_reports")
    .select("id, school_id, learner_id, parent_acknowledged_at")
    .eq("id", reportId).not("parent_portal_published_at", "is", null).maybeSingle();
  if (!report || !parent.learnerIds.includes(String(report.learner_id))) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (report.parent_acknowledged_at) return NextResponse.json({ acknowledged: true });
  const now = new Date().toISOString();
  const parentName = String(parent.name || "Parent/guardian").trim().slice(0, 120);
  const comment = String(body.comment || "").trim().slice(0, 2000) || null;
  const { error } = await supabaseAdmin.from("incident_reports").update({
    parent_acknowledged_at: now, parent_acknowledged_by: parentName,
    parent_comment: comment, updated_at: now,
  }).eq("id", reportId).eq("learner_id", report.learner_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("incident_report_audit").insert({
    incident_report_id: reportId, school_id: report.school_id, action: "parent_acknowledged",
    actor_name: parentName, details: { comment_added: Boolean(comment) },
  });
  return NextResponse.json({ acknowledged: true, acknowledged_at: now });
}

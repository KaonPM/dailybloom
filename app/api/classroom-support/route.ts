import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { authenticatedRoleCanAccessLearner, requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const VALID_STATUSES = new Set(["new", "active", "improving", "monitoring", "resolved"]);

function cleanText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

async function authorizeLearner(request: Request, schoolId: number, learnerId: string) {
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization;

  const { data: learner } = await supabaseAdmin
    .from("learners")
    .select("id, school_id, classroom_id, name")
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!learner) {
    return { ok: false as const, response: NextResponse.json({ error: "Learner not found." }, { status: 404 }) };
  }

  const mayAccess = await authenticatedRoleCanAccessLearner(authorization.staff, Number(learner.classroom_id || 0));
  if (!mayAccess) {
    return { ok: false as const, response: NextResponse.json({ error: "Teachers may only view support records for their assigned classroom." }, { status: 403 }) };
  }

  return { ok: true as const, staff: authorization.staff, learner };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id"));
  const learnerId = String(url.searchParams.get("learner_id") || "").trim();
  if (!schoolId || !learnerId) {
    return NextResponse.json({ error: "School and learner are required." }, { status: 400 });
  }

  const authorization = await authorizeLearner(request, schoolId, learnerId);
  if (!authorization.ok) return authorization.response;

  const [{ data: outcomes, error: outcomeError }, { data: updates, error: updateError }] = await Promise.all([
    supabaseAdmin
      .from("learner_activity_outcomes")
      .select("*")
      .eq("school_id", schoolId)
      .eq("learner_id", learnerId)
      .eq("outcome_status", "needs_support")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("learner_support_updates")
      .select("*")
      .eq("school_id", schoolId)
      .eq("learner_id", learnerId)
      .order("recorded_at", { ascending: false }),
  ]);

  if (outcomeError || updateError) {
    return NextResponse.json({ error: outcomeError?.message || updateError?.message || "Support records could not be loaded." }, { status: 400 });
  }

  return NextResponse.json({ learner: authorization.learner, outcomes: outcomes || [], updates: updates || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const learnerId = String(body.learner_id || "").trim();
  const outcomeId = Number(body.outcome_id);
  const supportStatus = String(body.support_status || "");
  const intervention = cleanText(body.intervention, 2000);
  const progressNote = cleanText(body.progress_note, 2000);
  const parentSummary = cleanText(body.parent_summary, 2000);
  const nextReviewDate = cleanText(body.next_review_date, 10);

  if (!schoolId || !learnerId || !outcomeId || !VALID_STATUSES.has(supportStatus)) {
    return NextResponse.json({ error: "A valid learner, support area and status are required." }, { status: 400 });
  }
  if (!intervention && !progressNote && !parentSummary) {
    return NextResponse.json({ error: "Add an intervention, progress note or parent-friendly summary." }, { status: 400 });
  }

  const authorization = await authorizeLearner(request, schoolId, learnerId);
  if (!authorization.ok) return authorization.response;

  const { data: outcome } = await supabaseAdmin
    .from("learner_activity_outcomes")
    .select("id, classroom_id, learner_id, school_id, developmental_area")
    .eq("id", outcomeId)
    .eq("school_id", schoolId)
    .eq("learner_id", learnerId)
    .maybeSingle();

  if (!outcome) {
    return NextResponse.json({ error: "Support case not found." }, { status: 404 });
  }

  const updateRow = {
    school_id: schoolId,
    classroom_id: Number(outcome.classroom_id),
    learner_id: learnerId,
    outcome_id: outcomeId,
    support_status: supportStatus,
    intervention,
    progress_note: progressNote,
    parent_summary: parentSummary,
    next_review_date: nextReviewDate,
    recorded_by: authorization.staff.userId,
    recorded_by_name: authorization.staff.profile.full_name || authorization.staff.profile.email || null,
  };

  const { data: savedUpdate, error: insertError } = await supabaseAdmin
    .from("learner_support_updates")
    .insert(updateRow)
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { error: outcomeError } = await supabaseAdmin
    .from("learner_activity_outcomes")
    .update({ support_status: supportStatus, updated_at: new Date().toISOString() })
    .eq("id", outcomeId)
    .eq("school_id", schoolId);
  if (outcomeError) {
    await supabaseAdmin.from("learner_support_updates").delete().eq("id", savedUpdate.id);
    return NextResponse.json({ error: outcomeError.message }, { status: 400 });
  }

  await writeSecurityAudit(authorization.staff, "classroom_support.updated", {
    learner_id: learnerId,
    outcome_id: outcomeId,
    developmental_area: outcome.developmental_area,
    support_status: supportStatus,
    next_review_date: nextReviewDate,
  });

  return NextResponse.json({ success: true, update: savedUpdate });
}

import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  authenticatedRoleCanAccessLearner,
  requireStaffPermission,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

async function authoriseReviewAccess(request: Request, schoolId: number, learnerId: string) {
  let authorization = await requireStaffPermission(
    request,
    PERMISSIONS.PROGRESS_REPORTS_MANAGE,
    schoolId
  );
  if (!authorization.ok) {
    authorization = await requireStaffPermission(
      request,
      PERMISSIONS.ACTIVITIES_MANAGE,
      schoolId
    );
  }
  if (!authorization.ok) return authorization;

  const { data: learner } = await supabaseAdmin
    .from("learners")
    .select("id, classroom_id")
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!learner) return { ok: false as const, response: NextResponse.json({ error: "Learner not found." }, { status: 404 }) };

  const mayAccessLearner = await authenticatedRoleCanAccessLearner(
    authorization.staff,
    Number(learner.classroom_id || 0)
  );
  if (!mayAccessLearner) {
    return { ok: false as const, response: NextResponse.json({ error: "You may only review learners in your assigned classroom." }, { status: 403 }) };
  }

  return { ok: true as const, authorization, learner };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id"));
  const learnerId = String(url.searchParams.get("learner_id") || "");
  const reportPeriodId = Number(url.searchParams.get("report_period_id"));
  if (!schoolId || !learnerId) {
    return NextResponse.json({ error: "School and learner are required." }, { status: 400 });
  }

  const access = await authoriseReviewAccess(request, schoolId, learnerId);
  if (!access.ok) return access.response;

  let query = supabaseAdmin
    .from("learner_progress_reviews")
    .select("*")
    .eq("school_id", schoolId)
    .eq("learner_id", learnerId)
    .order("review_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (reportPeriodId) query = query.eq("report_period_id", reportPeriodId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Progress reviews could not be loaded." }, { status: 500 });

  return NextResponse.json({ reviews: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const schoolId = Number(body?.school_id);
  const learnerId = String(body?.learner_id || "");
  const classroomId = Number(body?.classroom_id);
  const reportPeriodId = Number(body?.report_period_id) || null;
  const discussionSummary = String(body?.discussion_summary || "").trim();
  if (!schoolId || !learnerId || !classroomId || !discussionSummary) {
    return NextResponse.json({ error: "Learner, class and discussion summary are required." }, { status: 400 });
  }

  const access = await authoriseReviewAccess(request, schoolId, learnerId);
  if (!access.ok) return access.response;
  if (Number(access.learner.classroom_id) !== classroomId) {
    return NextResponse.json({ error: "The learner is not in the selected class." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("learner_progress_reviews")
    .insert({
      school_id: schoolId,
      classroom_id: classroomId,
      learner_id: learnerId,
      report_period_id: reportPeriodId,
      review_date: body?.review_date || new Date().toISOString().slice(0, 10),
      discussion_summary: discussionSummary,
      agreed_actions: String(body?.agreed_actions || "").trim() || null,
      home_support: String(body?.home_support || "").trim() || null,
      next_review_date: body?.next_review_date || null,
      recorded_by: access.authorization.staff.userId,
      recorded_by_name:
        access.authorization.staff.profile.full_name ||
        access.authorization.staff.profile.email ||
        null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Progress review could not be saved." }, { status: 500 });

  return NextResponse.json({ review: data }, { status: 201 });
}

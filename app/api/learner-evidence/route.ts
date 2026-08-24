import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { authenticatedRoleCanAccessLearner, requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = Number(url.searchParams.get("school_id"));
  const learnerId = String(url.searchParams.get("learner_id") || "");
  const periodId = Number(url.searchParams.get("report_period_id"));
  if (!schoolId || !learnerId || !periodId) return NextResponse.json({ error: "School, learner and report period are required." }, { status: 400 });

  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  const [{ data: learner }, { data: period }] = await Promise.all([
    supabaseAdmin.from("learners").select("id, name, classroom_id").eq("id", learnerId).eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("report_periods").select("opening_date, closing_date").eq("id", periodId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (!learner || !period) return NextResponse.json({ error: "Learner or report period was not found." }, { status: 404 });
  if (!(await authenticatedRoleCanAccessLearner(authorization.staff, Number(learner.classroom_id || 0)))) return NextResponse.json({ error: "You may only view evidence for your assigned classroom." }, { status: 403 });

  const from = period.opening_date || `${new Date().getFullYear()}-01-01`;
  const to = period.closing_date || new Date().toISOString().slice(0, 10);
  const [{ data: attendance }, { data: activities }, { data: outcomes }, { data: updates }, { data: summaries }, { data: awards }] = await Promise.all([
    supabaseAdmin.from("attendance").select("status").eq("school_id", schoolId).eq("learner_name", learner.name).gte("attendance_date", from).lte("attendance_date", to),
    supabaseAdmin.from("weekly_activity_plans").select("developmental_area, activity_name, activity_date").eq("school_id", schoolId).eq("classroom_id", learner.classroom_id).eq("completed", true).gte("activity_date", from).lte("activity_date", to),
    supabaseAdmin.from("learner_activity_outcomes").select("developmental_area, support_status, observation, activity_date").eq("school_id", schoolId).eq("learner_id", learnerId).eq("outcome_status", "needs_support").gte("activity_date", from).lte("activity_date", to).order("activity_date", { ascending: false }),
    supabaseAdmin.from("learner_support_updates").select("support_status, intervention, progress_note, next_review_date, recorded_at").eq("school_id", schoolId).eq("learner_id", learnerId).gte("recorded_at", `${from}T00:00:00`).lte("recorded_at", `${to}T23:59:59`).order("recorded_at", { ascending: false }),
    supabaseAdmin.from("summaries").select("notes, teacher_notes, created_at").eq("school_id", schoolId).eq("learner_name", learner.name).gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`).order("created_at", { ascending: false }).limit(5),
    supabaseAdmin.from("achievement_awards").select("award_name, award_reason, issued_at, created_at").eq("school_id", schoolId).eq("learner_id", learnerId).gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`).order("created_at", { ascending: false }),
  ]);
  const present = (attendance || []).filter((item) => String(item.status).toLowerCase() === "present").length;
  const absent = (attendance || []).filter((item) => String(item.status).toLowerCase() === "absent").length;
  return NextResponse.json({ period: { from, to }, attendance: { present, absent, rate: present + absent ? Math.round((present / (present + absent)) * 100) : null }, activities: activities || [], support_cases: outcomes || [], support_updates: updates || [], summaries: summaries || [], awards: awards || [] });
}

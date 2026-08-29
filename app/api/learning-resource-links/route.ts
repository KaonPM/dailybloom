import { NextResponse } from "next/server";
import { authenticatedRoleCanAccessLearner, requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  const [{ data: plans, error: plansError }, { data: homework, error: homeworkError }] = await Promise.all([
    supabaseAdmin.from("weekly_activity_plans").select("id, classroom_id, activity_date, activity_name").eq("school_id", schoolId).order("activity_date", { ascending: false }).limit(100),
    supabaseAdmin.from("homework_assignments").select("id, classroom_id, activity_date, due_date, instruction_note").eq("school_id", schoolId).order("activity_date", { ascending: false }).limit(100),
  ]);
  if (plansError || homeworkError) return NextResponse.json({ error: plansError?.message || homeworkError?.message }, { status: 400 });
  const allowedPlans = [];
  for (const plan of plans || []) if (await authenticatedRoleCanAccessLearner(authorization.staff, Number(plan.classroom_id))) allowedPlans.push(plan);
  const allowedHomework = [];
  for (const assignment of homework || []) if (await authenticatedRoleCanAccessLearner(authorization.staff, Number(assignment.classroom_id))) allowedHomework.push(assignment);
  return NextResponse.json({ plans: allowedPlans, homework: allowedHomework });
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const resourceId = Number(body.resource_id);
  const weeklyPlanId = Number(body.weekly_plan_id);
  const homeworkAssignmentId = Number(body.homework_assignment_id);
  const pageFrom = body.page_from ? Number(body.page_from) : null;
  const pageTo = body.page_to ? Number(body.page_to) : null;
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (!resourceId || Boolean(weeklyPlanId) === Boolean(homeworkAssignmentId)) {
    return NextResponse.json({ error: "Choose one saved activity or homework assignment." }, { status: 400 });
  }
  if ((pageFrom && (!Number.isInteger(pageFrom) || pageFrom < 1)) || (pageTo && (!Number.isInteger(pageTo) || pageTo < (pageFrom || 1)))) {
    return NextResponse.json({ error: "Enter a valid workbook page range." }, { status: 400 });
  }

  const { data: resource } = await supabaseAdmin.from("learning_resources").select("id").eq("id", resourceId).eq("grade", "Grade R").eq("status", "published").or(`school_id.is.null,school_id.eq.${schoolId}`).maybeSingle();
  if (!resource) return NextResponse.json({ error: "The selected learning resource is unavailable." }, { status: 404 });

  if (weeklyPlanId) {
    const { data: plan } = await supabaseAdmin.from("weekly_activity_plans").select("id, classroom_id").eq("id", weeklyPlanId).eq("school_id", schoolId).maybeSingle();
    if (!plan || !(await authenticatedRoleCanAccessLearner(authorization.staff, Number(plan.classroom_id)))) return NextResponse.json({ error: "That activity is unavailable for this practitioner." }, { status: 403 });
    const { error } = await supabaseAdmin.from("activity_learning_resources").upsert({ weekly_plan_id: weeklyPlanId, resource_id: resourceId, page_from: pageFrom, page_to: pageTo }, { onConflict: "weekly_plan_id,resource_id,page_from,page_to" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.activity_linked", { resource_id: resourceId, weekly_plan_id: weeklyPlanId, page_from: pageFrom, page_to: pageTo });
  } else {
    const { data: assignment } = await supabaseAdmin.from("homework_assignments").select("id, classroom_id").eq("id", homeworkAssignmentId).eq("school_id", schoolId).maybeSingle();
    if (!assignment || !(await authenticatedRoleCanAccessLearner(authorization.staff, Number(assignment.classroom_id)))) return NextResponse.json({ error: "That homework assignment is unavailable for this practitioner." }, { status: 403 });
    const { error } = await supabaseAdmin.from("homework_learning_resources").upsert({ homework_assignment_id: homeworkAssignmentId, resource_id: resourceId, page_from: pageFrom, page_to: pageTo }, { onConflict: "homework_assignment_id,resource_id,page_from,page_to" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.homework_linked", { resource_id: resourceId, homework_assignment_id: homeworkAssignmentId, page_from: pageFrom, page_to: pageTo });
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { authenticatedRoleCanAccessLearner, requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { normalizeSelectedPages } from "@/app/lib/grade-r-workbooks";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  const [{ data: plans, error: plansError }, { data: homework, error: homeworkError }] = await Promise.all([
    supabaseAdmin.from("weekly_activity_plans").select("id, classroom_id, activity_date, activity_name, activity_learning_resources(id, resource_id, page_from, page_to, selected_pages, learning_resources(title, academic_year, language, book_number))").eq("school_id", schoolId).order("activity_date", { ascending: false }).limit(100),
    supabaseAdmin.from("homework_assignments").select("id, classroom_id, activity_date, due_date, instruction_note, homework_learning_resources(id, resource_id, page_from, page_to, selected_pages, learning_resources(title, academic_year, language, book_number))").eq("school_id", schoolId).order("activity_date", { ascending: false }).limit(100),
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
  if (!resourceId || (body.action !== "create" && Boolean(weeklyPlanId) === Boolean(homeworkAssignmentId))) {
    return NextResponse.json({ error: "Choose one saved activity or homework assignment." }, { status: 400 });
  }
  if ((pageFrom && (!Number.isInteger(pageFrom) || pageFrom < 1 || pageFrom > 2000)) || (pageTo && (!Number.isInteger(pageTo) || pageTo > 2000 || pageTo < (pageFrom || 1)))) {
    return NextResponse.json({ error: "Enter a valid workbook page range." }, { status: 400 });
  }
  const requestedPages = Array.isArray(body.selected_pages) ? body.selected_pages.slice(0, 2001).map(Number) : pageFrom ? Array.from({ length: (pageTo || pageFrom) - pageFrom + 1 }, (_, index) => pageFrom + index) : [];

  const { data: resource } = await supabaseAdmin.from("learning_resources").select("id, page_count, catalogue_status").eq("id", resourceId).eq("grade", "Grade R").eq("status", "published").or(`school_id.is.null,school_id.eq.${schoolId}`).maybeSingle();
  if (!resource) return NextResponse.json({ error: "The selected learning resource is unavailable." }, { status: 404 });
  if (resource.catalogue_status !== "current") return NextResponse.json({ error: "The selected learning resource is unavailable." }, { status: 404 });
  const selectedPages = normalizeSelectedPages(requestedPages, resource.page_count);
  if (requestedPages.length && selectedPages.length !== new Set(requestedPages).size) return NextResponse.json({ error: "One or more selected workbook pages are invalid." }, { status: 400 });
  if (!selectedPages.length || selectedPages.length > 2000) return NextResponse.json({ error: "Select valid workbook pages." }, { status: 400 });
  if (body.action === "create") {
    const classroomId = Number(body.classroom_id);
    const { data: classroom } = await supabaseAdmin.from("classrooms").select("id").eq("id", classroomId).eq("school_id", schoolId).maybeSingle();
    if (!classroom || !(await authenticatedRoleCanAccessLearner(authorization.staff, classroomId))) return NextResponse.json({ error: "Classroom access is not allowed." }, { status: 403 });
    const title = String(body.title || "").trim().slice(0, 160);
    const instructions = String(body.instructions || "").trim().slice(0, 330);
    if (!title || !instructions || !["activity", "homework"].includes(body.entity_type) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.activity_date))) return NextResponse.json({ error: "Enter a title, instructions and activity date." }, { status: 400 });
    const { data, error } = await supabaseAdmin.rpc("create_workbook_assignment", {
      target_school: schoolId, target_classroom: classroomId, target_resource: resourceId,
      pages: selectedPages, entity_type: body.entity_type, title, instructions,
      learning_focus: String(body.learning_focus || "Life Skills").slice(0, 80),
      activity_day: body.activity_date, due_day: body.due_date || body.activity_date, actor: authorization.staff.userId,
    });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Homework already exists for this date. Link these pages to the existing assignment below." : "The workbook assignment could not be saved. Check the date and selected workbook." }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.assignment_created", { entity_type: body.entity_type, entity_id: data, resource_id: resourceId, selected_pages: selectedPages });
    return NextResponse.json({ success: true, id: data });
  }

  if (weeklyPlanId) {
    const { data: plan } = await supabaseAdmin.from("weekly_activity_plans").select("id, classroom_id").eq("id", weeklyPlanId).eq("school_id", schoolId).maybeSingle();
    if (!plan || !(await authenticatedRoleCanAccessLearner(authorization.staff, Number(plan.classroom_id)))) return NextResponse.json({ error: "That activity is unavailable for this practitioner." }, { status: 403 });
    const { error } = await supabaseAdmin.from("activity_learning_resources").upsert({ weekly_plan_id: weeklyPlanId, resource_id: resourceId, school_id: schoolId, classroom_id: plan.classroom_id, selected_pages: selectedPages, page_from: selectedPages[0] || pageFrom, page_to: selectedPages.at(-1) || pageTo, created_by: authorization.staff.userId }, { onConflict: "weekly_plan_id,resource_id,page_from,page_to" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.activity_linked", { resource_id: resourceId, weekly_plan_id: weeklyPlanId, page_from: pageFrom, page_to: pageTo });
  } else {
    const { data: assignment } = await supabaseAdmin.from("homework_assignments").select("id, classroom_id").eq("id", homeworkAssignmentId).eq("school_id", schoolId).maybeSingle();
    if (!assignment || !(await authenticatedRoleCanAccessLearner(authorization.staff, Number(assignment.classroom_id)))) return NextResponse.json({ error: "That homework assignment is unavailable for this practitioner." }, { status: 403 });
    const { error } = await supabaseAdmin.from("homework_learning_resources").upsert({ homework_assignment_id: homeworkAssignmentId, resource_id: resourceId, school_id: schoolId, classroom_id: assignment.classroom_id, selected_pages: selectedPages, page_from: selectedPages[0] || pageFrom, page_to: selectedPages.at(-1) || pageTo, created_by: authorization.staff.userId }, { onConflict: "homework_assignment_id,resource_id,page_from,page_to" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.homework_linked", { resource_id: resourceId, homework_assignment_id: homeworkAssignmentId, page_from: pageFrom, page_to: pageTo });
  }
  return NextResponse.json({ success: true });
}

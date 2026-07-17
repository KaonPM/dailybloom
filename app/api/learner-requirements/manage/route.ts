import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

async function classroomBelongsToSchool(classroomId: number, schoolId: number) {
  const { data } = await supabaseAdmin.from("classrooms").select("id").eq("id", classroomId).eq("school_id", schoolId).maybeSingle();
  return Boolean(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const action = String(body.action || "");
  const permission = action === "bulk_receive" ? PERMISSIONS.REQUIREMENTS_TRACK : PERMISSIONS.REQUIREMENTS_MANAGE;
  const authorization = await requireStaffPermission(request, permission, schoolId);
  if (!authorization.ok) return authorization.response;

  if (action === "add_item") {
    const classroomId = Number(body.classroom_id);
    const itemName = String(body.item_name || "").trim().slice(0, 160);
    if (!classroomId || !itemName || !(await classroomBelongsToSchool(classroomId, schoolId))) {
      return NextResponse.json({ error: "Valid classroom and requirement name are required." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("classroom_requirement_items").upsert({
      school_id: schoolId, classroom_id: classroomId, item_name: itemName,
      quantity: String(body.quantity || "").trim().slice(0, 80) || null,
      category: String(body.category || "Other").trim().slice(0, 60), is_active: true,
    }, { onConflict: "school_id,classroom_id,item_name" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "requirements.item_saved", { classroom_id: classroomId, item_name: itemName });
    return NextResponse.json({ success: true });
  }

  if (action === "archive_item") {
    const itemId = Number(body.item_id);
    const { data, error } = await supabaseAdmin.from("classroom_requirement_items").update({ is_active: false })
      .eq("id", itemId).eq("school_id", schoolId).select("id, classroom_id, item_name").maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.message || "Requirement not found." }, { status: 404 });
    await writeSecurityAudit(authorization.staff, "requirements.item_archived", { item_id: itemId, classroom_id: data.classroom_id, item_name: data.item_name });
    return NextResponse.json({ success: true });
  }

  if (action === "bulk_receive") {
    const classroomId = Number(body.classroom_id);
    if (authorization.staff.role === "teacher" && Number(authorization.staff.profile.classroom_id || 0) !== classroomId) {
      return NextResponse.json({ error: "Teachers may only update requirements for their assigned classroom." }, { status: 403 });
    }
    const learnerIds = [...new Set((body.learner_ids || []).map(String).filter(Boolean))] as string[];
    const itemName = String(body.item_name || "").trim().slice(0, 160);
    const requiredQuantity = Math.max(1, Number(body.required_quantity) || 1);
    if (!classroomId || !learnerIds.length || !itemName || !(await classroomBelongsToSchool(classroomId, schoolId))) {
      return NextResponse.json({ error: "Select a valid item and at least one learner." }, { status: 400 });
    }
    const { data: validLearners } = await supabaseAdmin.from("learners").select("id").eq("school_id", schoolId).eq("classroom_id", classroomId).in("id", learnerIds);
    const validIds = (validLearners || []).map((row) => String(row.id));
    if (!validIds.length) return NextResponse.json({ error: "No valid learners were selected." }, { status: 400 });
    const { data: existing } = await supabaseAdmin.from("learner_stationery_checklist").select("id, learner_id")
      .eq("school_id", schoolId).eq("classroom_id", classroomId).eq("item_name", itemName).in("learner_id", validIds);
    const now = new Date().toISOString();
    const auditValues = { required_quantity: requiredQuantity, received_quantity: requiredQuantity, received: true, received_at: now, received_by: authorization.staff.userId, received_by_name: authorization.staff.profile.full_name || authorization.staff.profile.email, updated_at: now };
    const existingIds = (existing || []).map((row) => row.id);
    if (existingIds.length) await supabaseAdmin.from("learner_stationery_checklist").update(auditValues).in("id", existingIds);
    const existingLearners = new Set((existing || []).map((row) => String(row.learner_id)));
    const missing = validIds.filter((id) => !existingLearners.has(id)).map((learnerId) => ({ school_id: schoolId, classroom_id: classroomId, learner_id: learnerId, stationery_item_id: Number(body.item_id) > 0 ? Number(body.item_id) : null, item_name: itemName, quantity: String(body.quantity || requiredQuantity), ...auditValues }));
    if (missing.length) {
      const { error } = await supabaseAdmin.from("learner_stationery_checklist").insert(missing);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await writeSecurityAudit(authorization.staff, "requirements.bulk_received", { classroom_id: classroomId, item_name: itemName, learner_count: validIds.length });
    return NextResponse.json({ success: true, updated: validIds.length });
  }

  return NextResponse.json({ error: "Unsupported requirement action." }, { status: 400 });
}

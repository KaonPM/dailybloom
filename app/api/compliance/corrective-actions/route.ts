import { NextResponse } from "next/server";
import { ACTION_PRIORITIES, isCorrectiveActionTransition, isCorrectiveActionStatus, normalizeCorrectiveActionPriority } from "@/app/lib/corrective-actions";
import { PERMISSIONS } from "@/app/lib/permissions";
import { correctiveActionDirectory, getSchoolCorrectiveActions } from "@/app/lib/server-corrective-actions";
import { requireStaffPermission, writeRequiredSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";
const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);
const schoolId = (value: unknown) => { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; };

async function access(request: Request, requestedSchoolId: number | null) {
  if (!requestedSchoolId) return { response: NextResponse.json({ error: "A valid school is required." }, { status: 400 }) };
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, requestedSchoolId);
  return authorization.ok ? { authorization, id: requestedSchoolId } : { response: authorization.response };
}

async function validateAssignee(id: number, userId: string) {
  const directory = await correctiveActionDirectory(id);
  return directory.find((member) => member.id === userId && member.active) || null;
}

async function validateSource(id: number, type: string, sourceId: string) {
  if (type === "manual") return { label: "Manual", description: null, priority: "Medium" };
  if (type === "inspection_finding") {
    const { data } = await supabaseAdmin.from("compliance_inspection_findings").select("id, description, priority").eq("id", sourceId).eq("school_id", id).maybeSingle();
    return data ? { label: "Inspection Finding", description: data.description, priority: data.priority } : null;
  }
  if (type === "requirement") {
    const { data } = await supabaseAdmin.from("school_compliance_requirements").select("id, status, compliance_requirements(title)").eq("id", sourceId).eq("school_id", id).maybeSingle();
    const status = String(data?.status || "");
    if (!data || !["Missing", "Needs Review", "Expired"].includes(status)) return null;
    return { label: "Requirement", description: `Review requirement: ${String((data.compliance_requirements as { title?: string } | null)?.title || "Compliance requirement")}`, priority: "Medium" };
  }
  return null;
}

export async function GET(request: Request) {
  const result = await access(request, schoolId(new URL(request.url).searchParams.get("school_id")));
  if ("response" in result) return result.response;
  try { return NextResponse.json(await getSchoolCorrectiveActions(result.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Corrective actions could not be loaded." }, { status: 400 }); }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const result = await access(request, schoolId(body.school_id));
  if ("response" in result) return result.response;
  const { id, authorization } = result; const operation = clean(body.action, 40);

  if (operation === "link_evidence" || operation === "unlink_evidence") {
    const actionId = clean(body.id, 64); const documentId = clean(body.document_id, 64);
    if (!actionId || !documentId) return NextResponse.json({ error: "An action and document are required." }, { status: 400 });
    const [{ data: action }, { data: document }] = await Promise.all([
      supabaseAdmin.from("compliance_corrective_actions").select("id").eq("id", actionId).eq("school_id", id).maybeSingle(),
      supabaseAdmin.from("dbe_compliance_documents").select("id").eq("id", documentId).eq("school_id", id).maybeSingle(),
    ]);
    if (!action || !document) return NextResponse.json({ error: "Action or document was not found for this school." }, { status: 404 });
    const query = operation === "link_evidence"
      ? supabaseAdmin.from("compliance_corrective_action_evidence").insert({ school_id: id, corrective_action_id: actionId, document_id: documentId, linked_by: authorization.staff.userId })
      : supabaseAdmin.from("compliance_corrective_action_evidence").delete().eq("school_id", id).eq("corrective_action_id", actionId).eq("document_id", documentId);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.code === "23505" ? "This evidence is already linked." : error.message }, { status: 400 });
    await writeRequiredSecurityAudit(authorization.staff, operation === "link_evidence" ? "compliance.corrective_action_evidence_linked" : "compliance.corrective_action_evidence_unlinked", { document_id: documentId }, { type: "compliance_corrective_actions", id: actionId });
    return NextResponse.json({ success: true });
  }

  if (operation === "transition") {
    const actionId = clean(body.id, 64); const nextStatus = clean(body.status, 40); const note = clean(body.note, 2000);
    const { data: existing, error } = await supabaseAdmin.from("compliance_corrective_actions").select("id, status").eq("id", actionId).eq("school_id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!existing) return NextResponse.json({ error: "Corrective action not found." }, { status: 404 });
    if (!isCorrectiveActionStatus(nextStatus) || !isCorrectiveActionTransition(existing.status, nextStatus)) return NextResponse.json({ error: "That status change is not allowed." }, { status: 409 });
    if ((nextStatus === "Ready for Verification" || nextStatus === "Closed" || nextStatus === "Reopened" || (existing.status === "Ready for Verification" && nextStatus === "In Progress")) && !note) return NextResponse.json({ error: "A note is required for this workflow step." }, { status: 400 });
    const now = new Date().toISOString(); const updates: Record<string, unknown> = { status: nextStatus, updated_at: now, updated_by: authorization.staff.userId };
    let audit = "compliance.corrective_action_updated";
    if (nextStatus === "In Progress" && existing.status === "Open") { updates.started_at = now; audit = "compliance.corrective_action_started"; }
    if (nextStatus === "Ready for Verification") { updates.submitted_for_verification_at = now; updates.resolution_notes = note; audit = "compliance.corrective_action_submitted"; }
    if (nextStatus === "Closed") { updates.verified_at = now; updates.verified_by = authorization.staff.userId; updates.closed_at = now; updates.completed_at = now; updates.verification_notes = note; audit = "compliance.corrective_action_closed"; }
    if (existing.status === "Ready for Verification" && nextStatus === "In Progress") { updates.verification_notes = note; audit = "compliance.corrective_action_verification_failed"; }
    if (nextStatus === "Reopened") { updates.reopened_at = now; updates.reopened_by = authorization.staff.userId; updates.reopening_reason = note; audit = "compliance.corrective_action_reopened"; }
    const { error: updateError } = await supabaseAdmin.from("compliance_corrective_actions").update(updates).eq("id", actionId).eq("school_id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    await writeRequiredSecurityAudit(authorization.staff, audit, { previous_status: existing.status, status: nextStatus }, { type: "compliance_corrective_actions", id: actionId });
    return NextResponse.json({ success: true });
  }

  if (operation !== "create") return NextResponse.json({ error: "Unsupported corrective action operation." }, { status: 400 });
  const title = clean(body.title, 180); const description = clean(body.description, 2000); const dueDate = clean(body.due_date, 10); const responsibleUserId = clean(body.responsible_user_id, 64); const sourceType = clean(body.source_type, 40) || "manual"; const sourceId = clean(body.source_id, 64);
  if (!title || !description || !dueDate || !responsibleUserId) return NextResponse.json({ error: "Title, description, responsible person and due date are required." }, { status: 400 });
  const [assignee, source] = await Promise.all([validateAssignee(id, responsibleUserId), validateSource(id, sourceType, sourceId)]);
  if (!assignee) return NextResponse.json({ error: "Choose an active staff member from this school." }, { status: 403 });
  if (!source) return NextResponse.json({ error: "The selected source is not available for this school." }, { status: 400 });
  if (sourceType !== "manual") {
    const { data: duplicate } = await supabaseAdmin.from("compliance_corrective_actions").select("id").eq("school_id", id).eq("source_type", sourceType).eq("source_id", sourceId).neq("status", "Closed").maybeSingle();
    if (duplicate) return NextResponse.json({ error: "An active corrective action already exists for this source.", action_id: duplicate.id }, { status: 409 });
  }
  const priority = normalizeCorrectiveActionPriority(body.priority || source.priority);
  if (!ACTION_PRIORITIES.includes(priority)) return NextResponse.json({ error: "Choose a valid priority." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("compliance_corrective_actions").insert({ school_id: id, title, description, source_type: sourceType, source_id: sourceType === "manual" ? null : sourceId, responsible_user_id: responsibleUserId, due_date: dueDate, priority, status: "Open", created_by: authorization.staff.userId, updated_by: authorization.staff.userId }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeRequiredSecurityAudit(authorization.staff, "compliance.corrective_action_created", { source_type: sourceType, priority, responsible_assigned: true }, { type: "compliance_corrective_actions", id: data.id });
  await writeRequiredSecurityAudit(authorization.staff, "compliance.corrective_action_assigned", { source_type: sourceType }, { type: "compliance_corrective_actions", id: data.id });
  return NextResponse.json({ item: data }, { status: 201 });
}

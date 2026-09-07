import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeRequiredSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

const tables = {
  requirements: "school_compliance_requirements",
  staff: "staff_compliance_items",
  inspections: "compliance_inspections",
  findings: "compliance_inspection_findings",
  actions: "compliance_corrective_actions",
  certificates: "compliance_certificates",
} as const;
type Resource = keyof typeof tables;
const resources = new Set< string >(Object.keys(tables));

function schoolId(value: string | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
function clean(value: unknown, limit = 1000) { return String(value ?? "").trim().slice(0, limit); }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = schoolId(params.get("school_id"));
  if (!id) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, id);
  if (!authorization.ok) return authorization.response;
  const resource = params.get("resource") || "overview";

  if (resource === "overview") {
    const [registration, requirements, documents, staff, inspections, actions, certificates] = await Promise.all([
      supabaseAdmin.from("dbe_registration").select("*").eq("school_id", id).maybeSingle(),
      supabaseAdmin.from("school_compliance_requirements").select("status, expires_at, compliance_requirements(registration_stage, required, active, effective_from, effective_to)").eq("school_id", id),
      supabaseAdmin.from("dbe_compliance_documents").select("id, expiry_date, verification_status").eq("school_id", id),
      supabaseAdmin.from("staff_compliance_items").select("status, expiry_date").eq("school_id", id),
      supabaseAdmin.from("compliance_inspections").select("id, status, scheduled_date").eq("school_id", id),
      supabaseAdmin.from("compliance_corrective_actions").select("id, status, due_date").eq("school_id", id),
      supabaseAdmin.from("compliance_certificates").select("id, expiry_date, renewal_status").eq("school_id", id),
    ]);
    const errors = [registration, requirements, documents, staff, inspections, actions, certificates].find((result) => result.error)?.error;
    if (errors) return NextResponse.json({ error: errors.message }, { status: 400 });
    return NextResponse.json({ registration: registration.data, requirements: requirements.data || [], documents: documents.data || [], staff: staff.data || [], inspections: inspections.data || [], actions: actions.data || [], certificates: certificates.data || [] });
  }

  if (resource === "catalogue") {
    const { data, error } = await supabaseAdmin.from("compliance_requirements").select("*").eq("active", true).order("display_order");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data || [] });
  }
  if (!resources.has(resource)) return NextResponse.json({ error: "Unsupported compliance resource." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from(tables[resource as Resource]).select("*").eq("school_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = schoolId(String(body.school_id || ""));
  if (!id) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, id);
  if (!authorization.ok) return authorization.response;
  const evidenceAction = clean(body.action, 40);
  if (evidenceAction === "link_evidence" || evidenceAction === "unlink_evidence") {
    const schoolRequirementId = clean(body.school_requirement_id, 64);
    const documentId = clean(body.document_id, 64);
    if (!schoolRequirementId || !documentId) return NextResponse.json({ error: "A requirement and document are required." }, { status: 400 });
    const [{ data: requirement }, { data: document }] = await Promise.all([
      supabaseAdmin.from("school_compliance_requirements").select("id").eq("id", schoolRequirementId).eq("school_id", id).maybeSingle(),
      supabaseAdmin.from("dbe_compliance_documents").select("id").eq("id", documentId).eq("school_id", id).maybeSingle(),
    ]);
    if (!requirement || !document) return NextResponse.json({ error: "Requirement or evidence document not found for this school." }, { status: 404 });
    if (evidenceAction === "unlink_evidence") {
      const { error } = await supabaseAdmin.from("compliance_requirement_evidence").delete().eq("school_id", id).eq("school_requirement_id", schoolRequirementId).eq("document_id", documentId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await writeRequiredSecurityAudit(authorization.staff, "compliance.evidence_unlinked", { requirement_id: schoolRequirementId, document_id: documentId }, { type: "compliance_requirement_evidence", id: documentId });
    } else {
      const { error } = await supabaseAdmin.from("compliance_requirement_evidence").insert({ school_id: id, school_requirement_id: schoolRequirementId, document_id: documentId, linked_by: authorization.staff.userId });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await writeRequiredSecurityAudit(authorization.staff, "compliance.evidence_linked", { requirement_id: schoolRequirementId, document_id: documentId }, { type: "compliance_requirement_evidence", id: documentId });
    }
    return NextResponse.json({ success: true });
  }
  const resource = clean(body.resource, 40) as Resource;
  if (!resources.has(resource)) return NextResponse.json({ error: "Unsupported compliance resource." }, { status: 400 });

  const payloads: Record<Resource, Record<string, unknown>> = {
    requirements: { school_id: id, requirement_id: clean(body.requirement_id, 64), status: clean(body.status, 40) || "Not Started", notes: clean(body.notes), due_date: clean(body.due_date, 10) || null, expires_at: clean(body.expires_at, 10) || null },
    staff: { school_id: id, staff_user_id: clean(body.staff_user_id, 64), requirement_id: clean(body.requirement_id, 64) || null, title: clean(body.title, 180), status: clean(body.status, 40) || "Not Started", issue_date: clean(body.issue_date, 10) || null, expiry_date: clean(body.expiry_date, 10) || null, notes: clean(body.notes) },
    inspections: { school_id: id, inspection_type: clean(body.inspection_type, 160), inspection_scope: clean(body.inspection_scope, 40) || "Internal", inspecting_authority: clean(body.inspecting_authority, 160) || null, scheduled_date: clean(body.scheduled_date, 10) || null, inspection_date: clean(body.inspection_date, 10) || null, status: clean(body.status, 40) || "Scheduled", outcome: clean(body.outcome, 120) || null, inspector_reference: clean(body.inspector_reference, 160) || null, notes: clean(body.notes), follow_up_date: clean(body.follow_up_date, 10) || null, created_by: authorization.staff.userId },
    findings: { school_id: id, inspection_id: clean(body.inspection_id, 64), requirement_id: clean(body.requirement_id, 64) || null, category: clean(body.category, 100) || null, description: clean(body.description), priority: clean(body.priority, 40) || "Normal", status: clean(body.status, 40) || "Open", corrective_action_required: Boolean(body.corrective_action_required) },
    actions: { school_id: id, title: clean(body.title, 180), description: clean(body.description), source_type: clean(body.source_type, 80) || null, source_id: clean(body.source_id, 64) || null, responsible_user_id: clean(body.responsible_user_id, 64) || null, due_date: clean(body.due_date, 10) || null, priority: clean(body.priority, 40) || "Normal", status: clean(body.status, 40) || "Open", notes: clean(body.notes), created_by: authorization.staff.userId },
    certificates: { school_id: id, certificate_type: clean(body.certificate_type, 160), holder_name: clean(body.holder_name, 160) || null, issue_date: clean(body.issue_date, 10) || null, expiry_date: clean(body.expiry_date, 10) || null, issuing_authority: clean(body.issuing_authority, 160) || null, certificate_reference: clean(body.certificate_reference, 160) || null, renewal_status: clean(body.renewal_status, 40) || "Current", notes: clean(body.notes) },
  };
  const payload = payloads[resource];
  const required = resource === "requirements" ? payload.requirement_id : resource === "staff" || resource === "actions" ? payload.title : resource === "inspections" ? payload.inspection_type : resource === "findings" ? payload.description : payload.certificate_type;
  if (!required) return NextResponse.json({ error: "Complete the required fields." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from(tables[resource]).insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const action = resource === "actions" ? "compliance.corrective_action_created" : resource === "inspections" ? "compliance.inspection_created" : resource === "findings" ? "compliance.finding_created" : resource === "staff" ? "compliance.staff_status_changed" : resource === "certificates" ? "compliance.certificate_updated" : "compliance.requirement_status_changed";
  await writeRequiredSecurityAudit(authorization.staff, action, { resource, record_id: data.id }, { type: tables[resource], id: data.id });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = schoolId(String(body.school_id || "")); const recordId = clean(body.id, 64); const resource = clean(body.resource, 40) as Resource;
  if (!id || !recordId || !resources.has(resource)) return NextResponse.json({ error: "Valid school, record and resource are required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, id);
  if (!authorization.ok) return authorization.response;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  ["status", "notes", "due_date", "expiry_date", "expires_at", "renewal_status", "outcome", "follow_up_date", "priority"].forEach((key) => { if (body[key] !== undefined) updates[key] = typeof body[key] === "string" ? clean(body[key], key === "notes" ? 1000 : 160) || null : body[key]; });
  if (body.status === "Closed" && resource === "actions") updates.completed_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from(tables[resource]).update(updates).eq("id", recordId).eq("school_id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Compliance record not found." }, { status: 404 });
  const action = resource === "actions" && body.status === "Closed" ? "compliance.corrective_action_closed" : resource === "actions" ? "compliance.corrective_action_updated" : resource === "inspections" ? "compliance.inspection_updated" : "compliance.requirement_status_changed";
  await writeRequiredSecurityAudit(authorization.staff, action, { resource, record_id: recordId }, { type: tables[resource], id: recordId });
  return NextResponse.json({ success: true });
}

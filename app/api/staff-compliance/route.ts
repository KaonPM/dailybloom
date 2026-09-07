import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeRequiredSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

const STATUSES = new Set(["Not Started", "In Progress", "Ready", "Needs Review", "Missing", "Expired", "Not Applicable"]);
const clean = (value: unknown, maximum = 1000) => String(value ?? "").trim().slice(0, maximum);
const schoolId = (value: unknown) => { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; };

type DirectoryStaff = { id: string; full_name: string | null; role: string; active: boolean };

async function directoryForSchool(id: number): Promise<{ staff: DirectoryStaff[]; error?: string }> {
  const [{ data: memberships, error: membershipError }, { data: legacy, error: legacyError }] = await Promise.all([
    supabaseAdmin.from("school_memberships").select("user_id, role, status").eq("school_id", id),
    supabaseAdmin.from("profiles").select("id, full_name, role, is_active").eq("school_id", id),
  ]);
  if (membershipError || legacyError) return { staff: [], error: membershipError?.message || legacyError?.message };
  const ids = [...new Set((memberships || []).map((membership) => membership.user_id))];
  const { data: profiles, error: profileError } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, is_active").in("id", ids)
    : { data: [], error: null };
  if (profileError) return { staff: [], error: profileError.message };
  const profileById = new Map([...(legacy || []), ...(profiles || [])].map((profile) => [profile.id, profile]));
  const combined = new Map<string, DirectoryStaff>();
  for (const membership of memberships || []) {
    const profile = profileById.get(membership.user_id);
    if (!profile) continue;
    combined.set(membership.user_id, { id: membership.user_id, full_name: profile.full_name || null, role: membership.role || "staff", active: membership.status === "active" && profile.is_active !== false });
  }
  for (const profile of legacy || []) {
    if (!combined.has(profile.id)) combined.set(profile.id, { id: profile.id, full_name: profile.full_name || null, role: profile.role || "staff", active: profile.is_active !== false });
  }
  return { staff: [...combined.values()].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")) };
}

async function staffInSchool(id: number, userId: string) {
  const { staff, error } = await directoryForSchool(id);
  return { staff: staff.find((entry) => entry.id === userId), error };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = schoolId(params.get("school_id"));
  if (!id) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, id);
  if (!authorization.ok) return authorization.response;
  const directory = await directoryForSchool(id);
  if (directory.error) return NextResponse.json({ error: directory.error }, { status: 400 });
  const staffId = clean(params.get("staff_id"), 64);
  const [itemsResult, catalogueResult, documentsResult] = await Promise.all([
    supabaseAdmin.from("staff_compliance_items").select("id, staff_user_id, requirement_id, title, status, issue_date, expiry_date, verification_status, verified_at, document_id, notes, created_at, updated_at").eq("school_id", id).order("updated_at", { ascending: false }),
    supabaseAdmin.from("compliance_requirements").select("id, title, description, required, evidence_required, expiry_tracking_enabled, active, display_order").eq("active", true).eq("applies_to_staff", true).order("display_order"),
    supabaseAdmin.from("dbe_compliance_documents").select("id, document_name, document_type, expiry_date, verification_status").eq("school_id", id).order("uploaded_at", { ascending: false }),
  ]);
  const error = itemsResult.error || catalogueResult.error || documentsResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (staffId && !directory.staff.some((entry) => entry.id === staffId)) return NextResponse.json({ error: "Staff member not found for this school." }, { status: 404 });
  const items = (itemsResult.data || []).filter((item) => !staffId || item.staff_user_id === staffId);
  return NextResponse.json({ staff: directory.staff, items, catalogue: catalogueResult.data || [], documents: documentsResult.data || [] });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = schoolId(body.school_id);
  if (!id) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, id);
  if (!authorization.ok) return authorization.response;
  const action = clean(body.action, 40) || "save";
  const staffUserId = clean(body.staff_user_id, 64);
  const membership = await staffInSchool(id, staffUserId);
  if (membership.error) return NextResponse.json({ error: membership.error }, { status: 400 });
  if (!membership.staff) return NextResponse.json({ error: "Choose a staff member from this school." }, { status: 403 });

  if (action === "link_evidence" || action === "unlink_evidence") {
    const recordId = clean(body.id, 64); const documentId = clean(body.document_id, 64);
    if (!recordId) return NextResponse.json({ error: "A staff compliance record is required." }, { status: 400 });
    if (action === "link_evidence") {
      const { data: document } = await supabaseAdmin.from("dbe_compliance_documents").select("id").eq("id", documentId).eq("school_id", id).maybeSingle();
      if (!document) return NextResponse.json({ error: "Choose a document from this school." }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin.from("staff_compliance_items").update({ document_id: action === "link_evidence" ? documentId : null, updated_at: new Date().toISOString() }).eq("id", recordId).eq("school_id", id).eq("staff_user_id", staffUserId).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Staff compliance record not found." }, { status: 404 });
    await writeRequiredSecurityAudit(authorization.staff, action === "link_evidence" ? "compliance.staff_evidence_linked" : "compliance.staff_evidence_unlinked", { staff_user_id: staffUserId, record_id: recordId }, { type: "staff_compliance_items", id: recordId });
    return NextResponse.json({ success: true });
  }

  const requirementId = clean(body.requirement_id, 64) || null;
  const recordId = clean(body.id, 64);
  let existingDocumentId: string | null = null;
  if (recordId) {
    const { data: existingRecord, error: existingRecordError } = await supabaseAdmin.from("staff_compliance_items").select("document_id").eq("id", recordId).eq("school_id", id).eq("staff_user_id", staffUserId).maybeSingle();
    if (existingRecordError) return NextResponse.json({ error: existingRecordError.message }, { status: 400 });
    if (!existingRecord) return NextResponse.json({ error: "Staff compliance record not found." }, { status: 404 });
    existingDocumentId = existingRecord.document_id;
  }
  let title = clean(body.title, 180);
  if (requirementId) {
    const { data: requirement } = await supabaseAdmin.from("compliance_requirements").select("id, title").eq("id", requirementId).eq("active", true).eq("applies_to_staff", true).maybeSingle();
    if (!requirement) return NextResponse.json({ error: "Choose a configured staff compliance item." }, { status: 400 });
    title = requirement.title;
  }
  if (!title) return NextResponse.json({ error: "Choose a configured item or provide an item name." }, { status: 400 });
  const status = clean(body.status, 40) || "Not Started";
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Choose a valid compliance status." }, { status: 400 });
  const documentId = clean(body.document_id, 64) || null;
  if (documentId) {
    const { data: document } = await supabaseAdmin.from("dbe_compliance_documents").select("id").eq("id", documentId).eq("school_id", id).maybeSingle();
    if (!document) return NextResponse.json({ error: "Choose a document from this school." }, { status: 403 });
  }
  const verified = body.verify === true;
  const payload = { school_id: id, staff_user_id: staffUserId, requirement_id: requirementId, title, status, issue_date: clean(body.issue_date, 10) || null, expiry_date: clean(body.expiry_date, 10) || null, notes: clean(body.notes), document_id: documentId, verification_status: verified ? "Verified" : "Unverified", verified_at: verified ? new Date().toISOString() : null, verified_by: verified ? authorization.staff.userId : null, updated_at: new Date().toISOString() };
  let data: { id: string } | null = null; let error: { message: string } | null = null;
  if (recordId) ({ data, error } = await supabaseAdmin.from("staff_compliance_items").update(payload).eq("id", recordId).eq("school_id", id).eq("staff_user_id", staffUserId).select("id").maybeSingle());
  else if (requirementId) {
    const { data: existing, error: existingError } = await supabaseAdmin.from("staff_compliance_items").select("id").eq("school_id", id).eq("staff_user_id", staffUserId).eq("requirement_id", requirementId).maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
    if (existing) ({ data, error } = await supabaseAdmin.from("staff_compliance_items").update(payload).eq("id", existing.id).eq("school_id", id).select("id").maybeSingle());
    else ({ data, error } = await supabaseAdmin.from("staff_compliance_items").insert(payload).select("id").single());
  }
  else ({ data, error } = await supabaseAdmin.from("staff_compliance_items").insert(payload).select("id").single());
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Staff compliance record not found." }, { status: 404 });
  await writeRequiredSecurityAudit(authorization.staff, "compliance.staff_status_changed", { staff_user_id: staffUserId, record_id: data.id, status }, { type: "staff_compliance_items", id: data.id });
  if (documentId && documentId !== existingDocumentId) await writeRequiredSecurityAudit(authorization.staff, "compliance.staff_evidence_linked", { staff_user_id: staffUserId, record_id: data.id }, { type: "staff_compliance_items", id: data.id });
  if (!documentId && existingDocumentId) await writeRequiredSecurityAudit(authorization.staff, "compliance.staff_evidence_unlinked", { staff_user_id: staffUserId, record_id: data.id }, { type: "staff_compliance_items", id: data.id });
  if (verified) await writeRequiredSecurityAudit(authorization.staff, "compliance.staff_verified", { staff_user_id: staffUserId, record_id: data.id }, { type: "staff_compliance_items", id: data.id });
  return NextResponse.json({ item: data }, recordId ? { status: 200 } : { status: 201 });
}

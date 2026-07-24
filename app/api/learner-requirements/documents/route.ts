import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  canonicalLearnerDocumentName,
  learnerDocumentNamesMatch,
} from "@/app/lib/learner-documents";

export const runtime = "nodejs";

const BUCKET = "learner-documents";
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 10 * 1024 * 1024;

async function validateLearner(schoolId: number, classroomId: number, learnerId: string) {
  const { data } = await supabaseAdmin.from("learners").select("id").eq("id", learnerId).eq("school_id", schoolId).eq("classroom_id", classroomId).maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const documentId = Number(params.get("document_id"));
  const authorization = await requireStaffPermission(request, PERMISSIONS.REQUIREMENTS_VIEW, schoolId);
  if (!authorization.ok) return authorization.response;
  const { data: document } = await supabaseAdmin.from("learner_documents").select("id, school_id, file_path, file_url").eq("id", documentId).eq("school_id", schoolId).maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (document.file_path) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(document.file_path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || "Document could not be opened." }, { status: 400 });
    return NextResponse.json({ url: data.signedUrl });
  }
  if (document.file_url) return NextResponse.json({ url: document.file_url, legacy: true });
  return NextResponse.json({ error: "No file is attached." }, { status: 404 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const schoolId = Number(form.get("school_id"));
  const classroomId = Number(form.get("classroom_id"));
  const learnerId = String(form.get("learner_id") || "");
  const documentType = canonicalLearnerDocumentName(
    String(form.get("document_type") || "")
  ).slice(0, 160);
  const file = form.get("file");
  const authorization = await requireStaffPermission(request, PERMISSIONS.REQUIREMENTS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  if (!(file instanceof File) || !documentType || !await validateLearner(schoolId, classroomId, learnerId)) {
    return NextResponse.json({ error: "Valid learner, document type and file are required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Upload a PDF, JPG or PNG file no larger than 10 MB." }, { status: 400 });
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeType = documentType.replace(/[^a-zA-Z0-9]/g, "-");
  const filePath = `${schoolId}/${learnerId}/${safeType}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const { data: learnerDocuments } = await supabaseAdmin
    .from("learner_documents")
    .select("id, file_path, document_type")
    .eq("school_id", schoolId)
    .eq("learner_id", learnerId)
    .order("id", { ascending: false });
  const existing = learnerDocuments?.find((document) =>
    learnerDocumentNamesMatch(document.document_type, documentType)
  );
  const now = new Date().toISOString();
  const values = { school_id: schoolId, learner_id: learnerId, document_type: documentType, document_name: documentType, file_name: file.name, file_path: filePath, file_url: null, uploaded_at: now, updated_at: now, uploaded_by: authorization.staff.userId, uploaded_by_name: authorization.staff.profile.full_name || authorization.staff.profile.email };
  const result = existing ? await supabaseAdmin.from("learner_documents").update(values).eq("id", existing.id) : await supabaseAdmin.from("learner_documents").insert(values);
  if (result.error) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  if (existing?.file_path && existing.file_path !== filePath) await supabaseAdmin.storage.from(BUCKET).remove([existing.file_path]);
  await writeSecurityAudit(authorization.staff, existing ? "requirements.document_replaced" : "requirements.document_uploaded", { learner_id: learnerId, document_type: documentType });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const documentId = Number(body.document_id);
  const authorization = await requireStaffPermission(request, PERMISSIONS.REQUIREMENTS_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  const { data: document } = await supabaseAdmin.from("learner_documents").select("id, learner_id, document_type, file_path").eq("id", documentId).eq("school_id", schoolId).maybeSingle();
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const { error } = await supabaseAdmin.from("learner_documents").delete().eq("id", documentId).eq("school_id", schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (document.file_path) await supabaseAdmin.storage.from(BUCKET).remove([document.file_path]);
  await writeSecurityAudit(authorization.staff, "requirements.document_deleted", { learner_id: document.learner_id, document_type: document.document_type });
  return NextResponse.json({ success: true });
}

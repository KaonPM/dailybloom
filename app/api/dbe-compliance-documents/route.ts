import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

const BUCKET = "dbe-compliance-documents";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const documentId = params.get("document_id");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  if (documentId) {
    const { data: document, error } = await supabaseAdmin
      .from("dbe_compliance_documents")
      .select("id, school_id, file_path")
      .eq("id", documentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!document?.file_path) {
      return NextResponse.json({ error: "Compliance document not found." }, { status: 404 });
    }
    const { data, error: signedUrlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(document.file_path, 300);
    if (signedUrlError || !data?.signedUrl) {
      return NextResponse.json(
        { error: signedUrlError?.message || "The document could not be opened." },
        { status: 400 }
      );
    }
    return NextResponse.json({ url: data.signedUrl });
  }

  const { data, error } = await supabaseAdmin
    .from("dbe_compliance_documents")
    .select("id, school_id, document_name, file_path, file_name, uploaded_at")
    .eq("school_id", schoolId)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const schoolId = Number(form.get("school_id"));
  const documentName = String(form.get("document_name") || "").trim().slice(0, 160);
  const file = form.get("file");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;
  if (!(file instanceof File) || !documentName) {
    return NextResponse.json({ error: "A document name and file are required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Upload a PDF, Word, JPG or PNG file no larger than 15 MB." },
      { status: 400 }
    );
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = `${schoolId}/${crypto.randomUUID()}-${safeFileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("dbe_compliance_documents")
    .insert({
      school_id: schoolId,
      document_name: documentName,
      file_path: filePath,
      file_name: file.name,
    })
    .select("id, school_id, document_name, file_path, file_name, uploaded_at")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeSecurityAudit(
    authorization.staff,
    "dbe.compliance_document_uploaded",
    { document_id: data.id, document_name: documentName }
  );
  return NextResponse.json({ document: data });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const documentId = String(body.document_id || "");
  const documentName = String(body.document_name || "").trim().slice(0, 160);
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;
  if (!documentId || !documentName) {
    return NextResponse.json({ error: "Document and document name are required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("dbe_compliance_documents")
    .update({ document_name: documentName })
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) {
    return NextResponse.json({ error: "Compliance document not found." }, { status: 404 });
  }

  await writeSecurityAudit(
    authorization.staff,
    "dbe.compliance_document_renamed",
    { document_id: documentId, document_name: documentName }
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const documentId = String(body.document_id || "");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.DBE_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const { data: document, error: findError } = await supabaseAdmin
    .from("dbe_compliance_documents")
    .select("id, file_path, document_name")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 });
  if (!document) {
    return NextResponse.json({ error: "Compliance document not found." }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("dbe_compliance_documents")
    .delete()
    .eq("id", documentId)
    .eq("school_id", schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (document.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([document.file_path]);
  }

  await writeSecurityAudit(
    authorization.staff,
    "dbe.compliance_document_deleted",
    { document_id: documentId, document_name: document.document_name }
  );
  return NextResponse.json({ success: true });
}

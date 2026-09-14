import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const allowedCatalogueStatuses = new Set(["current", "needs_review", "archived", "unavailable"]);
const text = (value: unknown, limit = 500) => String(value || "").trim().slice(0, limit);
async function authorize(request: Request) {
  const access = await requireStaffPermission(request, PERMISSIONS.PLATFORM_DASHBOARD_VIEW);
  if (access.ok && access.staff.role !== "master") return { ok: false as const, response: NextResponse.json({ error: "Master access is required to manage the workbook catalogue." }, { status: 403 }) };
  return access;
}

export async function GET(request: Request) {
  const authorization = await authorize(request); if (!authorization.ok) return authorization.response;
  const [resources, years] = await Promise.all([
    supabaseAdmin.from("learning_resources").select("*").eq("grade", "Grade R").eq("resource_type", "DBE Workbook").order("academic_year", { ascending: false }).order("term").order("language"),
    supabaseAdmin.from("learning_resource_years").select("*").eq("grade", "Grade R").order("academic_year", { ascending: false }),
  ]);
  if (resources.error || years.error) return NextResponse.json({ error: resources.error?.message || years.error?.message }, { status: 400 });
  return NextResponse.json({ resources: resources.data || [], years: years.data || [] });
}

export async function POST(request: Request) {
  const authorization = await authorize(request); if (!authorization.ok) return authorization.response;
  const body = await request.json(); const action = text(body.action, 40);
  if (action === "add_year") {
    const academicYear = Number(body.academic_year);
    if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2200) return NextResponse.json({ error: "Enter a valid academic year." }, { status: 400 });
    const { error } = await supabaseAdmin.from("learning_resource_years").insert({ academic_year: academicYear, grade: "Grade R", status: "needs_review", is_default: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.year_added", { academic_year: academicYear, grade: "Grade R" });
    return NextResponse.json({ success: true });
  }
  if (action === "add_resource") {
    const academicYear = Number(body.academic_year); const term = Number(body.term); const language = text(body.language, 80); const title = text(body.title, 200); const officialSourceUrl = text(body.official_source_url, 1000);
    if (!Number.isInteger(academicYear) || ![1, 2, 3, 4].includes(term) || !language || !title) return NextResponse.json({ error: "Year, term, language and title are required." }, { status: 400 });
    if (officialSourceUrl) { try { new URL(officialSourceUrl); } catch { return NextResponse.json({ error: "Enter a valid official source URL." }, { status: 400 }); } }
    const [{ data: catalogueYear }, { data: existingEdition }] = await Promise.all([
      supabaseAdmin.from("learning_resource_years").select("id").eq("academic_year", academicYear).eq("grade", "Grade R").maybeSingle(),
      supabaseAdmin.from("learning_resources").select("id").eq("academic_year", academicYear).eq("grade", "Grade R").eq("resource_type", "DBE Workbook").eq("term", term).ilike("language", language).is("school_id", null).limit(1).maybeSingle(),
    ]);
    if (!catalogueYear) return NextResponse.json({ error: "Add the academic year to the review list first." }, { status: 400 });
    if (existingEdition) return NextResponse.json({ error: "That year, term and language edition already exists. Review the existing record instead." }, { status: 409 });
    const { data, error } = await supabaseAdmin.from("learning_resources").insert({ title, description: text(body.description, 1000) || null, grade: "Grade R", resource_type: "DBE Workbook", source_name: "Department of Basic Education", source_url: officialSourceUrl || null, official_source_url: officialSourceUrl || null, language, academic_year: academicYear, term, book_number: text(body.book_number, 80) || `Book ${term}`, learning_area: null, learning_areas: ["Home Language", "Mathematics", "Life Skills"], content_rights: "DBE State-Owned", is_downloadable: false, is_printable: false, is_parent_shareable: true, status: "draft", catalogue_status: "needs_review", created_by: authorization.staff.userId }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.catalogue_added", { resource_id: data.id, academic_year: academicYear });
    return NextResponse.json({ resource_id: data.id }, { status: 201 });
  }
  if (action === "create_upload") {
    const resourceId = Number(body.resource_id); const fileSize = Number(body.file_size); const fileName = text(body.file_name, 240);
    const { data: resource } = await supabaseAdmin.from("learning_resources").select("id, academic_year, term, language").eq("id", resourceId).eq("grade", "Grade R").is("school_id", null).maybeSingle();
    if (!resource || !fileName.toLowerCase().endsWith(".pdf") || fileSize <= 0 || fileSize > 100 * 1024 * 1024) return NextResponse.json({ error: "Choose a valid Grade R PDF no larger than 100 MB." }, { status: 400 });
    const language = text(resource.language, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const path = `${resource.academic_year}/grade-r/resource-${resource.id}/book-${resource.term}/${language}-${crypto.randomUUID()}.pdf`;
    const { data, error } = await supabaseAdmin.storage.from("dbe-workbooks").createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "The workbook upload could not be prepared." }, { status: 400 });
    return NextResponse.json({ path, token: data.token });
  }
  if (action === "complete_upload") {
    const resourceId = Number(body.resource_id); const path = text(body.path, 500); const checksum = text(body.checksum, 128);
    const { data: resource } = await supabaseAdmin.from("learning_resources").select("id, academic_year, storage_path").eq("id", resourceId).eq("grade", "Grade R").is("school_id", null).maybeSingle();
    if (!resource || !path.startsWith(`${resource.academic_year}/grade-r/resource-${resourceId}/`) || path.includes("..")) return NextResponse.json({ error: "The workbook upload details are invalid." }, { status: 400 });
    if (resource.storage_path && resource.storage_path !== path) {
      const [activityUsage, homeworkUsage] = await Promise.all([
        supabaseAdmin.from("activity_learning_resources").select("id", { count: "exact", head: true }).eq("resource_id", resourceId),
        supabaseAdmin.from("homework_learning_resources").select("id", { count: "exact", head: true }).eq("resource_id", resourceId),
      ]);
      if ((activityUsage.count || 0) + (homeworkUsage.count || 0) > 0) {
        return NextResponse.json({ error: "This edition is already used by activities or homework. Add a new edition instead of replacing its file." }, { status: 409 });
      }
    }
    const cached = await supabaseAdmin.storage.from("dbe-workbooks").download(path);
    if (cached.error || !cached.data || cached.data.size > 104857600) return NextResponse.json({ error: "The uploaded PDF could not be verified." }, { status: 400 });
    const bytes = Buffer.from(await cached.data.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "The uploaded file is not a PDF." }, { status: 400 });
    const actualChecksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum && checksum !== actualChecksum) return NextResponse.json({ error: "The upload checksum does not match." }, { status: 400 });
    const { error } = await supabaseAdmin.from("learning_resources").update({ storage_path: path, checksum: actualChecksum, file_type: "application/pdf", catalogue_status: "needs_review", status: "draft", updated_at: new Date().toISOString() }).eq("id", resourceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.file_cached", { resource_id: resourceId });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unsupported catalogue action." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const authorization = await authorize(request); if (!authorization.ok) return authorization.response;
  const body = await request.json();
  if (body.action === "edit_metadata") {
    const id = Number(body.resource_id);
    const source = text(body.official_source_url, 1000);
    const pageCount = Number(body.page_count);
    let validSource = false;
    try { const url = new URL(source); validSource = url.protocol === "https:" && /(^|\.)education\.gov\.za$/i.test(url.hostname); } catch {}
    if (!id || !validSource || !Number.isInteger(pageCount) || pageCount < 1 || pageCount > 2000 || !text(body.title) || !text(body.language)) return NextResponse.json({ error: "Enter a title, language, official education.gov.za source and page count between 1 and 2,000." }, { status: 400 });
    const { error } = await supabaseAdmin.from("learning_resources").update({ title: text(body.title, 200), language: text(body.language, 80), book_number: text(body.book_number, 80), official_source_url: source, source_url: source, page_count: pageCount, version: text(body.version, 100) || null, catalogue_status: "needs_review", status: "draft", updated_at: new Date().toISOString() }).eq("id", id).is("school_id", null);
    if (error) return NextResponse.json({ error: "Workbook details could not be saved." }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.metadata_updated", { resource_id: id });
    return NextResponse.json({ success: true });
  }
  if (body.action === "set_default_year") {
    const academicYear = Number(body.academic_year);
    const { error } = await supabaseAdmin.rpc("set_learning_resource_default_year", { target_year: academicYear, actor: authorization.staff.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "learning_resource.default_year_changed", { academic_year: academicYear });
    return NextResponse.json({ success: true });
  }
  const resourceId = Number(body.resource_id); const catalogueStatus = text(body.catalogue_status, 40);
  if (!resourceId || !allowedCatalogueStatuses.has(catalogueStatus)) return NextResponse.json({ error: "Choose a valid resource and catalogue status." }, { status: 400 });
  const status = catalogueStatus === "archived" ? "archived" : catalogueStatus === "current" ? "published" : "draft";
  if (catalogueStatus === "current") {
    const { data: resource } = await supabaseAdmin.from("learning_resources").select("storage_path, official_source_url, page_count").eq("id", resourceId).eq("grade", "Grade R").is("school_id", null).maybeSingle();
    if (!resource?.storage_path || !resource.official_source_url || !resource.page_count) return NextResponse.json({ error: "Add a cached PDF, official source and verified page count before publishing this edition." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("learning_resources").update({ catalogue_status: catalogueStatus, status, updated_at: new Date().toISOString() }).eq("id", resourceId).eq("grade", "Grade R").is("school_id", null).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Workbook was not found." }, { status: 400 });
  await writeSecurityAudit(authorization.staff, "learning_resource.catalogue_status_changed", { resource_id: resourceId, catalogue_status: catalogueStatus });
  return NextResponse.json({ success: true });
}

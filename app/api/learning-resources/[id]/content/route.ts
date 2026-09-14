import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const resourceId = Number((await context.params).id);
  const search = new URL(request.url).searchParams;
  const schoolId = Number(search.get("school_id"));
  const assignmentId = Number(search.get("assignment_id"));
  const learnerId = String(search.get("learner_id") || "");
  if (!Number.isInteger(resourceId) || resourceId < 1 || !Number.isInteger(schoolId) || schoolId < 1 || (assignmentId && (!Number.isInteger(assignmentId) || assignmentId < 1))) {
    return NextResponse.json({ error: "Workbook request is invalid." }, { status: 400 });
  }

  if (assignmentId && learnerId) {
    const parent = await getCurrentParent();
    if (!parent || !parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
      return NextResponse.json({ error: "Workbook access is not allowed." }, { status: 403 });
    }
    const learner = (parent.children || []).find((item) => String(item.id) === learnerId && Number(item.school_id) === schoolId);
    const { data: link } = await supabaseAdmin
      .from("homework_learning_resources")
      .select("resource_id, homework_assignments!inner(id, school_id, classroom_id)")
      .eq("homework_assignment_id", assignmentId)
      .eq("resource_id", resourceId)
      .limit(1)
      .maybeSingle();
    const assignment = link?.homework_assignments as unknown as { school_id?: number; classroom_id?: number } | null;
    if (!link || Number(assignment?.school_id) !== schoolId || Number(assignment?.classroom_id) !== Number(learner?.classroom_id)) {
      return NextResponse.json({ error: "Workbook access is not allowed." }, { status: 403 });
    }
  } else {
    const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId);
    if (!authorization.ok) return authorization.response;
  }

  const { data: resource } = await supabaseAdmin
    .from("learning_resources")
    .select("id, title, grade, academic_year, language, term, book_number, source_name, official_source_url, source_url, storage_path, file_type, status, catalogue_status, is_parent_shareable")
    .eq("id", resourceId)
    .eq("grade", "Grade R")
    .or(`school_id.is.null,school_id.eq.${schoolId}`)
    .maybeSingle();
  if (!resource || resource.status !== "published" || resource.catalogue_status !== "current" || (assignmentId && !resource.is_parent_shareable)) {
    return NextResponse.json({ error: "This workbook is temporarily unavailable." }, { status: 404 });
  }

  try {
    if (resource.storage_path) {
      const { data, error } = await supabaseAdmin.storage.from("dbe-workbooks").createSignedUrl(resource.storage_path, 900);
      if (error || !data) throw error || new Error("Cached workbook is unavailable.");
      return NextResponse.json({ url: data.signedUrl, resource: { id: resource.id, title: resource.title, grade: resource.grade, academic_year: resource.academic_year, language: resource.language, term: resource.term, book_number: resource.book_number, source_name: resource.source_name } }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "The workbook is awaiting a verified cached PDF. Please contact your DailyBloom administrator." }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "This workbook is temporarily unavailable. Please try again later or contact your DailyBloom administrator." }, { status: 503 });
  }
}

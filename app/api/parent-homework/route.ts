import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const learnerId = String(params.get("learner_id") || "");
  const schoolId = Number(params.get("school_id"));
  const assignmentId = Number(params.get("assignment_id"));
  if (!parentCanAccessLearnerAtSchool(parent.children || [], schoolId, learnerId)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const learner = (parent.children || []).find((row) => String(row.id) === learnerId && Number(row.school_id) === schoolId);
  if (!learner?.classroom_id) return NextResponse.json({ homework: [] });

  const resourceId = Number(params.get("resource_id"));
  if (assignmentId && resourceId) {
    const { data: assignment } = await supabaseAdmin
      .from("homework_assignments")
      .select("id")
      .eq("id", assignmentId)
      .eq("school_id", schoolId)
      .eq("classroom_id", learner.classroom_id)
      .maybeSingle();
    if (!assignment) return NextResponse.json({ error: "Workbook is unavailable." }, { status: 404 });
    const { data: link } = await supabaseAdmin
      .from("homework_learning_resources")
      .select("page_from, page_to, selected_pages, learning_resources!inner(title, academic_year, language, is_printable, is_parent_shareable, status)")
      .eq("homework_assignment_id", assignmentId)
      .eq("resource_id", resourceId)
      .limit(1)
      .maybeSingle();
    const resource = link?.learning_resources as unknown as { title?: string; academic_year?: number; language?: string; is_printable?: boolean; is_parent_shareable?: boolean; status?: string } | null;
    if (resource?.status !== "published" || !resource.is_parent_shareable) {
      return NextResponse.json({ error: "Workbook is unavailable." }, { status: 404 });
    }
    const legacyPageCount = link?.page_from ? (link.page_to || link.page_from) - link.page_from + 1 : 0;
    const selectedPages = Array.isArray(link?.selected_pages) && link.selected_pages.length
      ? link.selected_pages
      : link?.page_from && legacyPageCount > 0 && legacyPageCount <= 2000
        ? Array.from({ length: legacyPageCount }, (_, index) => link.page_from! + index)
        : [];
    const readerParams = new URLSearchParams({ resource_id: String(resourceId), school_id: String(schoolId), assignment_id: String(assignmentId), learner_id: learnerId, title: resource.title || "Grade R workbook", year: String(resource.academic_year || ""), language: resource.language || "", pages: selectedPages.join(",") });
    return NextResponse.json({
      url: `/parent/workbook?${readerParams}`,
      title: resource.title || "Grade R workbook",
      page_from: link?.page_from || null,
      page_to: link?.page_to || null,
    });
  }

  if (assignmentId) {
    const { data: assignment } = await supabaseAdmin
      .from("homework_assignments")
      .select("homework_id, homework_library!inner(file_path)")
      .eq("id", assignmentId)
      .eq("school_id", schoolId)
      .eq("classroom_id", learner.classroom_id)
      .maybeSingle();
    const library = assignment?.homework_library as unknown as { file_path?: string } | null;
    if (!library?.file_path) return NextResponse.json({ error: "Homework not found." }, { status: 404 });
    const { data, error } = await supabaseAdmin.storage.from("classroom-homework").createSignedUrl(library.file_path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || "Homework could not be opened." }, { status: 400 });
    return NextResponse.json({ url: data.signedUrl });
  }

  const { data, error } = await supabaseAdmin
    .from("homework_assignments")
    .select("id, week_start, activity_date, due_date, homework_id, instruction_note, position, homework_library(title, file_name), homework_learning_resources(resource_id, page_from, page_to, selected_pages, learning_resources(title, academic_year, language, is_parent_shareable, status))")
    .eq("school_id", schoolId)
    .eq("classroom_id", learner.classroom_id)
    .order("activity_date", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const homework = (data || []).map((assignment) => {
    const assignmentWithResources = assignment as unknown as {
      homework_learning_resources?: Array<{
        resource_id: number;
        page_from?: number | null;
        page_to?: number | null;
        selected_pages?: number[] | null;
        learning_resources?: { title?: string | null; academic_year?: number | null; language?: string | null; is_parent_shareable?: boolean | null; status?: string | null } | null;
      }>;
    };
    const workbook_resources = (assignmentWithResources.homework_learning_resources || [])
      .filter((link) => link.learning_resources?.status === "published" && link.learning_resources.is_parent_shareable)
      .map((link) => ({ resource_id: link.resource_id, page_from: link.page_from || null, page_to: link.page_to || null, selected_pages: link.selected_pages || [], title: link.learning_resources?.title || "Grade R workbook", academic_year: link.learning_resources?.academic_year || null, language: link.learning_resources?.language || null }));
    const safeAssignment = Object.fromEntries(Object.entries(assignment).filter(([key]) => key !== "homework_learning_resources"));
    return { ...safeAssignment, workbook_resources };
  });
  return NextResponse.json({ homework }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

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
      .select("page_from, page_to, learning_resources!inner(title, source_url, is_printable, is_parent_shareable, status)")
      .eq("homework_assignment_id", assignmentId)
      .eq("resource_id", resourceId)
      .maybeSingle();
    const resource = link?.learning_resources as unknown as { title?: string; source_url?: string; is_printable?: boolean; is_parent_shareable?: boolean; status?: string } | null;
    if (!resource?.source_url || resource.status !== "published" || !resource.is_parent_shareable || !resource.is_printable) {
      return NextResponse.json({ error: "Workbook is unavailable." }, { status: 404 });
    }
    const workbookUrl = new URL(resource.source_url);
    if (link?.page_from) workbookUrl.hash = `page=${link.page_from}`;
    return NextResponse.json({
      url: workbookUrl.toString(),
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
    .select("id, week_start, activity_date, due_date, homework_id, instruction_note, position, homework_library(title, file_name), homework_learning_resources(resource_id, page_from, page_to, learning_resources(title, source_url, is_printable, is_parent_shareable, status))")
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
        learning_resources?: { title?: string | null; source_url?: string | null; is_printable?: boolean | null; is_parent_shareable?: boolean | null; status?: string | null } | null;
      }>;
    };
    const workbook_resources = (assignmentWithResources.homework_learning_resources || [])
      .filter((link) => link.learning_resources?.status === "published" && link.learning_resources.is_parent_shareable && link.learning_resources.is_printable && link.learning_resources.source_url)
      .map((link) => ({ resource_id: link.resource_id, page_from: link.page_from || null, page_to: link.page_to || null, title: link.learning_resources?.title || "Grade R workbook" }));
    const { homework_learning_resources: _hiddenLinks, ...safeAssignment } = assignment as { homework_learning_resources?: unknown };
    return { ...safeAssignment, workbook_resources };
  });
  return NextResponse.json({ homework }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

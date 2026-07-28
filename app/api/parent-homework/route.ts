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
    .select("id, week_start, activity_date, homework_id, instruction_note, position, homework_library(title, file_name)")
    .eq("school_id", schoolId)
    .eq("classroom_id", learner.classroom_id)
    .order("activity_date", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ homework: data || [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const schoolId = Number(body.school_id);
  const learnerId = String(body.learner_id || "");
  const academicYear = Number(body.academic_year);
  const access = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!access.ok) return access.response;
  if (!learnerId || !Number.isInteger(academicYear) || academicYear < 2020 || academicYear > 2100) {
    return NextResponse.json({ error: "Choose a valid learner and academic year." }, { status: 400 });
  }
  const { data: learner, error: learnerError } = await supabaseAdmin.from("learners").select("id").eq("id", learnerId).eq("school_id", schoolId).maybeSingle();
  if (learnerError || !learner) return NextResponse.json({ error: "Learner not found in this school." }, { status: 404 });
  const { error } = await supabaseAdmin.from("learner_placements").upsert({
    learner_id: learnerId,
    school_id: schoolId,
    academic_year: academicYear,
    classroom_id: null,
    placement_status: "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "learner_id,academic_year" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeSecurityAudit(access.staff, "learner.waiting_list_added", { school_id: schoolId, learner_id: learnerId, academic_year: academicYear });
  return NextResponse.json({ success: true });
}

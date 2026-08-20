import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const learnerId = String(params.get("learner_id") || "");
  const access = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!access.ok) return access.response;
  if (!learnerId) return NextResponse.json({ error: "Learner is required." }, { status: 400 });
  const [enrolmentsResult, reenrolmentsResult, placementsResult] = await Promise.all([
    supabaseAdmin.from("school_enrolment_enquiries").select("id, enquiry_reference, academic_year, status, enrolment_source, submitted_data, submitted_at, reviewed_at, created_at").eq("school_id", schoolId).eq("learner_id", learnerId),
    supabaseAdmin.from("learner_reenrolments").select("id, reenrolment_reference, status, submitted_data, renewal_snapshot, reviewed_at, created_at, school_reenrolment_campaigns:campaign_id(school_year)").eq("school_id", schoolId).eq("learner_id", learnerId),
    supabaseAdmin.from("learner_placements").select("id, academic_year, placement_status, classroom_id, start_date, end_date, classrooms(classroom_name)").eq("school_id", schoolId).eq("learner_id", learnerId).order("academic_year", { ascending: false }),
  ]);
  const failure = enrolmentsResult.error || reenrolmentsResult.error || placementsResult.error;
  if (failure) return NextResponse.json({ error: failure.message }, { status: 500 });
  const enrolments = (enrolmentsResult.data || []).map((record) => ({ ...record, record_type: "enrolment" }));
  const reenrolments = (reenrolmentsResult.data || []).map((record) => {
    const campaign = Array.isArray(record.school_reenrolment_campaigns) ? record.school_reenrolment_campaigns[0] : record.school_reenrolment_campaigns;
    return { id: record.id, enquiry_reference: record.reenrolment_reference, academic_year: Number((campaign as { school_year?: unknown } | null)?.school_year || 0), status: record.status, enrolment_source: "re_enrolment", submitted_data: record.submitted_data, renewal_snapshot: record.renewal_snapshot, reviewed_at: record.reviewed_at, created_at: record.created_at, record_type: "re_enrolment" };
  });
  const history = [...enrolments, ...reenrolments].sort((left, right) => Number(right.academic_year) - Number(left.academic_year));
  return NextResponse.json({ history, placements: placementsResult.data || [] });
}

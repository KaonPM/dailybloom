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
  const { data, error } = await supabaseAdmin.from("school_enrolment_enquiries")
    .select("id, enquiry_reference, academic_year, status, enrolment_source, submitted_at, reviewed_at, created_at")
    .eq("school_id", schoolId).eq("learner_id", learnerId).order("academic_year", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data || [] });
}

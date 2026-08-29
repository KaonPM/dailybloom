import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const requestedSchoolId = Number(new URL(request.url).searchParams.get("school_id") || 0);
  let authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, requestedSchoolId || undefined);
  if (!authorization.ok) authorization = await requireStaffPermission(request, PERMISSIONS.PROGRESS_REPORTS_MANAGE, requestedSchoolId || undefined);
  if (!authorization.ok) authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, requestedSchoolId || undefined);
  if (!authorization.ok) return authorization.response;

  const { data, error } = await supabaseAdmin
    .from("school_setup_settings")
    .select("grade_r_home_language, grade_r_first_additional_language")
    .eq("school_id", authorization.staff.schoolId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: {
      grade_r_home_language: data?.grade_r_home_language || "English",
      grade_r_first_additional_language: data?.grade_r_first_additional_language || "Afrikaans",
    },
  });
}

import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id") || 0);
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId || undefined);
  if (!authorization.ok) return authorization.response;
  const { data, error } = await supabaseAdmin.from("learning_resources").select("*").eq("grade", "Grade R").eq("status", "published").or(`school_id.is.null,school_id.eq.${authorization.staff.schoolId}`).order("term").order("title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resources: data || [] });
}

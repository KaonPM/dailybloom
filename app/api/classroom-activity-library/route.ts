import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.ACTIVITIES_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const { data, error } = await supabaseAdmin
    .from("activity_library")
    .select("id, school_id, developmental_area, theme, activity_name, description, created_by, archived")
    .eq("school_id", schoolId)
    .eq("archived", false)
    .order("theme", { ascending: true })
    .order("activity_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ activities: data || [] });
}

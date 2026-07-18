import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffPermission } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(request, PERMISSIONS.STAFF_VIEW, schoolId);
    if (!authorization.ok) return authorization.response;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase server keys." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await admin
      .from("profiles")
      .select(
        "id, school_id, full_name, email, role, classroom_name, is_active, created_at"
      )
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ teachers: data || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load teachers." },
      { status: 500 }
    );
  }
}

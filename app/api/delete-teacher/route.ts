import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const teacherId = String(body.teacher_id || "").trim();
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(request, PERMISSIONS.STAFF_MANAGE, schoolId);
    if (!authorization.ok) return authorization.response;

    if (!teacherId) {
      return NextResponse.json({ error: "Practitioner ID is required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase server keys." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: targetTeacher, error: teacherLookupError } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .maybeSingle();

    if (teacherLookupError) {
      return NextResponse.json({ error: teacherLookupError.message }, { status: 400 });
    }

    if (!targetTeacher) {
      return NextResponse.json({ error: "Practitioner not found in this school." }, { status: 404 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        school_id: null,
        classroom_id: null,
        classroom_name: null,
        is_active: false,
      })
      .eq("id", teacherId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error: membershipError } = await admin
      .from("school_memberships")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("user_id", teacherId)
      .eq("school_id", schoolId);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    await writeSecurityAudit(authorization.staff, "teacher.removed_from_school", {
      teacher_id: teacherId,
      school_id: schoolId,
      teacher_name: targetTeacher.full_name,
    });

    return NextResponse.json({
      success: true,
      message:
        "Practitioner removed from this school. Their existing records are preserved and they can be reassigned later.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove practitioner." },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json(
        { error: "Teacher ID is required." },
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

    const { data: targetTeacher } = await admin.from("profiles").select("id")
      .eq("id", teacherId).eq("school_id", schoolId).eq("role", "teacher").maybeSingle();
    if (!targetTeacher) return NextResponse.json({ error: "Teacher not found in this school." }, { status: 404 });

    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .eq("role", "teacher");

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    const { error: authError } = await admin.auth.admin.deleteUser(teacherId);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    await writeSecurityAudit(authorization.staff, "teacher.deleted", { teacher_id: teacherId, school_id: schoolId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not delete teacher." },
      { status: 500 }
    );
  }
}

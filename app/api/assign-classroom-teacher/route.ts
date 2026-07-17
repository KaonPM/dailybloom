import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = Number(body.school_id);
    const classroomName = String(body.classroom_name || "").trim();
    const teacherId = String(body.teacher_id || "").trim();
    const authorization = await requireStaffPermission(request, PERMISSIONS.CLASSROOM_ASSIGN, schoolId);
    if (!authorization.ok) return authorization.response;

    if (!schoolId || !classroomName || !teacherId) {
      return NextResponse.json(
        { error: "School, classroom, and teacher are required." },
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

    await admin
      .from("profiles")
      .update({ classroom_name: null })
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .eq("classroom_name", classroomName);

    const { error } = await admin
      .from("profiles")
      .update({ classroom_name: classroomName })
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .eq("role", "teacher");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await writeSecurityAudit(authorization.staff, "classroom.teacher_assigned", { teacher_id: teacherId, classroom_name: classroomName });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not assign teacher." },
      { status: 500 }
    );
  }
}

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
        { error: "School, classroom, and practitioner are required." },
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

    const { data: classroom, error: classroomError } = await admin
      .from("classrooms")
      .select("id, classroom_name")
      .eq("school_id", schoolId)
      .eq("classroom_name", classroomName)
      .maybeSingle();

    if (classroomError) {
      return NextResponse.json({ error: classroomError.message }, { status: 400 });
    }
    if (!classroom) {
      return NextResponse.json({ error: "The selected classroom could not be found." }, { status: 404 });
    }

    const { data: teacher, error: teacherError } = await admin
      .from("profiles")
      .select("id, is_active")
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .maybeSingle();
    if (teacherError) {
      return NextResponse.json({ error: teacherError.message }, { status: 400 });
    }
    if (!teacher || teacher.is_active === false) {
      return NextResponse.json(
        { error: "The selected practitioner could not be found in this school." },
        { status: 404 }
      );
    }

    await admin
      .from("profiles")
      .update({ classroom_id: null, classroom_name: null })
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .eq("classroom_name", classroomName);

    const { data: assignedTeacher, error } = await admin
      .from("profiles")
      .update({ classroom_id: classroom.id, classroom_name: classroomName })
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .select("id")
      .maybeSingle();

    if (error || !assignedTeacher) {
      return NextResponse.json(
        { error: error?.message || "The practitioner could not be assigned." },
        { status: error ? 400 : 409 }
      );
    }

    await writeSecurityAudit(authorization.staff, "classroom.teacher_assigned", { teacher_id: teacherId, classroom_name: classroomName });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not assign practitioner." },
      { status: 500 }
    );
  }
}

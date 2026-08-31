import { NextResponse } from "next/server";
import { PERMISSIONS } from "../../lib/permissions";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "../../lib/server-authorization";
import { supabaseAdmin } from "../../lib/supabase-admin";

const ATTENDANCE_STATUSES = new Set([
  "Present",
  "Absent",
  "Sick Leave",
  "Annual Leave",
  "Family Responsibility Leave",
  "Late Arrival",
  "Early Departure",
]);

type AttendanceInput = {
  teacher_id?: unknown;
  attendance_date?: unknown;
  status?: unknown;
  notes?: unknown;
};

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.TEACHER_ATTENDANCE_MANAGE,
      schoolId
    );
    if (!authorization.ok) return authorization.response;

    const inputRows = Array.isArray(body.records)
      ? (body.records as AttendanceInput[])
      : [];

    if (!schoolId || inputRows.length === 0 || inputRows.length > 100) {
      return NextResponse.json(
        { error: "Provide between 1 and 100 practitioner attendance records." },
        { status: 400 }
      );
    }

    const records = inputRows.map((item) => ({
      teacher_id: String(item.teacher_id || "").trim(),
      attendance_date: String(item.attendance_date || "").trim(),
      status: String(item.status || "").trim(),
      notes: typeof item.notes === "string" ? item.notes.trim() || null : null,
    }));

    if (
      records.some(
        (record) =>
          !record.teacher_id ||
          !isDate(record.attendance_date) ||
          !ATTENDANCE_STATUSES.has(record.status)
      )
    ) {
      return NextResponse.json(
        { error: "Each record needs a practitioner, valid date, and attendance status." },
        { status: 400 }
      );
    }

    const teacherIds = [...new Set(records.map((record) => record.teacher_id))];
    if (teacherIds.length !== records.length) {
      return NextResponse.json(
        { error: "Each practitioner can only be recorded once per request." },
        { status: 400 }
      );
    }

    const { data: teachers, error: teachersError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .in("id", teacherIds);

    if (teachersError) {
      return NextResponse.json({ error: teachersError.message }, { status: 400 });
    }

    const teachersById = new Map(
      (teachers || [])
        .filter((teacher) => teacher.is_active !== false)
        .map((teacher) => [String(teacher.id), teacher])
    );
    if (teachersById.size !== teacherIds.length) {
      return NextResponse.json(
        { error: "One or more practitioners are no longer active in this school." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("teacher_attendance").upsert(
      records.map((record) => {
        const teacher = teachersById.get(record.teacher_id)!;
        return {
          school_id: schoolId,
          teacher_id: record.teacher_id,
          teacher_name: teacher.full_name || teacher.email || "Unnamed practitioner",
          attendance_date: record.attendance_date,
          status: record.status,
          notes: record.notes,
          updated_at: new Date().toISOString(),
        };
      }),
      { onConflict: "school_id,teacher_id,attendance_date" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await writeSecurityAudit(authorization.staff, "practitioner_attendance.saved", {
      count: records.length,
      dates: [...new Set(records.map((record) => record.attendance_date))],
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save practitioner attendance.",
      },
      { status: 500 }
    );
  }
}

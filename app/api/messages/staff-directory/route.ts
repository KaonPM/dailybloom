import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required." },
        { status: 400 }
      );
    }

    const [
      { data: teachers, error: teachersError },
      { data: principals, error: principalsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, school_id, full_name, email, role, classroom_name, is_active")
        .eq("school_id", schoolId)
        .eq("role", "teacher")
        .order("full_name", { ascending: true }),

      supabaseAdmin
        .from("profiles")
        .select("id, school_id, full_name, email, role, classroom_name, is_active")
        .eq("school_id", schoolId)
        .in("role", ["principal", "master", "owner"])
        .order("full_name", { ascending: true }),
    ]);

    if (teachersError || principalsError) {
      return NextResponse.json(
        { error: teachersError?.message || principalsError?.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      teachers: (teachers || []).filter((teacher) => teacher.is_active !== false),
      principals: (principals || []).filter(
        (principal) => principal.is_active !== false
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load message contacts." },
      { status: 500 }
    );
  }
}

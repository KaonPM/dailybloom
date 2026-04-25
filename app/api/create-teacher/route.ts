import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = body.school_id;
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();
    const classroomName = String(body.classroom_name || "").trim();

    if (!schoolId || !fullName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: "Missing server environment keys." },
        { status: 500 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Could not create auth user." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").insert([
      {
        id: authData.user.id,
        school_id: schoolId,
        full_name: fullName,
        email,
        role: "teacher",
        classroom_name: classroomName || null,
        is_active: true,
      },
    ]);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not create teacher." },
      { status: 500 }
    );
  }
}
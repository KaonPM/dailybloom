import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const schoolId = Number(body.school_id);
    const classroomName = String(body.classroom_name || "").trim();

    if (!fullName || !email || !password || !schoolId) {
      return NextResponse.json(
        { error: "Full name, email, password, and school are required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase server environment variables." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
        },
      });

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Could not create teacher login." },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        [
          {
            id: userId,
            full_name: fullName,
            email,
            role: "teacher",
            school_id: schoolId,
            classroom_name: classroomName || null,
            approval_status: "approved",
          },
        ],
        { onConflict: "id" }
      );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    const { error: teacherError } = await supabaseAdmin.from("teachers").insert([
      {
        school_id: schoolId,
        full_name: fullName,
        email,
        classroom_name: classroomName || null,
        profile_id: userId,
      },
    ]);

    if (teacherError) {
      return NextResponse.json(
        { error: teacherError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Teacher login created successfully.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while creating teacher login." },
      { status: 500 }
    );
  }
}
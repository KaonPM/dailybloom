import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendLoginEmail } from "../../lib/send-login-email";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = Number(body.school_id);
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const classroomName = String(body.classroom_name || "").trim();

    const strongPasswordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!schoolId || !fullName || !email || !password) {
      await sendLoginEmail({
      toEmail: email,
      fullName,
      temporaryPassword: password,
      roleLabel: "teacher",
      });
      return NextResponse.json(
        { error: "Please complete teacher name, email, password, and school." },
        { status: 400 }
      );
    }

    if (!strongPasswordRegex.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include letters, numbers, and a special character.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase service role key." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Could not create teacher login." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { error: profileError } = await admin.from("profiles").insert([
      {
        id: userId,
        school_id: schoolId,
        full_name: fullName,
        email,
        role: "teacher",
        classroom_name: classroomName || null,
        is_active: true,
        must_change_password: true,
      },
    ]);

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Teacher created successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not create teacher." },
      { status: 500 }
    );
  }
}
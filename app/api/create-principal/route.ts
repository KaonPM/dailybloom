import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { sendLoginEmail } from "../../lib/send-login-email";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const schoolId = Number(body.schoolId);
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const requestId = body.requestId;

    const strongPasswordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!schoolId || !fullName || !email || !password) {
      await sendLoginEmail({
      toEmail: email,
      fullName,
      temporaryPassword: password,
      roleLabel: "owner",
      });
      return NextResponse.json(
        { error: "Missing required fields." },
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

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "owner",
        },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Could not create auth user." },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: userId,
          email,
          full_name: fullName,
          school_id: Number(schoolId),
          role: "owner",
          must_change_password: true,
        },
      ]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    if (requestId) {
      await supabaseAdmin
        .from("principal_requests")
        .update({ status: "completed" })
        .eq("id", requestId);
    }

    return NextResponse.json({
      success: true,
      userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error while creating principal." },
      { status: 500 }
    );
  }
}
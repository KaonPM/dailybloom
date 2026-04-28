import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      requestId,
      schoolName,
      principalFullName,
      principalEmail,
      primaryColor,
      secondaryColor,
    } = body;

    if (!requestId || !schoolName || !principalFullName || !principalEmail) {
      return NextResponse.json(
        { error: "Missing required sign-up approval details." },
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

    const tempPassword = generateTempPassword();

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({
        school_name: schoolName.trim(),
        primary_color: primaryColor || "#7CCCF3",
        secondary_color: secondaryColor || "#FFD76A",
        logo_url: null,
      })
      .select("id, school_name")
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: schoolError?.message || "Could not create school." },
        { status: 500 }
      );
    }

    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: principalEmail.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: principalFullName.trim(),
          role: "principal",
          school_id: school.id,
        },
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message || "Could not create principal login." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUser.user.id,
      full_name: principalFullName.trim(),
      email: principalEmail.trim(),
      role: "principal",
      school_id: school.id,
      approval_status: "approved",
      must_change_password: true,
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    const { error: requestUpdateError } = await admin
      .from("school_signup_requests")
      .update({
        status: "approved",
        school_id: school.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (requestUpdateError) {
      return NextResponse.json(
        { error: requestUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      tempPassword,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Approval failed." },
      { status: 500 }
    );
  }
}

function generateTempPassword() {
  const random = Math.random().toString(36).slice(-8);
  return `Bloom@${random}1`;
}
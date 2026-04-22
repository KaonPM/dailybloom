import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schoolId, fullName, email, password, requestId } = body;

    if (!schoolId || !fullName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields." },
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

    const { error: profileError } = await supabaseAdmin.from("profiles").insert([
      {
        id: userId,
        email,
        full_name: fullName,
        school_id: Number(schoolId),
        role: "owner",
      },
    ]);

    if (profileError) {
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
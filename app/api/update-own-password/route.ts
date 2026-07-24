import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your secure password session is invalid or has expired." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const password = String(body.password || "");
  if (!STRONG_PASSWORD.test(password)) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
      },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, school_id, role, full_name, email, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.is_active === false) {
    return NextResponse.json(
      { error: "An active DailyBloom staff profile is required." },
      { status: 403 }
    );
  }

  const { error: passwordError } =
    await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
      password,
    });
  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  const { error: updateProfileError } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userData.user.id);
  if (updateProfileError) {
    return NextResponse.json(
      {
        error:
          "Your password was updated, but DailyBloom could not finish updating your profile. Please contact support.",
      },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("security_audit_log").insert({
    actor_id: userData.user.id,
    actor_name: profile.full_name || profile.email || userData.user.email,
    actor_role: profile.role,
    school_id: profile.school_id,
    action: "auth.password_updated",
    details: { self_service: true },
  });

  return NextResponse.json({ success: true, role: profile.role });
}

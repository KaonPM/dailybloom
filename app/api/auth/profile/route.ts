import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Your session has expired. Please log in again." }, { status: 401 });
  }

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "DailyBloom could not retrieve your account profile." },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      {
        error:
          "This login is not linked to a DailyBloom account profile. Please contact the platform administrator.",
      },
      { status: 404 }
    );
  }

  const schoolId = Number(profile.school_id || 0);
  const [{ data: platformRole }, { data: membership }, { data: school }] =
    await Promise.all([
      supabaseAdmin
        .from("platform_user_roles")
        .select("role, status, permissions")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      schoolId
        ? supabaseAdmin
            .from("school_memberships")
            .select("school_id, role, status, permissions")
            .eq("user_id", userId)
            .eq("school_id", schoolId)
            .eq("status", "active")
            .maybeSingle()
        : Promise.resolve({ data: null }),
      schoolId
        ? supabaseAdmin
            .from("schools")
            .select("is_active")
            .eq("id", schoolId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const effectiveRole = platformRole?.role || membership?.role || profile.role;
  const effectivePermissions =
    platformRole?.permissions || membership?.permissions || [];

  return NextResponse.json({
    profile: {
      ...profile,
      role: String(effectiveRole || ""),
      permissions: Array.isArray(effectivePermissions) ? effectivePermissions : [],
      platform_role: platformRole?.role || null,
      school_is_active: school?.is_active !== false,
    },
  });
}

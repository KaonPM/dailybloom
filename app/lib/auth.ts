import { supabase } from "./supabase";

export async function getCurrentProfile() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return {
      profile: null,
      user: null,
      error: sessionError || new Error("No active session"),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    return {
      profile: null,
      user: session.user,
      error: profileError,
    };
  }

  const [{ data: platformRole }, { data: membership }] = await Promise.all([
    supabase
      .from("platform_user_roles")
      .select("role, status, permissions")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .maybeSingle(),
    profile.school_id
      ? supabase
          .from("school_memberships")
          .select("school_id, role, status, permissions")
          .eq("user_id", session.user.id)
          .eq("school_id", profile.school_id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const effectiveRole = platformRole?.role || membership?.role || profile.role;
  const effectivePermissions = platformRole?.permissions || membership?.permissions || [];

  return {
    profile: {
      ...profile,
      role: effectiveRole,
      permissions: effectivePermissions,
      platform_role: platformRole?.role || null,
    },
    user: session.user,
    error: null,
  };
}

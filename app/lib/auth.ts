import { supabase } from "./supabase";
import { authenticatedFetch } from "./authenticated-fetch";

type CurrentProfile = {
  id: string;
  role: string;
  school_id?: number | null;
  is_active?: boolean | null;
  must_change_password?: boolean | null;
  permissions: string[];
  platform_role?: string | null;
  school_is_active?: boolean;
  classroom_id?: number | null;
  classroom_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  teacher_name?: string | null;
  display_name?: string | null;
  assigned_classroom_id?: number | null;
  assigned_classroom?: string | null;
  assigned_classroom_name?: string | null;
  classroom?: string | null;
  class?: string | null;
};

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

  let profilePayload: { profile?: CurrentProfile; error?: string };

  try {
    const response = await authenticatedFetch("/api/auth/profile", {
      cache: "no-store",
    });
    profilePayload = await response.json();

    if (!response.ok || !profilePayload.profile) {
      throw new Error(profilePayload.error || "Could not load your account profile.");
    }
  } catch (profileError) {
    return {
      profile: null,
      user: session.user,
      error:
        profileError instanceof Error
          ? profileError
          : new Error("Could not load your account profile."),
    };
  }

  return {
    profile: profilePayload.profile,
    user: session.user,
    error: null,
  };
}

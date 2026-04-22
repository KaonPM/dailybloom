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

  return {
    profile,
    user: session.user,
    error: null,
  };
}
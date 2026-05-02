import { getCurrentProfile } from "./auth";
import { supabase } from "./supabase";

export async function resolveSchoolContext(
  schoolParam: string | null
): Promise<{
  schoolId: number | null;
  isMaster: boolean;
  shouldReturnToMaster: boolean;
  error: string | null;
  status: string | null;
}> {
  const { profile, error } = await getCurrentProfile();

  if (error || !profile) {
    return {
      schoolId: null,
      isMaster: false,
      shouldReturnToMaster: false,
      error: "Not authenticated",
      status: null,
    };
  }

  let resolvedSchoolId: number | null = null;
  let isMaster = false;

  if (profile.role === "master") {
    isMaster = true;

    if (schoolParam && schoolParam !== "null" && schoolParam !== "") {
      resolvedSchoolId = Number(schoolParam);
    } else {
      return {
        schoolId: null,
        isMaster: true,
        shouldReturnToMaster: true,
        error: null,
        status: null,
      };
    }
  } else {
    if (!profile.school_id) {
      return {
        schoolId: null,
        isMaster: false,
        shouldReturnToMaster: false,
        error: "No school linked to this account",
        status: null,
      };
    }

    resolvedSchoolId = Number(profile.school_id);
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id, status")
    .eq("id", resolvedSchoolId)
    .single();

  if (schoolError || !school) {
    return {
      schoolId: null,
      isMaster,
      shouldReturnToMaster: false,
      error: "School not found",
      status: null,
    };
  }

  const schoolStatus = String(school.status || "active").toLowerCase();

  if (schoolStatus !== "active") {
    return {
      schoolId: null,
      isMaster,
      shouldReturnToMaster: false,
      error: "School is not active",
      status: schoolStatus,
    };
  }

  return {
    schoolId: resolvedSchoolId,
    isMaster,
    shouldReturnToMaster: false,
    error: null,
    status: schoolStatus,
  };
}
import { getCurrentProfile } from "./auth";

export async function resolveSchoolContext(
  schoolParam: string | null
): Promise<{
  schoolId: number | null;
  isMaster: boolean;
  shouldReturnToMaster: boolean;
  error: string | null;
}> {
  const { profile, error } = await getCurrentProfile();

  if (error || !profile) {
    return {
      schoolId: null,
      isMaster: false,
      shouldReturnToMaster: false,
      error: "Not authenticated",
    };
  }

  if (profile.role === "master") {
    if (schoolParam && schoolParam !== "null" && schoolParam !== "") {
      return {
        schoolId: Number(schoolParam),
        isMaster: true,
        shouldReturnToMaster: false,
        error: null,
      };
    }

    return {
      schoolId: null,
      isMaster: true,
      shouldReturnToMaster: true,
      error: null,
    };
  }

  if (!profile.school_id) {
    return {
      schoolId: null,
      isMaster: false,
      shouldReturnToMaster: false,
      error: "No school linked to this account",
    };
  }

  return {
    schoolId: Number(profile.school_id),
    isMaster: false,
    shouldReturnToMaster: false,
    error: null,
  };
}
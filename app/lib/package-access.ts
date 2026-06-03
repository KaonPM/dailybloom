import { supabase } from "./supabase";

export async function schoolHasFeature(
  planName: string | null,
  featureKey: string
) {
  if (!planName || !featureKey) return false;

  const cleanPlanName = String(planName).trim().toLowerCase();

  if (cleanPlanName === "bloom elite") {
    return true;
  }

  const { data, error } = await supabase
    .from("package_features")
    .select("id")
    .eq("plan_name", planName)
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (error || !data) return false;

  return true;
}
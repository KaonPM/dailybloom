import { supabase } from "./supabase";

export async function getSchoolSubscriptionAccess(schoolId: number) {
  const { data: subscription, error } = await supabase
    .from("school_subscriptions")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (subscription && !error) {
    if (subscription.status === "cancelled") {
      return {
        allowed: false,
        reason: "This school's subscription has been cancelled.",
        planName: subscription.plan_name || subscription.package_name,
        status: subscription.status,
      };
    }

    if (subscription.status === "overdue") {
      return {
        allowed: false,
        reason: "This school's subscription is overdue.",
        planName: subscription.plan_name || subscription.package_name,
        status: subscription.status,
      };
    }

    if (subscription.status === "active" || subscription.status === "trial") {
      return {
        allowed: true,
        reason: null,
        planName: subscription.plan_name || subscription.package_name,
        status: subscription.status,
      };
    }
  }

  const { data: school } = await supabase
    .from("schools")
    .select("package_name, billing_status, status, is_active")
    .eq("id", schoolId)
    .maybeSingle();

  if (
    school &&
    school.is_active === true &&
    school.status === "active" &&
    school.billing_status === "active" &&
    school.package_name
  ) {
    return {
      allowed: true,
      reason: null,
      planName: school.package_name,
      status: school.billing_status,
    };
  }

  return {
    allowed: false,
    reason: "No active subscription found for this school.",
    planName: school?.package_name || null,
    status: school?.billing_status || null,
  };
}
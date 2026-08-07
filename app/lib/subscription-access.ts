import { supabase } from "./supabase";

export async function getSchoolSubscriptionAccess(schoolId: number) {
  const { data: subscription, error } = await supabase
    .from("school_subscriptions")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data: school } = await supabase
    .from("schools")
    .select("package_name, billing_status, status, is_active, is_demo_school")
    .eq("id", schoolId)
    .maybeSingle();

  // Demo schools stay usable even when an old subscription is overdue or
  // cancelled. Their access is controlled by the active school record while
  // DailyBloom invoices and reminder SMS remain paused.
  if (
    school?.is_demo_school === true &&
    school.is_active !== false &&
    school.status === "active"
  ) {
    return {
      allowed: true,
      reason: null,
      planName:
        subscription?.plan_name || subscription?.package_name || school.package_name,
      status: "demo",
    };
  }

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

    if (
      subscription.status === "active" ||
      subscription.status === "trial" ||
      subscription.status === "demo"
    ) {
      return {
        allowed: true,
        reason: null,
        planName: subscription.plan_name || subscription.package_name,
        status: subscription.status,
      };
    }
  }

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

import { supabase } from "./supabase";

export async function getSchoolSubscriptionAccess(schoolId: number) {
  const { data: subscription, error } = await supabase
    .from("school_subscriptions")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !subscription) {
    return {
      allowed: false,
      reason: "No active subscription found for this school.",
      planName: null,
      status: null,
    };
  }

  if (subscription.status === "cancelled") {
    return {
      allowed: false,
      reason: "This school's subscription has been cancelled.",
      planName: subscription.plan_name,
      status: subscription.status,
    };
  }

  if (subscription.status === "overdue") {
    return {
      allowed: false,
      reason: "This school's subscription is overdue.",
      planName: subscription.plan_name,
      status: subscription.status,
    };
  }

  return {
    allowed: true,
    reason: null,
    planName: subscription.plan_name,
    status: subscription.status,
  };
}
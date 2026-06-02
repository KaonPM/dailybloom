import { getSchoolSubscriptionAccess } from "./subscription-access";
import { schoolHasFeature } from "./package-access";

export async function checkSchoolAccess(
  schoolId: number,
  featureKey: string
) {
  const subscription = await getSchoolSubscriptionAccess(schoolId);

  if (!subscription.allowed) {
    return {
      allowed: false,
      reason: subscription.reason,
      status: subscription.status,
      planName: subscription.planName,
    };
  }

  const hasFeature = await schoolHasFeature(subscription.planName, featureKey);

  if (!hasFeature) {
    return {
      allowed: false,
      reason: `This feature is not included in the ${subscription.planName} package.`,
      status: subscription.status,
      planName: subscription.planName,
    };
  }

  return {
    allowed: true,
    reason: null,
    status: subscription.status,
    planName: subscription.planName,
  };
}
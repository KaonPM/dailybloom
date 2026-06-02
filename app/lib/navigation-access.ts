import { getSchoolSubscriptionAccess } from "./subscription-access";
import { schoolHasFeature } from "./package-access";

export type NavigationItem = {
  label: string;
  href: string;
  match?: string[];
  view?: string;
  featureKey?: string;
};

export async function getAllowedNavigationItems(
  schoolId: number | null,
  items: NavigationItem[]
) {
  if (!schoolId) {
    return items.filter((item) => !item.featureKey);
  }

  const subscription = await getSchoolSubscriptionAccess(schoolId);

  if (!subscription.allowed || !subscription.planName) {
    return items.filter((item) => !item.featureKey);
  }

  const checkedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.featureKey) {
        return {
          item,
          allowed: true,
        };
      }

      const allowed = await schoolHasFeature(
        subscription.planName,
        item.featureKey
      );

      return {
        item,
        allowed,
      };
    })
  );

  return checkedItems
    .filter((entry) => entry.allowed)
    .map((entry) => entry.item);
}
export type DailyBloomPlanName = "Bloom" | "Bloom Pro" | "Bloom Elite";

export type DailyBloomPlanRules = {
  planName: DailyBloomPlanName;
  monthlyPrice: number;
  learnerLimit: number;
  teacherLimit: number;
  classroomLimit: number;
  reportsEnabled: boolean;
  advancedExportsEnabled: boolean;
  wageflowEnabled: boolean;
  prioritySupport: boolean;
};

export const DAILYBLOOM_PLAN_RULES: Record<
  DailyBloomPlanName,
  DailyBloomPlanRules
> = {
  Bloom: {
    planName: "Bloom",
    monthlyPrice: 299,
    learnerLimit: 30,
    teacherLimit: 5,
    classroomLimit: 3,
    reportsEnabled: false,
    advancedExportsEnabled: false,
    wageflowEnabled: false,
    prioritySupport: false,
  },

  "Bloom Pro": {
    planName: "Bloom Pro",
    monthlyPrice: 399,
    learnerLimit: 60,
    teacherLimit: 15,
    classroomLimit: 8,
    reportsEnabled: true,
    advancedExportsEnabled: true,
    wageflowEnabled: false,
    prioritySupport: true,
  },

  "Bloom Elite": {
    planName: "Bloom Elite",
    monthlyPrice: 499,
    learnerLimit: 9999,
    teacherLimit: 9999,
    classroomLimit: 9999,
    reportsEnabled: true,
    advancedExportsEnabled: true,
    wageflowEnabled: true,
    prioritySupport: true,
  },
};

export function getPlanRules(planName?: string | null): DailyBloomPlanRules {
  if (
    planName === "Bloom" ||
    planName === "Bloom Pro" ||
    planName === "Bloom Elite"
  ) {
    return DAILYBLOOM_PLAN_RULES[planName];
  }

  return DAILYBLOOM_PLAN_RULES.Bloom;
}

export function getPlanPrice(planName?: string | null): number {
  return getPlanRules(planName).monthlyPrice;
}

export function canAddLearner(planName: string | null, currentLearnerCount: number) {
  const rules = getPlanRules(planName);

  return currentLearnerCount < rules.learnerLimit;
}

export function canAddTeacher(planName: string | null, currentTeacherCount: number) {
  const rules = getPlanRules(planName);

  return currentTeacherCount < rules.teacherLimit;
}

export function canAddClassroom(
  planName: string | null,
  currentClassroomCount: number
) {
  const rules = getPlanRules(planName);

  return currentClassroomCount < rules.classroomLimit;
}

export function getUpgradeMessage(
  planName: string | null,
  limitType: "learners" | "teachers" | "classrooms"
) {
  const rules = getPlanRules(planName);

  if (limitType === "learners") {
    return `Your ${rules.planName} plan allows up to ${rules.learnerLimit} learners. Please upgrade to continue adding learners.`;
  }

  if (limitType === "teachers") {
    return `Your ${rules.planName} plan allows up to ${rules.teacherLimit} teachers. Please upgrade to continue adding teachers.`;
  }

  return `Your ${rules.planName} plan allows up to ${rules.classroomLimit} classrooms. Please upgrade to continue adding classrooms.`;
}
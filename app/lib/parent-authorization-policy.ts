export type ParentSchoolRelation =
  | { id?: number | string | null }
  | { id?: number | string | null }[]
  | null;

export type ParentAuthorizedChild = {
  id: number | string;
  school_id?: number | string | null;
  schools?: ParentSchoolRelation;
};

function childSchoolId(child: ParentAuthorizedChild) {
  const school = Array.isArray(child.schools) ? child.schools[0] : child.schools;
  return Number(child.school_id || school?.id || 0);
}

export function parentCanAccessSchool(
  children: readonly ParentAuthorizedChild[],
  schoolId: number
) {
  return Boolean(schoolId) && children.some((child) => childSchoolId(child) === schoolId);
}

export function parentCanAccessLearnerAtSchool(
  children: readonly ParentAuthorizedChild[],
  schoolId: number,
  learnerId: number | string
) {
  if (!schoolId || !String(learnerId || "")) return false;
  return children.some(
    (child) =>
      String(child.id) === String(learnerId) && childSchoolId(child) === schoolId
  );
}

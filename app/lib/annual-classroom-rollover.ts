import { isGradeRClassroom } from "./classroom-programme";

export type RolloverClassroom = {
  id: number;
  classroom_name: string;
  age_groups: string[] | null;
};

export type RolloverLearner = {
  id: string;
  name?: string | null;
  date_of_birth: string | null;
  classroom_name: string | null;
};

export function johannesburgYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

export function ageOnJanuaryFirst(dateOfBirth: string | null, academicYear: number) {
  const match = typeof dateOfBirth === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth) : null;
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  if (!Number.isInteger(birthYear) || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  return academicYear - birthYear - (birthMonth > 1 || (birthMonth === 1 && birthDay > 1) ? 1 : 0);
}

export function classroomAcceptsLearnerAge(ageGroups: string[] | null, age: number) {
  return (ageGroups || []).some((group) => {
    const match = /^(\d+)\s*-\s*(\d+)\s*years?$/i.exec(group.trim());
    return Boolean(match && age >= Number(match[1]) && age <= Number(match[2]));
  });
}

export function planAnnualClassroomRollover(args: {
  academicYear: number;
  learners: RolloverLearner[];
  classrooms: RolloverClassroom[];
  existingClassroomByLearner?: Map<string, number>;
  initialClassroomLoad?: Map<number, number>;
}) {
  const classroomById = new Map(args.classrooms.map((classroom) => [classroom.id, classroom]));
  const loads = new Map(args.classrooms.map((classroom) => [classroom.id, args.initialClassroomLoad?.get(classroom.id) || 0]));
  const archivedGradeRLearnerIds: string[] = [];
  const awaitingManualLearnerIds: string[] = [];
  const allocations: Array<{ learnerId: string; classroomId: number }> = [];

  const learners = [...args.learners].sort(
    (left, right) => String(left.date_of_birth || "9999-12-31").localeCompare(String(right.date_of_birth || "9999-12-31")) || left.id.localeCompare(right.id)
  );

  for (const learner of learners) {
    if (isGradeRClassroom(learner.classroom_name)) {
      archivedGradeRLearnerIds.push(learner.id);
      continue;
    }

    const existingClassroomId = args.existingClassroomByLearner?.get(learner.id);
    if (existingClassroomId && classroomById.has(existingClassroomId)) {
      allocations.push({ learnerId: learner.id, classroomId: existingClassroomId });
      continue;
    }

    const age = ageOnJanuaryFirst(learner.date_of_birth, args.academicYear);
    const matches = age === null ? [] : args.classrooms.filter((classroom) => classroomAcceptsLearnerAge(classroom.age_groups, age));
    if (!matches.length) {
      awaitingManualLearnerIds.push(learner.id);
      continue;
    }

    const classroom = matches.sort((left, right) => (loads.get(left.id) || 0) - (loads.get(right.id) || 0) || left.id - right.id)[0];
    loads.set(classroom.id, (loads.get(classroom.id) || 0) + 1);
    allocations.push({ learnerId: learner.id, classroomId: classroom.id });
  }

  return { allocations, archivedGradeRLearnerIds, awaitingManualLearnerIds };
}

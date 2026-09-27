import "server-only";

import { isGradeRClassroom } from "./classroom-programme";
import { planAnnualClassroomRollover, type RolloverClassroom, type RolloverLearner } from "./annual-classroom-rollover";
import { supabaseAdmin } from "./supabase-admin";

function rows<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function relatedClassroomName(value: unknown) {
  const classroom = Array.isArray(value) ? value[0] : value;
  return classroom && typeof classroom === "object" && "classroom_name" in classroom
    ? String((classroom as { classroom_name?: unknown }).classroom_name || "")
    : "";
}

export async function archiveGradeRLearners(schoolId: number, learnerIds: string[], academicYear: number, appliedAt: string) {
  if (!learnerIds.length) return 0;
  const learnersResult = await supabaseAdmin.from("learners").select("id, name, legal_name").eq("school_id", schoolId).in("id", learnerIds).or("is_deleted.is.null,is_deleted.eq.false");
  if (learnersResult.error) throw learnersResult.error;
  const learners = rows<{ id: string; name: string | null; legal_name: string | null }>(learnersResult.data);
  for (const learner of learners) {
    const updateResult = await supabaseAdmin.from("learners").update({
      is_deleted: true,
      deleted_at: appliedAt,
      deleted_name: learner.name || learner.legal_name || "Grade R learner",
      classroom_id: null,
      class: null,
    }).eq("id", learner.id).eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false");
    if (updateResult.error) throw updateResult.error;
  }
  const previousYearEnd = `${academicYear - 1}-12-31`;
  const feeResult = await supabaseAdmin.from("learner_recurring_fee_assignments").update({ is_active: false, end_date: previousYearEnd, updated_at: appliedAt }).eq("school_id", schoolId).in("learner_id", learnerIds).eq("is_active", true);
  if (feeResult.error) throw feeResult.error;
  return learners.length;
}

export async function runAutomaticSchoolRollover(schoolId: number, academicYear: number) {
  const [campaignResult, existingRolloverResult] = await Promise.all([
    supabaseAdmin.from("school_reenrolment_campaigns").select("id").eq("school_id", schoolId).eq("school_year", academicYear).maybeSingle(),
    supabaseAdmin.from("school_automatic_rollovers").select("id, allocated_count, archived_grade_r_count, awaiting_manual_count").eq("school_id", schoolId).eq("academic_year", academicYear).maybeSingle(),
  ]);
  if (campaignResult.error || existingRolloverResult.error) throw campaignResult.error || existingRolloverResult.error;
  if (campaignResult.data) return { skipped: "reenrolment_campaign" as const };
  if (existingRolloverResult.data) return { skipped: "already_applied" as const, ...existingRolloverResult.data };

  const [classroomsResult, learnersResult, placementsResult] = await Promise.all([
    supabaseAdmin.from("classrooms").select("id, classroom_name, age_groups").eq("school_id", schoolId).order("id"),
    supabaseAdmin.from("learners").select("id, name, legal_name, date_of_birth, classrooms:classroom_id(classroom_name)").eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false"),
    supabaseAdmin.from("learner_placements").select("learner_id, classroom_id").eq("school_id", schoolId).eq("academic_year", academicYear).not("classroom_id", "is", null),
  ]);
  const loadError = classroomsResult.error || learnersResult.error || placementsResult.error;
  if (loadError) throw loadError;

  const classrooms = rows<RolloverClassroom>(classroomsResult.data);
  const learners = rows<{ id: string; name: string | null; legal_name: string | null; date_of_birth: string | null; classrooms: unknown }>(learnersResult.data).map<RolloverLearner>((learner) => ({
    id: learner.id,
    name: learner.name || learner.legal_name,
    date_of_birth: learner.date_of_birth,
    classroom_name: relatedClassroomName(learner.classrooms),
  }));
  const gradeRIds = new Set(learners.filter((learner) => isGradeRClassroom(learner.classroom_name)).map((learner) => learner.id));
  const placements = rows<{ learner_id: string; classroom_id: number }>(placementsResult.data).filter((placement) => !gradeRIds.has(placement.learner_id));
  const existingClassroomByLearner = new Map(placements.map((placement) => [placement.learner_id, placement.classroom_id]));
  const initialClassroomLoad = new Map<number, number>();
  for (const placement of placements) initialClassroomLoad.set(placement.classroom_id, (initialClassroomLoad.get(placement.classroom_id) || 0) + 1);
  const plan = planAnnualClassroomRollover({ academicYear, learners, classrooms, existingClassroomByLearner, initialClassroomLoad });
  const appliedAt = new Date().toISOString();
  const allLearnerIds = learners.map((learner) => learner.id);
  if (allLearnerIds.length) {
    const historyResult = await supabaseAdmin.from("learner_placements").update({ placement_status: "completed", end_date: `${academicYear - 1}-12-31`, updated_at: appliedAt }).eq("school_id", schoolId).lt("academic_year", academicYear).in("learner_id", allLearnerIds).neq("placement_status", "completed");
    if (historyResult.error) throw historyResult.error;
  }
  const archivedCount = await archiveGradeRLearners(schoolId, plan.archivedGradeRLearnerIds, academicYear, appliedAt);
  const classroomNames = new Map(classrooms.map((classroom) => [classroom.id, classroom.classroom_name]));
  for (const allocation of plan.allocations) {
    const placementResult = await supabaseAdmin.from("learner_placements").upsert({ learner_id: allocation.learnerId, school_id: schoolId, academic_year: academicYear, classroom_id: allocation.classroomId, placement_status: "current", start_date: `${academicYear}-01-01`, end_date: null, updated_at: appliedAt }, { onConflict: "learner_id,academic_year" });
    if (placementResult.error) throw placementResult.error;
    const learnerUpdate = await supabaseAdmin.from("learners").update({ classroom_id: allocation.classroomId, class: classroomNames.get(allocation.classroomId) || null }).eq("id", allocation.learnerId).eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false");
    if (learnerUpdate.error) throw learnerUpdate.error;
  }
  for (const learnerId of plan.awaitingManualLearnerIds) {
    const placementResult = await supabaseAdmin.from("learner_placements").upsert({ learner_id: learnerId, school_id: schoolId, academic_year: academicYear, classroom_id: null, placement_status: "pending", start_date: `${academicYear}-01-01`, end_date: null, updated_at: appliedAt }, { onConflict: "learner_id,academic_year" });
    if (placementResult.error) throw placementResult.error;
    const learnerUpdate = await supabaseAdmin.from("learners").update({ classroom_id: null, class: null }).eq("id", learnerId).eq("school_id", schoolId).or("is_deleted.is.null,is_deleted.eq.false");
    if (learnerUpdate.error) throw learnerUpdate.error;
  }
  const summary = { school_id: schoolId, academic_year: academicYear, allocated_count: plan.allocations.length, archived_grade_r_count: archivedCount, awaiting_manual_count: plan.awaitingManualLearnerIds.length, applied_at: appliedAt };
  const markerResult = await supabaseAdmin.from("school_automatic_rollovers").insert(summary);
  if (markerResult.error) {
    if (markerResult.error.code === "23505") return { skipped: "already_applied" as const };
    throw markerResult.error;
  }
  return summary;
}

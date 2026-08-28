import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/app/lib/permissions";
import { isGradeRClassroom } from "@/app/lib/classroom-programme";
import { learnerDocumentNamesMatch, STANDARD_LEARNER_DOCUMENTS } from "@/app/lib/learner-documents";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ReenrolmentAction = "create_campaign" | "send_notifications" | "approve_reenrolment" | "decline_reenrolment" | "assign_classroom" | "auto_allocate_reenrolments" | "mark_school_leaver" | "mark_no_response" | "apply_classroom_rollover";

function asText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asSchoolId(value: string | null) {
  const schoolId = Number(value);
  return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

function rows<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type ReenrolmentRecord = {
  id: string;
  learner_id: string;
  reenrolment_reference: string;
  parent_portal_phone: string | null;
  registration_fee_amount: number | null;
  registration_payment_status: string;
  status: string;
  notification_sent_at: string | null;
  notification_error: string | null;
  submitted_data: unknown;
  renewal_snapshot: unknown;
  current_classroom_id: number | null;
  next_classroom_id: number | null;
  classroom_applied_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

type LearnerLookup = {
  id: string;
  name: string | null;
  legal_name: string | null;
  classrooms: { classroom_name: string | null } | Array<{ classroom_name: string | null }> | null;
};

type LearnerParentPhone = {
  id: string;
  parent_phone: string | null;
  classroom_id: number | null;
  classrooms: { classroom_name?: string | null } | Array<{ classroom_name?: string | null }> | null;
};

function relatedClassroomName(value: unknown) {
  const classroom = Array.isArray(value) ? value[0] : value;
  return classroom && typeof classroom === "object" && "classroom_name" in classroom
    ? String((classroom as { classroom_name?: unknown }).classroom_name || "")
    : "";
}

function ageOnNewYear(dateOfBirth: string | null, schoolYear: number) {
  const match = typeof dateOfBirth === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth) : null;
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  if (!Number.isInteger(birthYear) || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  return schoolYear - birthYear - (birthMonth > 1 || (birthMonth === 1 && birthDay > 1) ? 1 : 0);
}

function classroomAcceptsAge(ageGroups: unknown, age: number) {
  return rows<string>(Array.isArray(ageGroups) ? ageGroups : []).some((group) => {
    const match = /^(\d+)\s*-\s*(\d+)\s*years?$/i.exec(group.trim());
    return Boolean(match && age >= Number(match[1]) && age <= Number(match[2]));
  });
}

async function sendParentPush(args: { externalIds: string[]; heading: string; message: string; url: string }) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const externalIds = [...new Set(args.externalIds.filter(Boolean))];
  if (!appId || !restApiKey || externalIds.length === 0) return { status: "skipped" as const };

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${restApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: externalIds },
      headings: { en: args.heading },
      contents: { en: args.message },
      url: args.url,
    }),
  });
  if (!response.ok) throw new Error(`Parent push notification failed (${response.status}).`);
  return { status: "sent" as const };
}

export async function GET(request: Request) {
  const schoolId = asSchoolId(new URL(request.url).searchParams.get("school_id"));
  if (!schoolId) return NextResponse.json({ error: "A school is required." }, { status: 400 });

  const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!access.ok) return access.response;

  const [schoolResult, feeResult, campaignsResult, formsResult, classroomsResult, approvedEnrolmentsResult] = await Promise.all([
    supabaseAdmin.from("schools").select("id, school_name").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
    supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, source_form_id, form_snapshot, registration_fee_type_id, registration_fee_amount, response_deadline, status, rollover_applied_at, created_at").eq("school_id", schoolId).order("school_year", { ascending: false }),
    supabaseAdmin.from("school_enrolment_forms").select("id, form_name, form_type, instructions").eq("school_id", schoolId).eq("form_type", "general").eq("is_active", true).order("form_name"),
    supabaseAdmin.from("classrooms").select("id, classroom_name, age_groups").eq("school_id", schoolId).order("classroom_name"),
    supabaseAdmin.from("school_enrolment_enquiries").select("id,learner_id,enquiry_reference,parent_name,academic_year,submitted_data").eq("school_id",schoolId).eq("status","approved").not("learner_id","is",null).order("academic_year").order("created_at"),
  ]);
  const failure = schoolResult.error || feeResult.error || campaignsResult.error || formsResult.error || classroomsResult.error || approvedEnrolmentsResult.error;
  if (failure) return NextResponse.json({ error: failure.message }, { status: 500 });

  const campaign = rows(campaignsResult.data).find((candidate) => candidate.status === "open") || null;
  let reenrolments: Array<Record<string, unknown>> = [];
  if (campaign?.id) {
    const recordsResult = await supabaseAdmin
      .from("learner_reenrolments")
      .select("id, learner_id, reenrolment_reference, parent_portal_phone, registration_fee_amount, registration_payment_status, status, notification_sent_at, notification_error, submitted_data, renewal_snapshot, current_classroom_id, next_classroom_id, classroom_applied_at, decline_reason, created_at")
      .eq("campaign_id", campaign.id)
      .order("reenrolment_reference");
    if (recordsResult.error) return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });

    const records = rows<ReenrolmentRecord>(recordsResult.data);
    const learnerIds = records.map((record) => String(record.learner_id)).filter(Boolean);
    let learnerRows: LearnerLookup[] = [];
    if (learnerIds.length) {
      const learnerResult = await supabaseAdmin
        .from("learners")
        .select("id, name, legal_name, classroom_id, classrooms:classroom_id(classroom_name)")
        .in("id", learnerIds);
      if (learnerResult.error) return NextResponse.json({ error: learnerResult.error.message }, { status: 500 });
      learnerRows = rows<LearnerLookup>(learnerResult.data);
    }
    const learnersById = new Map(learnerRows.map((learner) => [String(learner.id), learner]));
    reenrolments = records.map((record) => {
      const learner = learnersById.get(String(record.learner_id));
      const classroom = Array.isArray(learner?.classrooms) ? learner.classrooms[0] : learner?.classrooms;
      const submittedData = record.submitted_data && typeof record.submitted_data === "object"
        ? record.submitted_data as { parent_notes?: unknown; learner_details?: unknown; guardian_details?: unknown; medical_details?: unknown; uploaded_documents?: unknown; acknowledged_document_ids?: unknown; acknowledged_requirement_ids?: unknown }
        : {};
      const safeRecord = Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== "submitted_data"),
      );
      return {
        ...safeRecord,
        school_year: campaign.school_year,
        learner_name: learner?.name || learner?.legal_name || "Learner",
        classroom_name: classroom?.classroom_name || "Unassigned",
        parent_notes: typeof submittedData.parent_notes === "string" ? submittedData.parent_notes : "",
        learner_details: submittedData.learner_details || null,
        guardian_details: submittedData.guardian_details || null,
        medical_details: submittedData.medical_details || null,
        uploaded_documents: submittedData.uploaded_documents || {},
        acknowledged_document_ids: Array.isArray(submittedData.acknowledged_document_ids) ? submittedData.acknowledged_document_ids : [],
        acknowledged_requirement_ids: Array.isArray(submittedData.acknowledged_requirement_ids) ? submittedData.acknowledged_requirement_ids : [],
      };
    });
  }

  const approvedRows=rows<{id:string;learner_id:string;enquiry_reference:string;parent_name:string;academic_year:number;submitted_data:unknown}>(approvedEnrolmentsResult.data);
  const approvedLearnerIds=approvedRows.map((row)=>row.learner_id);
  const [placementsResult,approvedLearnersResult]=await Promise.all([
    approvedLearnerIds.length?supabaseAdmin.from("learner_placements").select("learner_id,academic_year,classroom_id,classrooms(classroom_name)").eq("school_id",schoolId).in("learner_id",approvedLearnerIds):Promise.resolve({data:[],error:null}),
    approvedLearnerIds.length?supabaseAdmin.from("learners").select("id,name,legal_name,guardian_name,class,classroom_id").eq("school_id",schoolId).in("id",approvedLearnerIds):Promise.resolve({data:[],error:null}),
  ]);
  if(placementsResult.error||approvedLearnersResult.error)return NextResponse.json({error:placementsResult.error?.message||approvedLearnersResult.error?.message},{status:500});
  const placements=new Map(rows<{learner_id:string;academic_year:number;classroom_id:number|null;classrooms:unknown}>(placementsResult.data).map((row)=>[`${row.learner_id}:${row.academic_year}`,row]));
  const approvedLearners=new Map(rows<{id:string;name:string|null;legal_name:string|null;guardian_name:string|null;class:string|null;classroom_id:number|null}>(approvedLearnersResult.data).map((row)=>[row.id,row]));
  return NextResponse.json({
    school: schoolResult.data,
    registration_fee: feeResult.data,
    campaign,
    campaigns: rows(campaignsResult.data),
    enrolment_forms: rows(formsResult.data),
    classrooms: rows(classroomsResult.data),
    reenrolments,
    approved_enrolments: approvedRows.map((row)=>({...row,learner:approvedLearners.get(row.learner_id)||null,placement:placements.get(`${row.learner_id}:${row.academic_year}`)||null})),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const schoolId = typeof body.school_id === "number" ? body.school_id : Number(body.school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return NextResponse.json({ error: "A school is required." }, { status: 400 });
  const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!access.ok) return access.response;

  const action = body.action as ReenrolmentAction;
  if (action === "create_campaign") {
    const schoolYear = Number(body.school_year);
    const responseDeadline = asText(body.response_deadline, 10) || null;
    const applyRegistrationFee = body.apply_registration_fee === true;
    const sourceFormId = asText(body.source_form_id, 64) || null;
    if (!Number.isInteger(schoolYear) || schoolYear < 2020 || schoolYear > 2100) {
      return NextResponse.json({ error: "Choose a valid school year." }, { status: 400 });
    }
    const [openCampaignResult, feeResult, formResult] = await Promise.all([
      supabaseAdmin.from("school_reenrolment_campaigns").select("id").eq("school_id", schoolId).eq("status", "open").maybeSingle(),
      supabaseAdmin.from("school_fee_types").select("id, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
      sourceFormId
        ? supabaseAdmin.from("school_enrolment_forms").select("id, form_name, form_type, instructions").eq("id", sourceFormId).eq("school_id", schoolId).eq("is_active", true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (openCampaignResult.error || feeResult.error || formResult.error) return NextResponse.json({ error: openCampaignResult.error?.message || feeResult.error?.message || formResult.error?.message }, { status: 500 });
    if (sourceFormId && !formResult.data) return NextResponse.json({ error: "Choose an active enrolment form for this school." }, { status: 400 });
    if (openCampaignResult.data) return NextResponse.json({ error: "Close the current re-enrolment campaign before creating another one." }, { status: 409 });
    if (applyRegistrationFee && !feeResult.data) return NextResponse.json({ error: "Set a Registration Fee in School Fee Setup first, or continue without one." }, { status: 400 });

    const rpcResult = await supabaseAdmin.rpc("create_school_reenrolment_campaign", {
      p_school_id: schoolId,
      p_school_year: schoolYear,
      p_source_form_id: sourceFormId,
      p_registration_fee_type_id: applyRegistrationFee ? feeResult.data?.id || null : null,
      p_registration_fee_amount: applyRegistrationFee ? Number(feeResult.data?.amount || 0) : 0,
      p_response_deadline: responseDeadline,
      p_created_by: access.staff.userId,
    });
    if (rpcResult.error) {
      const isDuplicate = rpcResult.error.code === "23505";
      return NextResponse.json({ error: isDuplicate ? "A re-enrolment campaign already exists for this school year." : rpcResult.error.message }, { status: isDuplicate ? 409 : 500 });
    }
    const campaignResult = (rpcResult.data as Array<{ campaign_id: string; learner_count: number }> | null)?.[0] || null;
    if (campaignResult?.campaign_id) {
      const campaignId = campaignResult.campaign_id;
      const formSnapshot = formResult.data ? { ...formResult.data, captured_at: new Date().toISOString() } : {};
      const campaignUpdate = await supabaseAdmin.from("school_reenrolment_campaigns").update({ form_snapshot: formSnapshot }).eq("id", campaignId);
      if (campaignUpdate.error) return NextResponse.json({ error: campaignUpdate.error.message }, { status: 500 });

      const [generatedResult, learnersResult, documentsResult, configuredDocumentsResult, requirementsResult, checklistResult] = await Promise.all([
        supabaseAdmin.from("learner_reenrolments").select("id, learner_id").eq("campaign_id", campaignId),
        supabaseAdmin.from("learners").select("id, name, legal_name, date_of_birth, gender, birth_certificate_number, sa_id_number, passport_number, guardian_name, guardian_relationship, guardian_id_number, parent_phone, parent_email, home_address, allergies, medical_conditions, medical_instructions, has_medical_aid, medical_aid_name, medical_aid_number, medical_aid_main_member, family_doctor_name, family_doctor_phone, classroom_id, classrooms:classroom_id(classroom_name)").eq("school_id", schoolId),
        supabaseAdmin.from("learner_documents").select("id, learner_id, document_type, file_name, uploaded_at").eq("school_id", schoolId),
        supabaseAdmin.from("school_enrolment_document_requirements").select("id, title, instructions, is_required").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
        supabaseAdmin.from("classroom_requirement_items").select("id, classroom_id, item_name, quantity, category").eq("school_id", schoolId).eq("is_active", true),
        supabaseAdmin.from("learner_stationery_checklist").select("learner_id, stationery_item_id, received, received_quantity, required_quantity").eq("school_id", schoolId),
      ]);
      const snapshotFailure = generatedResult.error || learnersResult.error || documentsResult.error || configuredDocumentsResult.error || requirementsResult.error || checklistResult.error;
      if (snapshotFailure) return NextResponse.json({ error: snapshotFailure.message }, { status: 500 });
      const learners = new Map(rows<Record<string, unknown>>(learnersResult.data).map((learner) => [String(learner.id), learner]));
      const documents = rows<Record<string, unknown>>(documentsResult.data);
      const requirements = rows<Record<string, unknown>>(requirementsResult.data);
      const checklist = rows<Record<string, unknown>>(checklistResult.data);
      const configuredDocuments = rows<Record<string, unknown>>(configuredDocumentsResult.data);
      const requiredDocuments = configuredDocuments.some((item) => item.is_required === true)
        ? configuredDocuments.filter((item) => item.is_required === true)
        : STANDARD_LEARNER_DOCUMENTS.map((item, index) => ({ id: `standard-${index + 1}`, title: item.name, instructions: null, is_required: true }));
      let eligibleLearnerCount = 0;
      for (const generated of rows<{ id: string; learner_id: string }>(generatedResult.data)) {
        const learner = learners.get(String(generated.learner_id));
        if (!learner) continue;
        if (isGradeRClassroom(relatedClassroomName(learner.classrooms))) {
          const schoolLeaverUpdate = await supabaseAdmin.from("learner_reenrolments").update({ status: "school_leaver", current_classroom_id: learner.classroom_id || null, renewal_snapshot: { school_leaver_reason: "grade_r_completed", captured_at: new Date().toISOString() }, reviewed_by: access.staff.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", generated.id).eq("campaign_id", campaignId);
          if (schoolLeaverUpdate.error) return NextResponse.json({ error: schoolLeaverUpdate.error.message }, { status: 500 });
          continue;
        }
        eligibleLearnerCount += 1;
        const learnerDocuments = documents.filter((doc) => String(doc.learner_id) === String(generated.learner_id));
        const missingDocuments = requiredDocuments.filter((item) => !learnerDocuments.some((document) => learnerDocumentNamesMatch(String(document.document_type), String(item.title)))).map((item) => ({ id: String(item.id), name: String(item.title), instructions: item.instructions || null }));
        const classRequirements = requirements.filter((item) => Number(item.classroom_id) === Number(learner.classroom_id));
        const learnerChecklist = checklist.filter((item) => String(item.learner_id) === String(generated.learner_id));
        const missingRequirements = classRequirements.filter((item) => {
          const received = learnerChecklist.find((entry) => Number(entry.stationery_item_id) === Number(item.id));
          return !received || received.received !== true || Number(received.received_quantity || 0) < Number(received.required_quantity || item.quantity || 1);
        }).map((item) => ({ id: String(item.id), name: item.item_name, quantity: item.quantity, category: item.category }));
        const renewalSnapshot = {
          learner_details: { name: learner.name, legal_name: learner.legal_name, date_of_birth: learner.date_of_birth, gender: learner.gender, birth_certificate_number: learner.birth_certificate_number, sa_id_number: learner.sa_id_number, passport_number: learner.passport_number, home_address: learner.home_address },
          guardian_details: { guardian_name: learner.guardian_name, guardian_relationship: learner.guardian_relationship, guardian_id_number: learner.guardian_id_number, parent_phone: learner.parent_phone, parent_email: learner.parent_email, parent_portal_phone: learner.parent_phone },
          medical_details: { allergies: learner.allergies, medical_conditions: learner.medical_conditions, medical_instructions: learner.medical_instructions, medical_aid_name: learner.medical_aid_name, medical_aid_number: learner.medical_aid_number, medical_aid_main_member: learner.medical_aid_main_member, preferred_doctor_name: learner.family_doctor_name, preferred_doctor_phone: learner.family_doctor_phone },
          existing_documents: learnerDocuments.map((item) => ({ id: item.id, name: item.document_type, file_name: item.file_name, uploaded_at: item.uploaded_at })),
          required_documents: requiredDocuments.map((item) => ({ id: String(item.id), name: String(item.title), instructions: item.instructions || null })),
          missing_documents: missingDocuments,
          missing_requirements: missingRequirements,
          captured_at: new Date().toISOString(),
        };
        const update = await supabaseAdmin.from("learner_reenrolments").update({ renewal_snapshot: renewalSnapshot, current_classroom_id: learner.classroom_id || null }).eq("id", generated.id);
        if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
      }
      campaignResult.learner_count = eligibleLearnerCount;
    }
    await writeSecurityAudit(access.staff, "reenrolment_campaign_created", {
      school_year: schoolYear,
      apply_registration_fee: applyRegistrationFee,
      learner_count: campaignResult?.learner_count || 0,
    });
    return NextResponse.json({ campaign: campaignResult });
  }

  if (action === "send_notifications") {
    const campaignId = asText(body.campaign_id, 64);
    if (!campaignId) return NextResponse.json({ error: "A re-enrolment campaign is required." }, { status: 400 });
    const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, status, schools:school_id(school_name)").eq("id", campaignId).eq("school_id", schoolId).maybeSingle();
    if (campaignResult.error) return NextResponse.json({ error: campaignResult.error.message }, { status: 500 });
    if (!campaignResult.data || campaignResult.data.status !== "open") return NextResponse.json({ error: "This re-enrolment campaign is not open." }, { status: 400 });
    const recordsResult = await supabaseAdmin.from("learner_reenrolments").select("id, learner_id").eq("campaign_id", campaignId).eq("status", "awaiting_parent");
    if (recordsResult.error) return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });
    const records = rows<Pick<ReenrolmentRecord, "id" | "learner_id">>(recordsResult.data);
    const learnerIds = records.map((record) => String(record.learner_id));
    let learnerRows: LearnerParentPhone[] = [];
    if (learnerIds.length) {
      const learnersResult = await supabaseAdmin
        .from("learners")
        .select("id, parent_phone, classroom_id, classrooms:classroom_id(classroom_name)")
        .eq("school_id", schoolId)
        .in("id", learnerIds);
      if (learnersResult.error) return NextResponse.json({ error: learnersResult.error.message }, { status: 500 });
      learnerRows = rows<LearnerParentPhone>(learnersResult.data);
    }
    const gradeRLearnerIds = new Set(learnerRows.filter((learner) => isGradeRClassroom(relatedClassroomName(learner.classrooms))).map((learner) => String(learner.id)));
    const gradeRRecordIds = records.filter((record) => gradeRLearnerIds.has(String(record.learner_id))).map((record) => record.id);
    if (gradeRRecordIds.length) {
      const schoolLeaverUpdate = await supabaseAdmin.from("learner_reenrolments").update({ status: "school_leaver", reviewed_by: access.staff.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(), notification_error: null }).in("id", gradeRRecordIds).eq("campaign_id", campaignId);
      if (schoolLeaverUpdate.error) return NextResponse.json({ error: schoolLeaverUpdate.error.message }, { status: 500 });
    }
    const phoneByLearner = new Map(learnerRows.map((learner) => [String(learner.id), learner.parent_phone]));
    const recordsWithPhones = records.filter((record) => !gradeRLearnerIds.has(String(record.learner_id)) && Boolean(phoneByLearner.get(String(record.learner_id))));
    const phones = recordsWithPhones.map((record) => String(phoneByLearner.get(String(record.learner_id))));
    const joinedSchool = Array.isArray(campaignResult.data.schools)
      ? campaignResult.data.schools[0]
      : campaignResult.data.schools;
    const schoolName = (joinedSchool as { school_name?: string | null } | null)?.school_name || "Your school";
    try {
      const push = await sendParentPush({ externalIds: phones, heading: "Re-enrolment is open", message: `${schoolName} has opened re-enrolment for ${campaignResult.data.school_year}. Please review it in your Parent Portal.`, url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za"}/parent/re-enrolment` });
      if (push.status === "sent" && recordsWithPhones.length > 0) {
        const updateResult = await supabaseAdmin
          .from("learner_reenrolments")
          .update({ notification_sent_at: new Date().toISOString(), notification_error: null })
          .in("id", recordsWithPhones.map((record) => record.id));
        if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      }
      await writeSecurityAudit(access.staff, "reenrolment_notifications_sent", {
        campaign_id: campaignId,
        recipients: phones.length,
        grade_r_excluded: gradeRRecordIds.length,
        delivery: push.status,
      });
      return NextResponse.json({ notified: phones.length, grade_r_excluded: gradeRRecordIds.length, delivery: push.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send notifications.";
      if (recordsWithPhones.length > 0) {
        await supabaseAdmin.from("learner_reenrolments").update({ notification_error: message }).in("id", recordsWithPhones.map((record) => record.id));
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "approve_reenrolment" || action === "decline_reenrolment") {
    const reenrolmentId = asText(body.reenrolment_id, 64);
    if (!reenrolmentId) return NextResponse.json({ error: "Choose a re-enrolment record first." }, { status: 400 });

    const recordResult = await supabaseAdmin
      .from("learner_reenrolments")
      .select("id, campaign_id, learner_id, status, parent_portal_phone, registration_fee_amount, submitted_data, renewal_snapshot")
      .eq("id", reenrolmentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (recordResult.error) return NextResponse.json({ error: recordResult.error.message }, { status: 500 });
    if (!recordResult.data || recordResult.data.status !== "submitted") {
      return NextResponse.json({ error: "Only a submitted re-enrolment can be reviewed." }, { status: 409 });
    }

    const reviewedAt = new Date().toISOString();
    if (action === "approve_reenrolment") {
      const learnerResult = await supabaseAdmin
        .from("learners")
        .select("id, parent_phone")
        .eq("id", recordResult.data.learner_id)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (learnerResult.error) return NextResponse.json({ error: learnerResult.error.message }, { status: 500 });
      if (!learnerResult.data) return NextResponse.json({ error: "The linked learner could not be found." }, { status: 404 });

      if (recordResult.data.parent_portal_phone && recordResult.data.parent_portal_phone !== learnerResult.data.parent_phone) {
        const phoneResult = await supabaseAdmin.rpc("change_learner_parent_portal_phone", {
          p_school_id: schoolId,
          p_learner_id: recordResult.data.learner_id,
          p_new_phone: recordResult.data.parent_portal_phone,
        });
        if (phoneResult.error) return NextResponse.json({ error: phoneResult.error.message }, { status: 400 });
      }

      const submitted = asObject(recordResult.data.submitted_data);
      const learnerDetails = asObject(submitted.learner_details);
      const guardianDetails = asObject(submitted.guardian_details);
      const medicalDetails = asObject(submitted.medical_details);
      const submittedDocuments = asObject(submitted.uploaded_documents);
      if (Object.keys(learnerDetails).length || Object.keys(guardianDetails).length || Object.keys(medicalDetails).length) {
        const learnerUpdate = await supabaseAdmin.from("learners").update({
          name: asText(learnerDetails.name, 120),
          legal_name: asText(learnerDetails.legal_name, 180),
          date_of_birth: asText(learnerDetails.date_of_birth, 10),
          gender: asText(learnerDetails.gender, 40) || null,
          birth_certificate_number: asText(learnerDetails.birth_certificate_number, 80) || null,
          sa_id_number: asText(learnerDetails.sa_id_number, 30) || null,
          passport_number: asText(learnerDetails.passport_number, 60) || null,
          home_address: asText(learnerDetails.home_address, 500) || null,
          guardian_name: asText(guardianDetails.guardian_name, 180),
          guardian_relationship: asText(guardianDetails.guardian_relationship, 80) || null,
          guardian_id_number: asText(guardianDetails.guardian_id_number, 30) || null,
          parent_email: asText(guardianDetails.parent_email, 180) || null,
          allergies: asText(medicalDetails.allergies, 500) || null,
          medical_conditions: asText(medicalDetails.medical_conditions, 500) || null,
          medical_instructions: [
            asText(medicalDetails.medical_instructions, 1000),
            asText(medicalDetails.immunisation_status, 80) && `Immunisation: ${asText(medicalDetails.immunisation_status, 80)}`,
            asText(medicalDetails.immunisation_notes, 1000),
          ].filter(Boolean).join("\n") || null,
          has_medical_aid: Boolean(asText(medicalDetails.medical_aid_name, 180) || asText(medicalDetails.medical_aid_number, 120)),
          medical_aid_name: asText(medicalDetails.medical_aid_name, 180) || null,
          medical_aid_number: asText(medicalDetails.medical_aid_number, 120) || null,
          medical_aid_main_member: asText(medicalDetails.medical_aid_main_member, 180) || null,
          family_doctor_name: asText(medicalDetails.preferred_doctor_name, 180) || null,
          family_doctor_phone: asText(medicalDetails.preferred_doctor_phone, 40) || null,
        }).eq("id", recordResult.data.learner_id).eq("school_id", schoolId);
        if (learnerUpdate.error) return NextResponse.json({ error: learnerUpdate.error.message }, { status: 500 });
      }

      const existingDocumentsResult = await supabaseAdmin.from("learner_documents").select("id, document_type, file_path").eq("school_id", schoolId).eq("learner_id", recordResult.data.learner_id);
      if (existingDocumentsResult.error) return NextResponse.json({ error: existingDocumentsResult.error.message }, { status: 500 });
      for (const [documentType, rawUpload] of Object.entries(submittedDocuments)) {
        const upload = asObject(rawUpload);
        const path = asText(upload.path, 700);
        if (!path.startsWith(`${schoolId}/reenrolment-submissions/${reenrolmentId}/`) || path.includes("..")) continue;
        const existing = rows<{ id: number; document_type: string; file_path: string | null }>(existingDocumentsResult.data).find((item) => learnerDocumentNamesMatch(item.document_type, documentType));
        const values = {
          school_id: schoolId,
          learner_id: recordResult.data.learner_id,
          document_type: documentType,
          document_name: documentType,
          file_name: asText(upload.name, 180) || documentType,
          file_path: path,
          file_url: null,
          uploaded_at: reviewedAt,
          updated_at: reviewedAt,
          uploaded_by: access.staff.userId,
          uploaded_by_name: access.staff.profile.full_name || access.staff.profile.email,
        };
        const documentResult = existing
          ? await supabaseAdmin.from("learner_documents").update(values).eq("id", existing.id).eq("school_id", schoolId)
          : await supabaseAdmin.from("learner_documents").insert(values);
        if (documentResult.error) return NextResponse.json({ error: documentResult.error.message }, { status: 500 });
      }

      const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("school_year").eq("id", recordResult.data.campaign_id).eq("school_id", schoolId).maybeSingle();
      if (campaignResult.error || !campaignResult.data) return NextResponse.json({ error: campaignResult.error?.message || "The re-enrolment campaign could not be found." }, { status: 500 });
      const placementResult = await supabaseAdmin.from("learner_placements").upsert({
        learner_id: recordResult.data.learner_id,
        school_id: schoolId,
        academic_year: Number(campaignResult.data.school_year),
        classroom_id: null,
        placement_status: "pending",
        updated_at: reviewedAt,
      }, { onConflict: "learner_id,academic_year" });
      if (placementResult.error) return NextResponse.json({ error: placementResult.error.message }, { status: 500 });

      const updateResult = await supabaseAdmin
        .from("learner_reenrolments")
        .update({ status: "approved", next_classroom_id: null, reviewed_by: access.staff.userId, reviewed_at: reviewedAt, decline_reason: null, updated_at: reviewedAt })
        .eq("id", reenrolmentId)
        .eq("status", "submitted");
      if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      await writeSecurityAudit(access.staff, "reenrolment_approved", {
        reenrolment_id: reenrolmentId,
        learner_id: recordResult.data.learner_id,
        registration_fee_amount: recordResult.data.registration_fee_amount,
      });
      return NextResponse.json({ success: true, message: `Re-enrolment approved. The learner will enter Awaiting Classroom Allocation on 1 January ${campaignResult.data.school_year}.` });
    }

    const declineReason = asText(body.decline_reason, 800);
    if (!declineReason) return NextResponse.json({ error: "Add a reason so the parent knows what needs attention." }, { status: 400 });
    const updateResult = await supabaseAdmin
      .from("learner_reenrolments")
      .update({ status: "declined", reviewed_by: access.staff.userId, reviewed_at: reviewedAt, decline_reason: declineReason, updated_at: reviewedAt })
      .eq("id", reenrolmentId)
      .eq("status", "submitted");
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    await writeSecurityAudit(access.staff, "reenrolment_declined", { reenrolment_id: reenrolmentId, learner_id: recordResult.data.learner_id });
    return NextResponse.json({ success: true, message: "Re-enrolment declined with a reason for the parent." });
  }

  if (action === "assign_classroom") {
    const reenrolmentId = asText(body.reenrolment_id, 64);
    const nextClassroomId = Number(body.next_classroom_id);
    if (!reenrolmentId || !Number.isInteger(nextClassroomId) || nextClassroomId <= 0) return NextResponse.json({ error: "Choose an approved learner and next-year classroom." }, { status: 400 });
    const classroomResult = await supabaseAdmin.from("classrooms").select("id").eq("id", nextClassroomId).eq("school_id", schoolId).maybeSingle();
    if (classroomResult.error) return NextResponse.json({ error: classroomResult.error.message }, { status: 500 });
    if (!classroomResult.data) return NextResponse.json({ error: "The selected classroom does not belong to this school." }, { status: 400 });
    const updatedAt = new Date().toISOString();
    const updateResult = await supabaseAdmin.from("learner_reenrolments").update({ next_classroom_id: nextClassroomId, updated_at: updatedAt }).eq("id", reenrolmentId).eq("school_id", schoolId).eq("status", "approved").is("classroom_applied_at", null).select("id").maybeSingle();
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    if (!updateResult.data) return NextResponse.json({ error: "Only an approved learner awaiting rollover can be allocated." }, { status: 409 });
    const placementSource = await supabaseAdmin.from("learner_reenrolments").select("learner_id, school_reenrolment_campaigns:campaign_id(school_year)").eq("id", reenrolmentId).eq("school_id", schoolId).maybeSingle();
    if (placementSource.error || !placementSource.data) return NextResponse.json({ error: placementSource.error?.message || "The learner placement could not be found." }, { status: 500 });
    const relatedCampaign = Array.isArray(placementSource.data.school_reenrolment_campaigns) ? placementSource.data.school_reenrolment_campaigns[0] : placementSource.data.school_reenrolment_campaigns;
    const placementYear = Number((relatedCampaign as { school_year?: unknown } | null)?.school_year);
    const placementUpdate = await supabaseAdmin.from("learner_placements").upsert({ learner_id: placementSource.data.learner_id, school_id: schoolId, academic_year: placementYear, classroom_id: nextClassroomId, placement_status: "future", updated_at: updatedAt }, { onConflict: "learner_id,academic_year" });
    if (placementUpdate.error) return NextResponse.json({ error: placementUpdate.error.message }, { status: 500 });
    await writeSecurityAudit(access.staff, "reenrolment_classroom_assigned", { reenrolment_id: reenrolmentId, next_classroom_id: nextClassroomId });
    return NextResponse.json({ success: true, message: "Next-year classroom allocated. The learner remains in the current classroom until rollover." });
  }

  if (action === "auto_allocate_reenrolments") {
    const campaignId = asText(body.campaign_id, 64);
    if (!campaignId) return NextResponse.json({ error: "A re-enrolment campaign is required." }, { status: 400 });
    const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, status").eq("id", campaignId).eq("school_id", schoolId).maybeSingle();
    if (campaignResult.error || !campaignResult.data) return NextResponse.json({ error: campaignResult.error?.message || "Re-enrolment campaign not found." }, { status: 404 });
    const targetStart = new Date(`${campaignResult.data.school_year}-01-01T00:00:00+02:00`);
    if (new Date() < targetStart) return NextResponse.json({ error: `Automatic classroom allocation becomes available on 1 January ${campaignResult.data.school_year}.` }, { status: 400 });

    const [recordsResult, classroomsResult, placementsResult] = await Promise.all([
      supabaseAdmin.from("learner_reenrolments").select("id, learner_id").eq("campaign_id", campaignId).eq("school_id", schoolId).eq("status", "approved").is("next_classroom_id", null).is("classroom_applied_at", null),
      supabaseAdmin.from("classrooms").select("id, classroom_name, age_groups").eq("school_id", schoolId).order("id"),
      supabaseAdmin.from("learner_placements").select("classroom_id").eq("school_id", schoolId).eq("academic_year", campaignResult.data.school_year).not("classroom_id", "is", null),
    ]);
    const initialError = recordsResult.error || classroomsResult.error || placementsResult.error;
    if (initialError) return NextResponse.json({ error: initialError.message }, { status: 500 });
    const records = rows<{ id: string; learner_id: string }>(recordsResult.data);
    if (!records.length) return NextResponse.json({ allocated: 0, awaiting_manual: 0, message: "There are no approved re-enrolments awaiting allocation." });
    const learnerResult = await supabaseAdmin.from("learners").select("id, date_of_birth").eq("school_id", schoolId).in("id", records.map((record) => record.learner_id));
    if (learnerResult.error) return NextResponse.json({ error: learnerResult.error.message }, { status: 500 });

    const classrooms = rows<{ id: number; classroom_name: string; age_groups: string[] | null }>(classroomsResult.data);
    const learnersById = new Map(rows<{ id: string; date_of_birth: string | null }>(learnerResult.data).map((learner) => [learner.id, learner]));
    const classroomLoad = new Map(classrooms.map((classroom) => [classroom.id, 0]));
    for (const placement of rows<{ classroom_id: number }>(placementsResult.data)) classroomLoad.set(placement.classroom_id, (classroomLoad.get(placement.classroom_id) || 0) + 1);

    const plans: Array<{ reenrolmentId: string; learnerId: string; classroomId: number }> = [];
    const sortedRecords = [...records].sort((left, right) => String(learnersById.get(left.learner_id)?.date_of_birth || "9999-12-31").localeCompare(String(learnersById.get(right.learner_id)?.date_of_birth || "9999-12-31")) || left.learner_id.localeCompare(right.learner_id));
    for (const record of sortedRecords) {
      const age = ageOnNewYear(learnersById.get(record.learner_id)?.date_of_birth || null, campaignResult.data.school_year);
      const matches = age === null ? [] : classrooms.filter((classroom) => classroomAcceptsAge(classroom.age_groups, age));
      if (!matches.length) continue;
      const classroom = matches.sort((left, right) => (classroomLoad.get(left.id) || 0) - (classroomLoad.get(right.id) || 0) || left.id - right.id)[0];
      classroomLoad.set(classroom.id, (classroomLoad.get(classroom.id) || 0) + 1);
      plans.push({ reenrolmentId: record.id, learnerId: record.learner_id, classroomId: classroom.id });
    }
    const updatedAt = new Date().toISOString();
    for (const plan of plans) {
      const updateResult = await supabaseAdmin.from("learner_reenrolments").update({ next_classroom_id: plan.classroomId, updated_at: updatedAt }).eq("id", plan.reenrolmentId).eq("school_id", schoolId).eq("status", "approved").is("next_classroom_id", null).is("classroom_applied_at", null).select("id").maybeSingle();
      if (updateResult.error || !updateResult.data) return NextResponse.json({ error: updateResult.error?.message || "A learner allocation changed before it could be saved." }, { status: 409 });
      const placementResult = await supabaseAdmin.from("learner_placements").upsert({ learner_id: plan.learnerId, school_id: schoolId, academic_year: campaignResult.data.school_year, classroom_id: plan.classroomId, placement_status: "future", updated_at: updatedAt }, { onConflict: "learner_id,academic_year" });
      if (placementResult.error) return NextResponse.json({ error: placementResult.error.message }, { status: 500 });
    }
    await writeSecurityAudit(access.staff, "reenrolment_classrooms_auto_allocated", { campaign_id: campaignId, school_year: campaignResult.data.school_year, allocated: plans.length, awaiting_manual: records.length - plans.length });
    return NextResponse.json({ allocated: plans.length, awaiting_manual: records.length - plans.length, message: `${plans.length} re-enrolment classroom allocation${plans.length === 1 ? " was" : "s were"} made automatically.` });
  }

  if (action === "mark_school_leaver" || action === "mark_no_response") {
    const reenrolmentId = asText(body.reenrolment_id, 64);
    const status = action === "mark_school_leaver" ? "school_leaver" : "no_response";
    const allowedStatuses = action === "mark_no_response" ? ["awaiting_parent"] : ["awaiting_parent", "submitted"];
    const updateResult = await supabaseAdmin.from("learner_reenrolments").update({ status, reviewed_by: access.staff.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", reenrolmentId).eq("school_id", schoolId).in("status", allowedStatuses).select("id").maybeSingle();
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    if (!updateResult.data) return NextResponse.json({ error: "This re-enrolment status can no longer be changed using that action." }, { status: 409 });
    await writeSecurityAudit(access.staff, `reenrolment_${status}`, { reenrolment_id: reenrolmentId });
    return NextResponse.json({ success: true });
  }

  if (action === "apply_classroom_rollover") {
    const campaignId = asText(body.campaign_id, 64);
    const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, status, rollover_applied_at").eq("id", campaignId).eq("school_id", schoolId).maybeSingle();
    if (campaignResult.error) return NextResponse.json({ error: campaignResult.error.message }, { status: 500 });
    if (!campaignResult.data) return NextResponse.json({ error: "Re-enrolment campaign not found." }, { status: 404 });
    const targetStart = new Date(`${campaignResult.data.school_year}-01-01T00:00:00+02:00`);
    if (new Date() < targetStart) return NextResponse.json({ error: `Classroom moves can only be applied from 1 January ${campaignResult.data.school_year}.` }, { status: 400 });
    const recordsResult = await supabaseAdmin.from("learner_reenrolments").select("id, learner_id, next_classroom_id").eq("campaign_id", campaignId).eq("status", "approved").is("classroom_applied_at", null).not("next_classroom_id", "is", null);
    if (recordsResult.error) return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });
    const records = rows<{ id: string; learner_id: string; next_classroom_id: number }>(recordsResult.data);
    const classIds = [...new Set(records.map((record) => record.next_classroom_id))];
    const classesResult = classIds.length ? await supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId).in("id", classIds) : { data: [], error: null };
    if (classesResult.error) return NextResponse.json({ error: classesResult.error.message }, { status: 500 });
    const classNames = new Map(rows<{ id: number; classroom_name: string }>(classesResult.data).map((item) => [item.id, item.classroom_name]));
    const appliedAt = new Date().toISOString();
    for (const record of records) {
      const learnerUpdate = await supabaseAdmin.from("learners").update({ classroom_id: record.next_classroom_id, class: classNames.get(record.next_classroom_id) || null }).eq("id", record.learner_id).eq("school_id", schoolId);
      if (learnerUpdate.error) return NextResponse.json({ error: learnerUpdate.error.message }, { status: 500 });
      const recordUpdate = await supabaseAdmin.from("learner_reenrolments").update({ classroom_applied_at: appliedAt, updated_at: appliedAt }).eq("id", record.id).is("classroom_applied_at", null);
      if (recordUpdate.error) return NextResponse.json({ error: recordUpdate.error.message }, { status: 500 });
    }
    const campaignUpdate = await supabaseAdmin.from("school_reenrolment_campaigns").update({ status: "closed", rollover_applied_at: appliedAt, updated_at: appliedAt }).eq("id", campaignId);
    if (campaignUpdate.error) return NextResponse.json({ error: campaignUpdate.error.message }, { status: 500 });
    await writeSecurityAudit(access.staff, "reenrolment_classroom_rollover_applied", { campaign_id: campaignId, learner_count: records.length });
    return NextResponse.json({ success: true, applied: records.length, message: `${records.length} approved learner classroom move${records.length === 1 ? " was" : "s were"} applied.` });
  }

  return NextResponse.json({ error: "Unsupported re-enrolment action." }, { status: 400 });
}

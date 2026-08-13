import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ReenrolmentAction = "create_campaign" | "send_notifications" | "approve_reenrolment" | "decline_reenrolment" | "apply_classroom_rollover";

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
};

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

  const [schoolResult, feeResult, campaignsResult, formsResult, classroomsResult] = await Promise.all([
    supabaseAdmin.from("schools").select("id, school_name").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_fee_types").select("id, fee_name, amount").eq("school_id", schoolId).eq("fee_code", "registration").maybeSingle(),
    supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, source_form_id, form_snapshot, registration_fee_type_id, registration_fee_amount, response_deadline, status, rollover_applied_at, created_at").eq("school_id", schoolId).order("school_year", { ascending: false }),
    supabaseAdmin.from("school_enrolment_forms").select("id, form_name, form_type, instructions").eq("school_id", schoolId).eq("is_active", true).order("form_name"),
    supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId).order("classroom_name"),
  ]);
  const failure = schoolResult.error || feeResult.error || campaignsResult.error || formsResult.error || classroomsResult.error;
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
        ? record.submitted_data as { parent_notes?: unknown; learner_details?: unknown; guardian_details?: unknown; medical_details?: unknown; acknowledged_document_ids?: unknown; acknowledged_requirement_ids?: unknown }
        : {};
      const safeRecord = Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== "submitted_data"),
      );
      return {
        ...safeRecord,
        learner_name: learner?.name || learner?.legal_name || "Learner",
        classroom_name: classroom?.classroom_name || "Unassigned",
        parent_notes: typeof submittedData.parent_notes === "string" ? submittedData.parent_notes : "",
        learner_details: submittedData.learner_details || null,
        guardian_details: submittedData.guardian_details || null,
        medical_details: submittedData.medical_details || null,
        acknowledged_document_ids: Array.isArray(submittedData.acknowledged_document_ids) ? submittedData.acknowledged_document_ids : [],
        acknowledged_requirement_ids: Array.isArray(submittedData.acknowledged_requirement_ids) ? submittedData.acknowledged_requirement_ids : [],
      };
    });
  }

  return NextResponse.json({
    school: schoolResult.data,
    registration_fee: feeResult.data,
    campaign,
    campaigns: rows(campaignsResult.data),
    enrolment_forms: rows(formsResult.data),
    classrooms: rows(classroomsResult.data),
    reenrolments,
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

      const [generatedResult, learnersResult, documentsResult, requirementsResult, checklistResult] = await Promise.all([
        supabaseAdmin.from("learner_reenrolments").select("id, learner_id").eq("campaign_id", campaignId),
        supabaseAdmin.from("learners").select("id, name, legal_name, date_of_birth, gender, birth_certificate_number, sa_id_number, passport_number, guardian_name, guardian_relationship, guardian_id_number, parent_phone, parent_email, home_address, allergies, medical_conditions, medical_instructions, classroom_id").eq("school_id", schoolId),
        supabaseAdmin.from("learner_documents").select("id, learner_id, document_type").eq("school_id", schoolId),
        supabaseAdmin.from("classroom_requirement_items").select("id, classroom_id, item_name, quantity, category").eq("school_id", schoolId).eq("is_active", true),
        supabaseAdmin.from("learner_stationery_checklist").select("learner_id, stationery_item_id, received, received_quantity, required_quantity").eq("school_id", schoolId),
      ]);
      const snapshotFailure = generatedResult.error || learnersResult.error || documentsResult.error || requirementsResult.error || checklistResult.error;
      if (snapshotFailure) return NextResponse.json({ error: snapshotFailure.message }, { status: 500 });
      const learners = new Map(rows<Record<string, unknown>>(learnersResult.data).map((learner) => [String(learner.id), learner]));
      const documents = rows<Record<string, unknown>>(documentsResult.data);
      const requirements = rows<Record<string, unknown>>(requirementsResult.data);
      const checklist = rows<Record<string, unknown>>(checklistResult.data);
      const requiredDocuments = ["Birth Certificate", "Immunisation / Clinic Card", "Parent/Guardian ID", "Signed Parent/Guardian Enrolment Contract"];
      for (const generated of rows<{ id: string; learner_id: string }>(generatedResult.data)) {
        const learner = learners.get(String(generated.learner_id));
        if (!learner) continue;
        const uploaded = new Set(documents.filter((doc) => String(doc.learner_id) === String(generated.learner_id)).map((doc) => String(doc.document_type)));
        const missingDocuments = requiredDocuments.filter((name) => !uploaded.has(name)).map((name) => ({ id: name, name }));
        const classRequirements = requirements.filter((item) => Number(item.classroom_id) === Number(learner.classroom_id));
        const learnerChecklist = checklist.filter((item) => String(item.learner_id) === String(generated.learner_id));
        const missingRequirements = classRequirements.filter((item) => {
          const received = learnerChecklist.find((entry) => Number(entry.stationery_item_id) === Number(item.id));
          return !received || received.received !== true || Number(received.received_quantity || 0) < Number(received.required_quantity || item.quantity || 1);
        }).map((item) => ({ id: String(item.id), name: item.item_name, quantity: item.quantity, category: item.category }));
        const renewalSnapshot = {
          learner_details: { name: learner.name, legal_name: learner.legal_name, date_of_birth: learner.date_of_birth, gender: learner.gender, birth_certificate_number: learner.birth_certificate_number, sa_id_number: learner.sa_id_number, passport_number: learner.passport_number, home_address: learner.home_address },
          guardian_details: { guardian_name: learner.guardian_name, guardian_relationship: learner.guardian_relationship, guardian_id_number: learner.guardian_id_number, parent_phone: learner.parent_phone, parent_email: learner.parent_email, parent_portal_phone: learner.parent_phone },
          medical_details: { allergies: learner.allergies, medical_conditions: learner.medical_conditions, medical_instructions: learner.medical_instructions },
          missing_documents: missingDocuments,
          missing_requirements: missingRequirements,
          captured_at: new Date().toISOString(),
        };
        const update = await supabaseAdmin.from("learner_reenrolments").update({ renewal_snapshot: renewalSnapshot, current_classroom_id: learner.classroom_id || null }).eq("id", generated.id);
        if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
      }
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
        .select("id, parent_phone")
        .eq("school_id", schoolId)
        .in("id", learnerIds);
      if (learnersResult.error) return NextResponse.json({ error: learnersResult.error.message }, { status: 500 });
      learnerRows = rows<LearnerParentPhone>(learnersResult.data);
    }
    const phoneByLearner = new Map(learnerRows.map((learner) => [String(learner.id), learner.parent_phone]));
    const recordsWithPhones = records.filter((record) => Boolean(phoneByLearner.get(String(record.learner_id))));
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
        delivery: push.status,
      });
      return NextResponse.json({ notified: phones.length, delivery: push.status });
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
      .select("id, learner_id, status, parent_portal_phone, registration_fee_amount, submitted_data")
      .eq("id", reenrolmentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (recordResult.error) return NextResponse.json({ error: recordResult.error.message }, { status: 500 });
    if (!recordResult.data || recordResult.data.status !== "submitted") {
      return NextResponse.json({ error: "Only a submitted re-enrolment can be reviewed." }, { status: 409 });
    }

    const reviewedAt = new Date().toISOString();
    if (action === "approve_reenrolment") {
      const nextClassroomId = Number(body.next_classroom_id);
      if (!Number.isInteger(nextClassroomId) || nextClassroomId <= 0) return NextResponse.json({ error: "Choose the learner's classroom for the new school year." }, { status: 400 });
      const classroomResult = await supabaseAdmin.from("classrooms").select("id").eq("id", nextClassroomId).eq("school_id", schoolId).maybeSingle();
      if (classroomResult.error) return NextResponse.json({ error: classroomResult.error.message }, { status: 500 });
      if (!classroomResult.data) return NextResponse.json({ error: "The selected classroom does not belong to this school." }, { status: 400 });
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
          medical_instructions: asText(medicalDetails.medical_instructions, 1000) || null,
        }).eq("id", recordResult.data.learner_id).eq("school_id", schoolId);
        if (learnerUpdate.error) return NextResponse.json({ error: learnerUpdate.error.message }, { status: 500 });
      }

      const updateResult = await supabaseAdmin
        .from("learner_reenrolments")
        .update({ status: "approved", next_classroom_id: nextClassroomId, reviewed_by: access.staff.userId, reviewed_at: reviewedAt, decline_reason: null, updated_at: reviewedAt })
        .eq("id", reenrolmentId)
        .eq("status", "submitted");
      if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
      await writeSecurityAudit(access.staff, "reenrolment_approved", {
        reenrolment_id: reenrolmentId,
        learner_id: recordResult.data.learner_id,
        registration_fee_amount: recordResult.data.registration_fee_amount,
      });
      return NextResponse.json({ success: true, message: "Re-enrolment details approved. The next-year classroom is planned; the learner stays in the current class until rollover." });
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

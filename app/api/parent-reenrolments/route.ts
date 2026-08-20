import { NextResponse } from "next/server";

import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

function rows<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

type ReenrolmentCampaign = {
  id: string;
  school_year: number;
  response_deadline: string | null;
  status: "open" | "closed";
  form_snapshot: unknown;
};

function asText(value: unknown, maxLength = 800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asIdList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => asText(item, 160)).filter(Boolean) : [];
}

function snapshotItems(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asObject(item)).filter((item) => asText(item.id, 160))
    : [];
}

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });

  const children = parent.children || [];
  const learnerIds = children.map((child) => child.id).filter(Boolean);
  if (learnerIds.length === 0) return NextResponse.json({ parent_phone: parent.phone, reenrolments: [] });

  const recordsResult = await supabaseAdmin
    .from("learner_reenrolments")
    .select("id, campaign_id, school_id, learner_id, reenrolment_reference, parent_portal_phone, registration_fee_amount, registration_payment_status, status, submitted_data, renewal_snapshot, current_classroom_id, next_classroom_id, decline_reason, notification_sent_at, created_at")
    .in("learner_id", learnerIds)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  if (recordsResult.error) return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });

  const records = rows(recordsResult.data).filter((record) => parentCanAccessLearnerAtSchool(children, Number(record.school_id), String(record.learner_id)));
  const campaignIds = [...new Set(records.map((record) => String(record.campaign_id)))];
  const campaignsResult = campaignIds.length
    ? await supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, response_deadline, status, form_snapshot").in("id", campaignIds)
    : { data: [], error: null };
  if (campaignsResult.error) return NextResponse.json({ error: campaignsResult.error.message }, { status: 500 });

  const campaignRows = (campaignsResult.data || []) as ReenrolmentCampaign[];
  const campaignsById = new Map(campaignRows.map((campaign) => [String(campaign.id), campaign]));
  const learnersById = new Map(children.map((child) => [child.id, child]));
  const reenrolments = records.map((record) => {
    const campaign = campaignsById.get(String(record.campaign_id));
    const learner = learnersById.get(String(record.learner_id));
    if (!campaign || campaign.status !== "open" || !learner) return null;
    const classroom = Array.isArray(learner.classrooms) ? learner.classrooms[0] : learner.classrooms;
    return { ...record, school_year: campaign.school_year, response_deadline: campaign.response_deadline, form_snapshot: campaign.form_snapshot, learner_name: learner.name, classroom_name: classroom?.classroom_name || "Unassigned" };
  }).filter(Boolean);

  return NextResponse.json({ parent_phone: parent.phone, reenrolments });
}

export async function POST(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.action !== "submit" && body.action !== "not_returning") return NextResponse.json({ error: "Unsupported re-enrolment action." }, { status: 400 });

  const reenrolmentId = asText(body.reenrolment_id, 64);
  if (!reenrolmentId) return NextResponse.json({ error: "A re-enrolment record is required." }, { status: 400 });
  if (body.action === "submit" && body.confirm_return !== true) return NextResponse.json({ error: "Confirm that the learner will return before submitting." }, { status: 400 });

  const recordResult = await supabaseAdmin.from("learner_reenrolments").select("id, campaign_id, school_id, learner_id, status, submitted_data, renewal_snapshot").eq("id", reenrolmentId).maybeSingle();
  if (recordResult.error) return NextResponse.json({ error: recordResult.error.message }, { status: 500 });
  if (!recordResult.data || !parentCanAccessLearnerAtSchool(parent.children || [], Number(recordResult.data.school_id), String(recordResult.data.learner_id))) {
    return NextResponse.json({ error: "This re-enrolment record is not available to this parent." }, { status: 403 });
  }
  if (recordResult.data.status !== "awaiting_parent" && recordResult.data.status !== "declined" && recordResult.data.status !== "no_response") {
    return NextResponse.json({ error: "This re-enrolment has already been submitted or approved." }, { status: 409 });
  }

  const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("status").eq("id", recordResult.data.campaign_id).maybeSingle();
  if (campaignResult.error) return NextResponse.json({ error: campaignResult.error.message }, { status: 500 });
  if (!campaignResult.data || campaignResult.data.status !== "open") return NextResponse.json({ error: "This re-enrolment campaign is closed." }, { status: 400 });

  if (body.action === "not_returning") {
    const updatedAt = new Date().toISOString();
    const updateResult = await supabaseAdmin.from("learner_reenrolments").update({ status: "not_returning", submitted_data: { ...asObject(recordResult.data.submitted_data), parent_notes: asText(body.parent_notes), parent_confirmed_not_returning_at: updatedAt }, updated_at: updatedAt }).eq("id", reenrolmentId).in("status", ["awaiting_parent", "declined", "no_response"]);
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const parentPortalPhone = toSouthAfricanSmsNumber(asText(body.parent_portal_phone, 32));
  if (!/^27\d{9}$/.test(parentPortalPhone)) {
    return NextResponse.json({ error: "Enter one valid South African mobile number for Parent Portal access." }, { status: 400 });
  }

  const snapshot = asObject(recordResult.data.renewal_snapshot);
  const missingDocuments = snapshotItems(snapshot.missing_documents);
  const missingRequirements = snapshotItems(snapshot.missing_requirements);
  const acknowledgedDocumentIds = asIdList(body.acknowledged_document_ids);
  const acknowledgedRequirementIds = asIdList(body.acknowledged_requirement_ids);
  const unacknowledgedDocuments = missingDocuments.filter((item) => !acknowledgedDocumentIds.includes(asText(item.id, 160)));
  const unacknowledgedRequirements = missingRequirements.filter((item) => !acknowledgedRequirementIds.includes(asText(item.id, 160)));
  if (unacknowledgedDocuments.length || unacknowledgedRequirements.length) {
    return NextResponse.json({ error: "Tick every outstanding document and learner requirement to confirm that you have seen what is still needed." }, { status: 400 });
  }

  const learnerInput = asObject(body.learner_details);
  const guardianInput = asObject(body.guardian_details);
  const medicalInput = asObject(body.medical_details);
  const learnerDetails = {
    name: asText(learnerInput.name, 120),
    legal_name: asText(learnerInput.legal_name, 180),
    date_of_birth: asText(learnerInput.date_of_birth, 10),
    gender: asText(learnerInput.gender, 40),
    birth_certificate_number: asText(learnerInput.birth_certificate_number, 80),
    sa_id_number: asText(learnerInput.sa_id_number, 20),
    passport_number: asText(learnerInput.passport_number, 80),
    home_address: asText(learnerInput.home_address, 500),
  };
  const guardianDetails = {
    guardian_name: asText(guardianInput.guardian_name, 180),
    guardian_relationship: asText(guardianInput.guardian_relationship, 80),
    guardian_id_number: asText(guardianInput.guardian_id_number, 80),
    parent_phone: asText(guardianInput.parent_phone, 32),
    parent_email: asText(guardianInput.parent_email, 180),
  };
  const medicalDetails = {
    allergies: asText(medicalInput.allergies, 800),
    medical_conditions: asText(medicalInput.medical_conditions, 800),
    medical_instructions: asText(medicalInput.medical_instructions, 1200),
  };
  if (!learnerDetails.name || !learnerDetails.legal_name || !learnerDetails.date_of_birth || !guardianDetails.guardian_name) {
    return NextResponse.json({ error: "Complete the learner name, legal name, date of birth and parent or guardian name." }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const submittedData = recordResult.data.submitted_data && typeof recordResult.data.submitted_data === "object" ? recordResult.data.submitted_data : {};
  const updateResult = await supabaseAdmin.from("learner_reenrolments").update({
    parent_portal_phone: parentPortalPhone,
    parent_portal_phone_confirmed_at: submittedAt,
    status: "submitted",
    submitted_data: {
      ...submittedData,
      learner_details: learnerDetails,
      guardian_details: guardianDetails,
      medical_details: medicalDetails,
      acknowledged_document_ids: acknowledgedDocumentIds,
      acknowledged_requirement_ids: acknowledgedRequirementIds,
      parent_portal_phone: parentPortalPhone,
      parent_notes: asText(body.parent_notes),
      parent_confirmed_at: submittedAt,
    },
    updated_at: submittedAt,
  }).eq("id", reenrolmentId).in("status", ["awaiting_parent", "declined", "no_response"]);
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

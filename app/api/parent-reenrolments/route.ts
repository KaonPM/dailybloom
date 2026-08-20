import { NextResponse } from "next/server";

import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { toSouthAfricanSmsNumber } from "@/app/lib/sms-portal";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

const DOCUMENT_BUCKET = "school-enrolment-forms";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

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

function safeFileName(value: unknown) {
  return asText(value, 180).replace(/[^a-zA-Z0-9._-]/g, "-") || "document";
}

function uploadedDocuments(value: unknown, schoolId: number, reenrolmentId: string) {
  const uploads = asObject(value);
  const safeUploads: Record<string, { name: string; path: string }> = {};
  for (const [documentName, rawUpload] of Object.entries(uploads)) {
    const upload = asObject(rawUpload);
    const path = asText(upload.path, 700);
    if (!path.startsWith(`${schoolId}/reenrolment-submissions/${reenrolmentId}/`) || path.includes("..")) continue;
    safeUploads[asText(documentName, 180)] = { name: asText(upload.name, 180) || documentName, path };
  }
  return safeUploads;
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
  const action = asText(body.action, 40);
  if (!["submit", "save_draft", "not_returning", "create_document_upload"].includes(action)) return NextResponse.json({ error: "Unsupported re-enrolment action." }, { status: 400 });

  const reenrolmentId = asText(body.reenrolment_id, 64);
  if (!reenrolmentId) return NextResponse.json({ error: "A re-enrolment record is required." }, { status: 400 });
  if (action === "submit" && body.confirm_return !== true) return NextResponse.json({ error: "Confirm that the learner will return before submitting." }, { status: 400 });

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

  if (action === "create_document_upload") {
    const fileSize = Number(body.file_size || 0);
    const contentType = asText(body.content_type, 100).toLowerCase();
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_BYTES || !ALLOWED_DOCUMENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Use a PDF, JPG, PNG or WEBP document no larger than 10 MB." }, { status: 400 });
    }
    const path = `${recordResult.data.school_id}/reenrolment-submissions/${reenrolmentId}/${Date.now()}-${safeFileName(body.file_name)}`;
    const uploadResult = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
    if (uploadResult.error || !uploadResult.data) return NextResponse.json({ error: uploadResult.error?.message || "Could not prepare the document upload." }, { status: 500 });
    return NextResponse.json({ path, signed_url: uploadResult.data.signedUrl, token: uploadResult.data.token });
  }

  if (action === "not_returning") {
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
  const uploads = uploadedDocuments(body.uploaded_documents, Number(recordResult.data.school_id), reenrolmentId);
  const acknowledgedDocumentIds = asIdList(body.acknowledged_document_ids);
  const acknowledgedRequirementIds = asIdList(body.acknowledged_requirement_ids);
  const unacknowledgedRequirements = missingRequirements.filter((item) => !acknowledgedRequirementIds.includes(asText(item.id, 160)));
  const missingUploads = missingDocuments.filter((item) => !uploads[asText(item.name, 180)]);
  if (action === "submit" && missingUploads.length) {
    return NextResponse.json({ error: `Upload ${missingUploads.map((item) => asText(item.name, 180)).join(", ")} before submitting.` }, { status: 400 });
  }
  if (action === "submit" && unacknowledgedRequirements.length) {
    return NextResponse.json({ error: "Tick every outstanding learner requirement to confirm that you have seen what is still needed." }, { status: 400 });
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
    medical_aid_name: asText(medicalInput.medical_aid_name, 180),
    medical_aid_number: asText(medicalInput.medical_aid_number, 120),
    medical_aid_main_member: asText(medicalInput.medical_aid_main_member, 180),
    preferred_doctor_name: asText(medicalInput.preferred_doctor_name, 180),
    preferred_doctor_phone: asText(medicalInput.preferred_doctor_phone, 40),
    immunisation_status: asText(medicalInput.immunisation_status, 40),
    immunisation_notes: asText(medicalInput.immunisation_notes, 1000),
  };
  if (action === "submit" && (!learnerDetails.name || !learnerDetails.legal_name || !learnerDetails.date_of_birth || !guardianDetails.guardian_name)) {
    return NextResponse.json({ error: "Complete the learner name, legal name, date of birth and parent or guardian name." }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const submittedData = recordResult.data.submitted_data && typeof recordResult.data.submitted_data === "object" ? recordResult.data.submitted_data : {};
  const updateValues: Record<string, unknown> = {
    parent_portal_phone: parentPortalPhone,
    status: action === "submit" ? "submitted" : recordResult.data.status,
    submitted_data: {
      ...submittedData,
      learner_details: learnerDetails,
      guardian_details: guardianDetails,
      medical_details: medicalDetails,
      uploaded_documents: uploads,
      acknowledged_document_ids: acknowledgedDocumentIds,
      acknowledged_requirement_ids: acknowledgedRequirementIds,
      parent_portal_phone: parentPortalPhone,
      parent_notes: asText(body.parent_notes),
      parent_confirmed_at: action === "submit" ? submittedAt : null,
      draft_saved_at: submittedAt,
    },
    updated_at: submittedAt,
  };
  if (action === "submit") updateValues.parent_portal_phone_confirmed_at = submittedAt;
  const updateResult = await supabaseAdmin.from("learner_reenrolments").update(updateValues).eq("id", reenrolmentId).in("status", ["awaiting_parent", "declined", "no_response"]);
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ success: true, saved_at: submittedAt, submitted: action === "submit" });
}

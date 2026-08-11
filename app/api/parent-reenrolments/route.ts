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
};

function asText(value: unknown, maxLength = 800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });

  const children = parent.children || [];
  const learnerIds = children.map((child) => child.id).filter(Boolean);
  if (learnerIds.length === 0) return NextResponse.json({ parent_phone: parent.phone, reenrolments: [] });

  const recordsResult = await supabaseAdmin
    .from("learner_reenrolments")
    .select("id, campaign_id, school_id, learner_id, reenrolment_reference, parent_portal_phone, registration_fee_amount, registration_payment_status, status, submitted_data, decline_reason, notification_sent_at, created_at")
    .in("learner_id", learnerIds)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  if (recordsResult.error) return NextResponse.json({ error: recordsResult.error.message }, { status: 500 });

  const records = rows(recordsResult.data).filter((record) => parentCanAccessLearnerAtSchool(children, Number(record.school_id), String(record.learner_id)));
  const campaignIds = [...new Set(records.map((record) => String(record.campaign_id)))];
  const campaignsResult = campaignIds.length
    ? await supabaseAdmin.from("school_reenrolment_campaigns").select("id, school_year, response_deadline, status").in("id", campaignIds)
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
    return { ...record, school_year: campaign.school_year, response_deadline: campaign.response_deadline, learner_name: learner.name, classroom_name: classroom?.classroom_name || "Unassigned" };
  }).filter(Boolean);

  return NextResponse.json({ parent_phone: parent.phone, reenrolments });
}

export async function POST(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.action !== "submit") return NextResponse.json({ error: "Unsupported re-enrolment action." }, { status: 400 });

  const reenrolmentId = asText(body.reenrolment_id, 64);
  if (!reenrolmentId) return NextResponse.json({ error: "A re-enrolment record is required." }, { status: 400 });
  if (body.confirm_return !== true) return NextResponse.json({ error: "Confirm that the learner will return before submitting." }, { status: 400 });

  const recordResult = await supabaseAdmin.from("learner_reenrolments").select("id, campaign_id, school_id, learner_id, status, submitted_data").eq("id", reenrolmentId).maybeSingle();
  if (recordResult.error) return NextResponse.json({ error: recordResult.error.message }, { status: 500 });
  if (!recordResult.data || !parentCanAccessLearnerAtSchool(parent.children || [], Number(recordResult.data.school_id), String(recordResult.data.learner_id))) {
    return NextResponse.json({ error: "This re-enrolment record is not available to this parent." }, { status: 403 });
  }
  if (recordResult.data.status !== "awaiting_parent" && recordResult.data.status !== "declined") {
    return NextResponse.json({ error: "This re-enrolment has already been submitted or approved." }, { status: 409 });
  }

  const campaignResult = await supabaseAdmin.from("school_reenrolment_campaigns").select("status").eq("id", recordResult.data.campaign_id).maybeSingle();
  if (campaignResult.error) return NextResponse.json({ error: campaignResult.error.message }, { status: 500 });
  if (!campaignResult.data || campaignResult.data.status !== "open") return NextResponse.json({ error: "This re-enrolment campaign is closed." }, { status: 400 });

  const parentPortalPhone = toSouthAfricanSmsNumber(asText(body.parent_portal_phone, 32));
  if (!/^27\d{9}$/.test(parentPortalPhone)) {
    return NextResponse.json({ error: "Enter one valid South African mobile number for Parent Portal access." }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const submittedData = recordResult.data.submitted_data && typeof recordResult.data.submitted_data === "object" ? recordResult.data.submitted_data : {};
  const updateResult = await supabaseAdmin.from("learner_reenrolments").update({
    parent_portal_phone: parentPortalPhone,
    parent_portal_phone_confirmed_at: submittedAt,
    status: "submitted",
    submitted_data: { ...submittedData, parent_portal_phone: parentPortalPhone, parent_notes: asText(body.parent_notes), parent_confirmed_at: submittedAt },
    updated_at: submittedAt,
  }).eq("id", reenrolmentId).in("status", ["awaiting_parent", "declined"]);
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

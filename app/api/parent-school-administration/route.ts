import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import { parentCanAccessLearnerAtSchool } from "@/app/lib/parent-authorization-policy";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";
const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const DOCUMENT_BUCKET="school-enrolment-forms";
async function signedDocument(path:unknown){if(typeof path!=="string"||!path)return null;const result=await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUrl(path,3600);return result.data?.signedUrl||null}

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });
  const children = parent.children || []; const schoolIds = [...new Set(children.map((c) => Number(c.school_id)).filter(Boolean))];
  if (!schoolIds.length) return NextResponse.json({ meetings: [], surveys: [] });
  const classroomIds = children.map((c) => Number(c.classroom_id)).filter(Boolean);
  const [meetingsResult, surveysResult] = await Promise.all([
    supabaseAdmin.from("school_meetings").select("*, school_meeting_acknowledgements(learner_id,parent_phone,acknowledged_at)").in("school_id", schoolIds).not("agenda_published_at", "is", null).order("meeting_date", { ascending: false }),
    supabaseAdmin.from("school_surveys").select("*, school_survey_responses(learner_id,parent_phone,submitted_at,external_completed), school_survey_completions(learner_id,parent_phone,completed_at)").in("school_id", schoolIds).not("published_at", "is", null).order("created_at", { ascending: false }),
  ]);
  const error = meetingsResult.error || surveysResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const visible = (row: Record<string, unknown>) => row.audience === "whole_school" || classroomIds.includes(Number(row.classroom_id));
  const withEligibleLearners=(row:Record<string,unknown>)=>({...row,eligible_learner_ids:children.filter((child)=>row.audience==="whole_school"||Number(child.classroom_id)===Number(row.classroom_id)).map((child)=>child.id)});
  const meetingRows=await Promise.all((meetingsResult.data||[]).filter(visible).map(async(row)=>({...withEligibleLearners(row),agenda_url:await signedDocument(row.agenda_url),minutes_url:await signedDocument(row.minutes_url)})));
  return NextResponse.json({ meetings: meetingRows, surveys: (surveysResult.data || []).filter(visible).map(withEligibleLearners), children, parent_phone: parent.phone });
}

export async function POST(request: Request) {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent access is required." }, { status: 401 });
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const learnerId = text(body.learner_id, 64); const child = (parent.children || []).find((c) => String(c.id) === learnerId);
  if (!child || !parentCanAccessLearnerAtSchool(parent.children || [], Number(child.school_id), learnerId)) return NextResponse.json({ error: "This learner is not available to this parent." }, { status: 403 });
  if (body.action === "acknowledge_minutes") {
    const meetingId = text(body.meeting_id, 64); const meeting = await supabaseAdmin.from("school_meetings").select("id,school_id,classroom_id,audience,minutes_published_at").eq("id", meetingId).eq("school_id", child.school_id).maybeSingle();
    if (meeting.error || !meeting.data?.minutes_published_at) return NextResponse.json({ error: meeting.error?.message || "Published minutes were not found." }, { status: 404 });
    if(meeting.data.audience!=="whole_school"&&Number(meeting.data.classroom_id)!==Number(child.classroom_id))return NextResponse.json({error:"These minutes are not assigned to this learner's classroom."},{status:403});
    const result = await supabaseAdmin.from("school_meeting_acknowledgements").upsert({ meeting_id: meetingId, learner_id: learnerId, parent_phone: parent.phone, acknowledged_at: new Date().toISOString() }, { onConflict: "meeting_id,learner_id,parent_phone" });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  if (body.action === "submit_survey") {
    const surveyId = text(body.survey_id, 64); const survey = await supabaseAdmin.from("school_surveys").select("id,school_id,survey_type,audience,classroom_id,closes_at,anonymous").eq("id", surveyId).eq("school_id", child.school_id).maybeSingle();
    if (survey.error || !survey.data) return NextResponse.json({ error: survey.error?.message || "Survey was not found." }, { status: 404 });
    if (survey.data.closes_at && new Date(survey.data.closes_at) < new Date()) return NextResponse.json({ error: "This survey is closed." }, { status: 409 });
    if(survey.data.audience!=="whole_school"&&Number(survey.data.classroom_id)!==Number(child.classroom_id))return NextResponse.json({error:"This survey is not assigned to this learner's classroom."},{status:403});
    const existingCompletion = await supabaseAdmin.from("school_survey_completions").select("survey_id").eq("survey_id", surveyId).eq("learner_id", learnerId).eq("parent_phone", parent.phone).maybeSingle();
    if (existingCompletion.error) return NextResponse.json({ error: existingCompletion.error.message }, { status: 500 });
    if (existingCompletion.data) return NextResponse.json({ success: true, already_completed: true });
    const submittedAt = new Date().toISOString();
    const responsePayload = { survey_id: surveyId, learner_id: survey.data.anonymous ? null : learnerId, parent_phone: survey.data.anonymous ? null : parent.phone, answers: body.answers && typeof body.answers === "object" ? body.answers : {}, external_completed: survey.data.survey_type === "external", submitted_at: submittedAt };
    const result = survey.data.anonymous
      ? await supabaseAdmin.from("school_survey_responses").insert(responsePayload)
      : await supabaseAdmin.from("school_survey_responses").upsert(responsePayload, { onConflict: "survey_id,learner_id,parent_phone" });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    const completion = await supabaseAdmin.from("school_survey_completions").upsert({ survey_id: surveyId, learner_id: learnerId, parent_phone: parent.phone, completed_at: submittedAt }, { onConflict: "survey_id,learner_id,parent_phone" });
    if (completion.error) return NextResponse.json({ error: completion.error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

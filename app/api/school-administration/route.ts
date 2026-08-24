import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const schoolIdFrom = (value: unknown) => { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : 0; };
const DOCUMENT_BUCKET="school-enrolment-forms";
async function signedDocument(path:unknown){if(typeof path!=="string"||!path)return null;const result=await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUrl(path,3600);return result.data?.signedUrl||null}
async function notifyParents(schoolId:number, classroomId:number|null, heading:string, message:string){
  const appId=process.env.ONESIGNAL_APP_ID||process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID; const key=process.env.ONESIGNAL_REST_API_KEY;
  if(!appId||!key)return "skipped";
  let query=supabaseAdmin.from("learners").select("parent_phone").eq("school_id",schoolId).not("parent_phone","is",null); if(classroomId)query=query.eq("classroom_id",classroomId);
  const learners=await query; if(learners.error)throw learners.error; const ids=[...new Set((learners.data||[]).map((row)=>row.parent_phone).filter(Boolean))]; if(!ids.length)return "skipped";
  const response=await fetch("https://api.onesignal.com/notifications",{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json"},body:JSON.stringify({app_id:appId,include_aliases:{external_id:ids},target_channel:"push",headings:{en:heading},contents:{en:message},url:`${process.env.NEXT_PUBLIC_SITE_URL||"https://www.dailybloom.co.za"}/parent/school-administration`})});
  return response.ok?"sent":"failed";
}

export async function GET(request: Request) {
  const schoolId = schoolIdFrom(new URL(request.url).searchParams.get("school_id"));
  if (!schoolId) return NextResponse.json({ error: "A school is required." }, { status: 400 });
  const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!access.ok) return access.response;
  const [meetings, surveys, classrooms] = await Promise.all([
    supabaseAdmin.from("school_meetings").select("*, acknowledgements:school_meeting_acknowledgements(count)").eq("school_id", schoolId).order("meeting_date", { ascending: false }),
    supabaseAdmin.from("school_surveys").select("*, responses:school_survey_responses(count)").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabaseAdmin.from("classrooms").select("id, classroom_name").eq("school_id", schoolId).order("classroom_name"),
  ]);
  const error = meetings.error || surveys.error || classrooms.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const meetingRows=await Promise.all((meetings.data||[]).map(async(row)=>({...row,agenda_url:await signedDocument(row.agenda_url),minutes_url:await signedDocument(row.minutes_url)})));
  return NextResponse.json({ meetings: meetingRows, surveys: surveys.data || [], classrooms: classrooms.data || [] });
}

export async function PUT(request:Request){
  const form=await request.formData();const schoolId=schoolIdFrom(form.get("school_id"));const access=await requireStaffPermission(request,PERMISSIONS.SCHOOL_MANAGE,schoolId);if(!access.ok)return access.response;
  const file=form.get("file");if(!(file instanceof File)||file.size<=0||file.size>10*1024*1024)return NextResponse.json({error:"Choose a document no larger than 10 MB."},{status:400});
  const allowed=new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);if(!allowed.has(file.type))return NextResponse.json({error:"Use a PDF or Word document."},{status:400});
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${schoolId}/school-administration/${crypto.randomUUID()}-${safe}`;const uploaded=await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type,upsert:false});if(uploaded.error)return NextResponse.json({error:uploaded.error.message},{status:500});return NextResponse.json({path});
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const schoolId = schoolIdFrom(body.school_id);
  const access = await requireStaffPermission(request, PERMISSIONS.SCHOOL_MANAGE, schoolId);
  if (!access.ok) return access.response;
  const action = text(body.action, 40);
  if (action === "save_meeting") {
    const title = text(body.title, 180); const meetingDate = text(body.meeting_date, 40);
    if (!title || !meetingDate) return NextResponse.json({ error: "Meeting title and date are required." }, { status: 400 });
    const audience = text(body.audience, 30) === "classroom" ? "classroom" : "whole_school";
    const classroomId = schoolIdFrom(body.classroom_id) || null;
    if (audience === "classroom") {
      if (!classroomId) return NextResponse.json({ error: "Select a classroom for this agenda." }, { status: 400 });
      const classroom = await supabaseAdmin.from("classrooms").select("id").eq("id", classroomId).eq("school_id", schoolId).maybeSingle();
      if (classroom.error || !classroom.data) return NextResponse.json({ error: classroom.error?.message || "The selected classroom does not belong to this school." }, { status: 400 });
    }
    const agendaUrl = text(body.agenda_url, 1000) || null;
    const agendaContent = text(body.agenda_content, 20_000) || null;
    if (!agendaUrl && !agendaContent) return NextResponse.json({ error: "Type an agenda or attach an agenda document." }, { status: 400 });
    const result = await supabaseAdmin.from("school_meetings").insert({ school_id: schoolId, title, meeting_date: meetingDate, audience, classroom_id: audience === "classroom" ? classroomId : null, agenda_url: agendaUrl, agenda_content: agendaContent, agenda_published_at: body.publish_agenda ? new Date().toISOString() : null, minutes_url: text(body.minutes_url, 1000) || null, minutes_content: text(body.minutes_content, 20_000) || null, minutes_published_at: body.publish_minutes ? new Date().toISOString() : null, acknowledgement_required: true, created_by: access.staff.userId }).select("id,title,classroom_id").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    const delivery = body.publish_agenda ? await notifyParents(schoolId, result.data.classroom_id, `${result.data.title} agenda available`, "A meeting agenda is ready to download in your Parent Portal.") : "skipped";
    return NextResponse.json({ success: true, id: result.data.id, delivery });
  }
  if (action === "publish_minutes") {
    const meetingId=text(body.meeting_id,64); const meeting=await supabaseAdmin.from("school_meetings").select("id,title,classroom_id").eq("id",meetingId).eq("school_id",schoolId).maybeSingle();
    if(meeting.error||!meeting.data)return NextResponse.json({error:meeting.error?.message||"Meeting not found."},{status:404});
    const minutesUrl = text(body.minutes_url, 1000) || null;
    const minutesContent = text(body.minutes_content, 20_000) || null;
    if (!minutesUrl && !minutesContent) return NextResponse.json({ error: "Type the minutes or attach an approved minutes document." }, { status: 400 });
    const result = await supabaseAdmin.from("school_meetings").update({ minutes_url: minutesUrl, minutes_content: minutesContent, minutes_published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", meetingId).eq("school_id", schoolId);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    const delivery=await notifyParents(schoolId,meeting.data.classroom_id,`${meeting.data.title} minutes available`,"Meeting minutes are ready. Please read and acknowledge them in your Parent Portal.");
    return NextResponse.json({ success: true, delivery });
  }
  if (action === "save_survey") {
    const title = text(body.title, 180); const surveyType = body.survey_type === "external" ? "external" : "dailybloom";
    const questions = Array.isArray(body.questions) ? body.questions : [];
    if (!title || (surveyType === "external" && !text(body.external_url, 1000)) || (surveyType === "dailybloom" && !questions.length)) return NextResponse.json({ error: "Complete the survey title and its questions or external link." }, { status: 400 });
    const audience = text(body.audience, 30) === "classroom" ? "classroom" : "whole_school";
    const classroomId = schoolIdFrom(body.classroom_id) || null;
    if (audience === "classroom") {
      if (!classroomId) return NextResponse.json({ error: "Select a classroom for this survey." }, { status: 400 });
      const classroom = await supabaseAdmin.from("classrooms").select("id").eq("id", classroomId).eq("school_id", schoolId).maybeSingle();
      if (classroom.error || !classroom.data) return NextResponse.json({ error: classroom.error?.message || "The selected classroom does not belong to this school." }, { status: 400 });
    }
    const result = await supabaseAdmin.from("school_surveys").insert({ school_id: schoolId, title, description: text(body.description, 1500) || null, survey_type: surveyType, external_url: text(body.external_url, 1000) || null, questions, audience, classroom_id: audience === "classroom" ? classroomId : null, opens_at: text(body.opens_at, 40) || null, closes_at: text(body.closes_at, 40) || null, anonymous: body.anonymous === true, published_at: new Date().toISOString(), created_by: access.staff.userId }).select("id,title,classroom_id").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    const delivery = await notifyParents(schoolId, result.data.classroom_id, `${result.data.title} survey available`, "A new school survey is ready in your Parent Portal.");
    return NextResponse.json({ success: true, id: result.data.id, delivery });
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { canonicalLearnerDocumentName } from "@/app/lib/learner-documents";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type StoredDocument = { document_type?: string | null; file_name?: string | null; file_path?: string | null; uploaded_at?: string | null };

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id"));
  const learnerId = String(params.get("learner_id") || "");
  const access = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!access.ok) return access.response;
  if (!learnerId) return NextResponse.json({ error: "Learner is required." }, { status: 400 });

  const [learnerResult, schoolResult, enrolmentResult, placementResult, documentsResult, requirementsResult] = await Promise.all([
    supabaseAdmin.from("learners").select("id, name, legal_name, class, date_of_birth, gender, nationality, home_language, birth_certificate_number, sa_id_number, passport_number, admission_number, guardian_name, guardian_relationship, guardian_id_number, parent_phone, parent_email, allergies, medical_conditions, medical_instructions, medical_aid_name, medical_aid_number, medical_aid_main_member, medical_aid_phone, family_doctor_name, family_doctor_phone, preferred_hospital").eq("id", learnerId).eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("schools").select("school_name, logo_url, contact_number, emis_number").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_enquiries").select("enquiry_reference, academic_year, status, enrolment_source, submitted_data, submitted_at, reviewed_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("learner_placements").select("academic_year, placement_status, classrooms(classroom_name)").eq("school_id", schoolId).eq("learner_id", learnerId).order("academic_year", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("learner_documents").select("document_type, file_name, file_path, uploaded_at").eq("school_id", schoolId).eq("learner_id", learnerId).order("document_type"),
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, is_required, display_order").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
  ]);

  if (learnerResult.error || !learnerResult.data) return NextResponse.json({ error: learnerResult.error?.message || "Learner not found." }, { status: 404 });
  const learner = learnerResult.data;
  const { data: attendanceRows, error: attendanceError } = await supabaseAdmin.from("attendance").select("status, attendance_date").eq("school_id", schoolId).eq("learner_name", learner.name || "");
  if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 });
  const failure = schoolResult.error || enrolmentResult.error || placementResult.error || documentsResult.error || requirementsResult.error;
  if (failure) return NextResponse.json({ error: failure.message }, { status: 500 });

  const uploadedDocuments = (documentsResult.data || []) as StoredDocument[];
  const configured = (requirementsResult.data || []).map((item) => ({ title: canonicalLearnerDocumentName(item.title), is_required: item.is_required !== false }));
  const names = [...new Set([...configured.map((item) => item.title), ...uploadedDocuments.map((item) => canonicalLearnerDocumentName(item.document_type)).filter(Boolean)])];
  const documents = names.map((title) => {
    const uploaded = uploadedDocuments.find((item) => canonicalLearnerDocumentName(item.document_type) === title && Boolean(item.file_path));
    return { title, required: configured.find((item) => item.title === title)?.is_required ?? false, uploaded: Boolean(uploaded), file_name: uploaded?.file_name || null, uploaded_at: uploaded?.uploaded_at || null };
  });
  const attendance = (attendanceRows || []).reduce((summary, row) => {
    const status = text(row.status).toLowerCase();
    if (status === "present") summary.present += 1;
    else if (status === "absent") summary.absent += 1;
    else if (status) summary.other += 1;
    return summary;
  }, { present: 0, absent: 0, other: 0 });
  const total = attendance.present + attendance.absent + attendance.other;
  const submittedData = asRecord(enrolmentResult.data?.submitted_data);
  const placementClassroom = Array.isArray(placementResult.data?.classrooms) ? placementResult.data?.classrooms[0] : placementResult.data?.classrooms;

  return NextResponse.json({
    school: schoolResult.data || {}, learner,
    enrolment: enrolmentResult.data ? { ...enrolmentResult.data, submitted_data: submittedData } : null,
    placement: placementResult.data ? { ...placementResult.data, classroom_name: placementClassroom?.classroom_name || learner.class || "Awaiting classroom allocation" } : { classroom_name: learner.class || "Awaiting classroom allocation" },
    documents,
    attendance: { ...attendance, total, rate: attendance.present + attendance.absent ? Math.round((attendance.present / (attendance.present + attendance.absent)) * 100) : null },
  });
}

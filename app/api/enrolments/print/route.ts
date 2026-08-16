import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id")); const enquiryId = String(params.get("enquiry_id") || "");
  const access = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!access.ok) return access.response;
  const [{ data: enquiry }, { data: school }, { data: settings }, { data: configuration }, { data: documents }, { data: requirements }, { data: consents }, { data: terms }] = await Promise.all([
    supabaseAdmin.from("school_enrolment_enquiries").select("enquiry_reference, academic_year, enrolment_source").eq("id", enquiryId).eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("schools").select("school_name, logo_url, contact_number").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_configurations").select("form_title, introduction, additional_declaration").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("template_key, available_from_months, category, item_name, quantity").eq("school_id", schoolId).eq("is_active", true).order("template_key").order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("title, wording").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("title, content").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
  ]);
  if (!enquiry || enquiry.enrolment_source !== "printed_blank_form") return NextResponse.json({ error: "Printed blank enrolment application not found." }, { status: 404 });
  return NextResponse.json({ enquiry, school, settings, configuration, documents: documents || [], requirements: requirements || [], consents: consents || [], terms: terms || [] });
}

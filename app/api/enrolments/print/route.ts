import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type Fee = { fee_code?: string | null; fee_name?: string | null; fee_category?: string | null; amount?: number | string | null };
type Term = { title: string; content: string };

function termsWithFees(terms: Term[] | null, fees: Fee[] | null) {
  return (terms || []).map((term) => {
    const title = term.title.trim().toLowerCase();
    const applicable = title === "registration fee" ? (fees || []).filter((fee) => fee.fee_code === "registration") : title === "fees and payment obligations" ? (fees || []).filter((fee) => fee.fee_category === "monthly") : title === "aftercare" ? (fees || []).filter((fee) => `${fee.fee_code || ""} ${fee.fee_name || ""}`.toLowerCase().includes("aftercare")) : title === "late collection" ? (fees || []).filter((fee) => `${fee.fee_code || ""} ${fee.fee_name || ""}`.toLowerCase().includes("late collect")) : [];
    if (!applicable.length) return term;
    const values = applicable.map((fee) => `${fee.fee_name || "Fee"}: R${Number(fee.amount || 0).toFixed(2)}`).join("; ");
    return { ...term, content: `${term.content} Current configured amount${applicable.length === 1 ? "" : "s"}: ${values}.` };
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id")); const enquiryId = String(params.get("enquiry_id") || "");
  const access = await requireStaffPermission(request, PERMISSIONS.LEARNERS_MANAGE, schoolId);
  if (!access.ok) return access.response;
  const [{ data: enquiry }, { data: school }, { data: settings }, { data: configuration }, { data: documents }, { data: requirements }, { data: consents }, { data: terms }, { data: fees }, { data: registration }] = await Promise.all([
    supabaseAdmin.from("school_enrolment_enquiries").select("enquiry_reference, academic_year, enrolment_source").eq("id", enquiryId).eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("schools").select("school_name, logo_url, contact_number").eq("id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_setup_settings").select("bank_account_name, bank_name, bank_account_number, bank_branch_code, bank_account_type").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_configurations").select("form_title, introduction, additional_declaration, second_guardian_mode, emergency_contact_mode, previous_school_enabled, custom_fields").eq("school_id", schoolId).maybeSingle(),
    supabaseAdmin.from("school_enrolment_document_requirements").select("title, instructions, is_required").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_requirement_templates").select("template_key, available_from_months, available_to_months, category, item_name, quantity").eq("school_id", schoolId).eq("is_active", true).order("template_key").order("display_order"),
    supabaseAdmin.from("school_enrolment_consents").select("title, wording").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_enrolment_terms_sections").select("title, content").eq("school_id", schoolId).eq("is_active", true).order("display_order"),
    supabaseAdmin.from("school_fee_types").select("fee_code, fee_name, fee_category, amount").eq("school_id", schoolId).eq("is_active", true),
    supabaseAdmin.from("dbe_registration").select("email_address, physical_address, contact_number").eq("school_id", schoolId).maybeSingle(),
  ]);
  if (!enquiry || enquiry.enrolment_source !== "printed_blank_form") return NextResponse.json({ error: "Printed blank enrolment application not found." }, { status: 404 });
  return NextResponse.json({ enquiry, school: { ...school, contact_number: registration?.contact_number || school?.contact_number || null, email_address: registration?.email_address || null, physical_address: registration?.physical_address || null }, settings, configuration, fees: fees || [], documents: documents || [], requirements: requirements || [], consents: consents || [], terms: termsWithFees(terms, fees) });
}

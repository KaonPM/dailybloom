import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });

  const authorization = await requireStaffPermission(request, PERMISSIONS.REQUIREMENTS_VIEW, schoolId);
  if (!authorization.ok) return authorization.response;

  const [{ data: requirementTemplates, error: requirementsError }, { data: documentRequirements, error: documentsError }] = await Promise.all([
    supabaseAdmin
      .from("school_enrolment_requirement_templates")
      .select("id, template_key, item_name, quantity, category, is_active")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabaseAdmin
      .from("school_enrolment_document_requirements")
      .select("id, title, is_active")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  if (requirementsError || documentsError) {
    return NextResponse.json({ error: requirementsError?.message || documentsError?.message || "Requirements could not be loaded." }, { status: 400 });
  }

  return NextResponse.json({ requirement_templates: requirementTemplates || [], document_requirements: documentRequirements || [] });
}

import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });

  const authorization = await requireStaffPermission(request, PERMISSIONS.REQUIREMENTS_VIEW, schoolId);
  if (!authorization.ok) return authorization.response;

  const [{ data: requirementTemplates, error: requirementsError }, { data: documentRequirements, error: documentsError }, { data: configuration, error: configurationError }] = await Promise.all([
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
    supabaseAdmin
      .from("school_enrolment_configurations")
      .select("requirement_template_keys")
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  if (requirementsError || documentsError || configurationError) {
    return NextResponse.json({ error: requirementsError?.message || documentsError?.message || configurationError?.message || "Requirements could not be loaded." }, { status: 400 });
  }

  const validKeys = new Set(["0_2", "2_6", "babies", "toddlers", "grade_r"]);
  const selectedTemplateKeys = Array.isArray(configuration?.requirement_template_keys)
    ? configuration.requirement_template_keys.filter((key): key is string => validKeys.has(String(key)))
    : ["0_2", "2_6"];
  return NextResponse.json({ requirement_templates: (requirementTemplates || []).filter((item) => selectedTemplateKeys.includes(item.template_key)), document_requirements: documentRequirements || [], selected_template_keys: selectedTemplateKeys });
}

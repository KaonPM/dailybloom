import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { uniqueWorkbookEditions } from "@/app/lib/grade-r-workbooks";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const schoolId = Number(params.get("school_id") || 0);
  const resourceId = Number(params.get("resource_id") || 0);
  if (!Number.isInteger(schoolId) || schoolId < 1 || (resourceId && (!Number.isInteger(resourceId) || resourceId < 1))) {
    return NextResponse.json({ error: "A valid school and workbook are required." }, { status: 400 });
  }
  const authorization = await requireStaffPermission(request, PERMISSIONS.ACTIVITIES_MANAGE, schoolId || undefined);
  if (!authorization.ok) return authorization.response;
  let query = supabaseAdmin.from("learning_resources").select("*").eq("grade", "Grade R").eq("status", "published").or(`school_id.is.null,school_id.eq.${authorization.staff.schoolId}`);
  if (resourceId) query = query.eq("id", resourceId);
  const [{ data, error }, yearsResult] = await Promise.all([
    query.order("academic_year", { ascending: false }).order("term").order("title"),
    supabaseAdmin.from("learning_resource_years").select("academic_year, grade, is_default, status").eq("grade", "Grade R").order("academic_year", { ascending: false }),
  ]);
  if (error || yearsResult.error) return NextResponse.json({ error: "The workbook catalogue could not be loaded. Please try again later." }, { status: 500 });
  const resources = (data || []).filter((item) => item.resource_type !== "DBE Workbook" || !item.catalogue_status || ["current", "archived"].includes(item.catalogue_status));
  const years = yearsResult.data || [];
  return NextResponse.json({
    resources,
    workbook_resources: uniqueWorkbookEditions(resources.filter((item) => item.resource_type === "DBE Workbook")),
    years,
    default_year: years.find((year) => year.is_default)?.academic_year || resources.find((item) => item.academic_year)?.academic_year || new Date().getFullYear(),
  });
}

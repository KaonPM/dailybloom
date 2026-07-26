import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSchoolId = Number(searchParams.get("school_id") || 0);
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = Math.min(
    50,
    positiveInteger(searchParams.get("page_size"), 10)
  );
  const status = String(searchParams.get("status") || "").trim();
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    requestedSchoolId || null
  );
  if (!authorization.ok) return authorization.response;

  const schoolId = authorization.staff.isPlatformUser
    ? requestedSchoolId
    : Number(authorization.staff.schoolId || 0);
  if (!authorization.staff.isPlatformUser && !schoolId) {
    return NextResponse.json(
      { error: "School context required." },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("school_subscriptions")
    .select(
      "id, school_id, plan_name, monthly_price, status, start_date, first_billing_date, next_billing_date, last_payment_date, created_at, schools(id, school_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (schoolId) query = query.eq("school_id", schoolId);
  if (status) query = query.eq("status", status);

  let summaryQuery = supabaseAdmin
    .from("school_subscriptions")
    .select("monthly_price, status");
  if (schoolId) summaryQuery = summaryQuery.eq("school_id", schoolId);
  if (status) summaryQuery = summaryQuery.eq("status", status);

  const [result, summaryResult] = await Promise.all([query, summaryQuery]);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  if (summaryResult.error) {
    return NextResponse.json(
      { error: summaryResult.error.message },
      { status: 400 }
    );
  }

  const summaryRows = summaryResult.data || [];
  return NextResponse.json({
    subscriptions: result.data || [],
    pagination: {
      page,
      page_size: pageSize,
      total: result.count || 0,
      total_pages: Math.max(1, Math.ceil((result.count || 0) / pageSize)),
    },
    summary: {
      expected_monthly_revenue: summaryRows
        .filter((row) => ["active", "trial"].includes(String(row.status)))
        .reduce((sum, row) => sum + Number(row.monthly_price || 0), 0),
      active_count: summaryRows.filter((row) => row.status === "active").length,
      overdue_count: summaryRows.filter((row) => row.status === "overdue")
        .length,
    },
  });
}

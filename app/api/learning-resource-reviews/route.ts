import { NextResponse } from "next/server";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

async function authorize(request: Request) {
  return requireStaffPermission(request, PERMISSIONS.PLATFORM_DASHBOARD_VIEW);
}

export async function GET(request: Request) {
  const authorization = await authorize(request);
  if (!authorization.ok) return authorization.response;
  const { data, error } = await supabaseAdmin.from("learning_resource_update_reviews").select("*").order("detected_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reviews: data || [] });
}

export async function PATCH(request: Request) {
  const authorization = await authorize(request);
  if (!authorization.ok) return authorization.response;
  const body = await request.json();
  const id = Number(body.id);
  const status = String(body.status);
  if (!id || !["approved", "rejected"].includes(status)) return NextResponse.json({ error: "A review decision is required." }, { status: 400 });
  const { data: review, error: reviewError } = await supabaseAdmin.from("learning_resource_update_reviews").update({ status, reviewed_by: authorization.staff.userId, reviewed_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
  if (reviewError || !review) return NextResponse.json({ error: reviewError?.message || "This review is no longer pending." }, { status: 400 });
  if (status === "approved") {
    const proposed = review.proposed_resource && typeof review.proposed_resource === "object" ? review.proposed_resource : {};
    const { error } = await supabaseAdmin.from("learning_resources").insert({ ...proposed, title: review.title, grade: review.grade, source_name: review.source_name, source_url: review.source_url, academic_year: review.academic_year, status: "published" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await writeSecurityAudit(authorization.staff, `learning_resource.review_${status}`, { review_id: id });
  return NextResponse.json({ success: true });
}

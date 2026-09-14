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
  if (authorization.staff.role !== "master") return NextResponse.json({ error: "Master access is required." }, { status: 403 });
  const { error } = await supabaseAdmin.rpc("review_learning_resource_update", { review_id: id, decision: status, actor: authorization.staff.userId });
  if (error) return NextResponse.json({ error: "This review could not be saved. Refresh the catalogue and try again." }, { status: 400 });
  await writeSecurityAudit(authorization.staff, `learning_resource.review_${status}`, { review_id: id });
  return NextResponse.json({ success: true });
}

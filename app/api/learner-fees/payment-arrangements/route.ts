import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const schoolId = Number(body?.school_id);
  const learnerId = String(body?.learner_id || "");
  const active = body?.active === true;
  if (!schoolId || !learnerId) {
    return NextResponse.json({ error: "School and learner are required." }, { status: 400 });
  }

  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.BILLING_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  const { data, error } = await supabaseAdmin
    .from("learners")
    .update({
      payment_arrangement_active: active,
      payment_arrangement_note: active ? String(body?.note || "").trim() || null : null,
      payment_arrangement_updated_at: new Date().toISOString(),
      payment_arrangement_updated_by: authorization.staff.userId,
    })
    .eq("id", learnerId)
    .eq("school_id", schoolId)
    .select("id, payment_arrangement_active, payment_arrangement_note")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Learner arrangement could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ learner: data });
}

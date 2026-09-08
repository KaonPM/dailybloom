import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { getSchoolComplianceAttention } from "@/app/lib/server-compliance-attention";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id") || 0);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  try { return NextResponse.json({ items: await getSchoolComplianceAttention(schoolId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Compliance attention could not be loaded." }, { status: 500 }); }
}

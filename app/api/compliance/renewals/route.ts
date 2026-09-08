import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { getSchoolRenewals } from "@/app/lib/server-renewals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const schoolId = Number(new URL(request.url).searchParams.get("school_id"));
  if (!Number.isInteger(schoolId) || schoolId <= 0) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  const authorization = await requireStaffPermission(request, PERMISSIONS.DBE_MANAGE, schoolId);
  if (!authorization.ok) return authorization.response;
  try {
    return NextResponse.json(await getSchoolRenewals(schoolId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Renewals could not be loaded." }, { status: 400 });
  }
}

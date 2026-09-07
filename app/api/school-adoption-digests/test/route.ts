import { NextResponse } from "next/server";
import { sendSchoolAdoptionWeeklyDigests } from "@/app/lib/school-adoption-digest";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

export async function POST(request: Request) {
  const authorization = await requireStaffPermission(request, PERMISSIONS.PLATFORM_ANALYTICS_VIEW);
  if (!authorization.ok) return authorization.response;
  const body = await request.json();
  const schoolId = Number(body.school_id);
  if (!schoolId) return NextResponse.json({ error: "A valid school is required." }, { status: 400 });
  try {
    return NextResponse.json({ success: true, ...(await sendSchoolAdoptionWeeklyDigests({ schoolId, test: true })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Test email could not be sent." }, { status: 500 });
  }
}

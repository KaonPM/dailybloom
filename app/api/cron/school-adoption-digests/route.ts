import { NextResponse } from "next/server";
import { sendSchoolAdoptionWeeklyDigests } from "@/app/lib/school-adoption-digest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await sendSchoolAdoptionWeeklyDigests()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "School adoption digest delivery failed." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { johannesburgYearMonth } from "@/app/lib/annual-classroom-rollover";
import { runAutomaticSchoolRollover } from "@/app/lib/server-annual-classroom-rollover";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { year, month } = johannesburgYearMonth();
  if (month !== 1) return NextResponse.json({ success: true, skipped: "Annual classroom rollover runs during January.", academic_year: year });

  try {
    const { data: schools, error } = await supabaseAdmin.from("schools").select("id").eq("is_active", true).eq("status", "active").is("deleted_at", null);
    if (error) throw error;
    const outcomes = [];
    for (const school of schools || []) outcomes.push({ school_id: Number(school.id), ...(await runAutomaticSchoolRollover(Number(school.id), year)) });
    return NextResponse.json({ success: true, academic_year: year, schools_checked: schools?.length || 0, outcomes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Annual classroom rollover failed." }, { status: 500 });
  }
}

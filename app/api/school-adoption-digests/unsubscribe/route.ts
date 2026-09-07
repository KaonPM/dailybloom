import { NextResponse } from "next/server";
import { isValidWeeklyDigestUnsubscribeToken } from "@/app/lib/school-adoption-digest";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user") || "";
  const token = searchParams.get("token") || "";
  if (!userId || !token || !isValidWeeklyDigestUnsubscribeToken(userId, token)) {
    return new NextResponse("This opt-out link is invalid or has expired.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const { error } = await supabaseAdmin.from("profiles").update({ school_adoption_weekly_digest_opt_out: true }).eq("id", userId);
  if (error) return new NextResponse("We could not update your email preference.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  return new NextResponse("You have opted out of weekly school summaries.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { authorizeMessageUser } from "@/app/lib/message-authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const learnerId = String(body.learner_id || "").trim();
    const parentPhone = String(body.parent_phone || "").trim();
    const authorization = await authorizeMessageUser(request, schoolId, parentPhone, learnerId);
    if (!authorization.ok || authorization.kind !== "parent") return authorization.ok ? NextResponse.json({ error: "Parent session required." }, { status: 403 }) : authorization.response;

    if (!schoolId || !learnerId || !parentPhone) {
      return NextResponse.json(
        { error: "Missing school, learner, or parent." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select(
        "id, school_id, learner_id, sender_id, sender_name, recipient_id, recipient_role, message, is_read, created_at"
      )
      .eq("school_id", schoolId)
      .eq("learner_id", learnerId)
      .or(`sender_id.eq.${parentPhone},recipient_id.eq.${parentPhone}`)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ messages: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load parent message summary." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { authorizeMessageUser } from "@/app/lib/message-authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const recipientId = String(body.recipient_id || "").trim();
    const authorization = await authorizeMessageUser(request, schoolId, recipientId);
    if (!authorization.ok) return authorization.response;

    if (!schoolId || !recipientId) {
      return NextResponse.json(
        { error: "Missing school or recipient." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, learner_id")
      .eq("school_id", schoolId)
      .eq("recipient_id", recipientId)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const counts = (data || []).reduce<Record<string, number>>((current, message) => {
      const key = `${message.sender_id || ""}::${message.learner_id || ""}`;
      current[key] = (current[key] || 0) + 1;
      return current;
    }, {});

    return NextResponse.json({
      total: (data || []).length,
      counts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load unread messages." },
      { status: 500 }
    );
  }
}

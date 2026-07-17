import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { authorizeMessageUser } from "@/app/lib/message-authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = Number(body.school_id);
    const currentUserId = String(body.current_user_id || "").trim();
    const contactId = String(body.contact_id || "").trim();
    const learnerId = body.learner_id ? String(body.learner_id) : null;
    const authorization = await authorizeMessageUser(request, schoolId, currentUserId, learnerId);
    if (!authorization.ok) return authorization.response;

    if (!schoolId || !currentUserId || !contactId) {
      return NextResponse.json(
        { error: "Missing school or conversation participants." },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("messages")
      .select("*")
      .eq("school_id", schoolId)
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    if (learnerId) {
      query = query.eq("learner_id", learnerId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const messages = data || [];

    const unreadIds = messages
      .filter(
        (message) =>
          String(message.recipient_id || "") === authorization.userId &&
          message.is_read === false
      )
      .map((message) => message.id);

    if (unreadIds.length > 0) {
      await supabaseAdmin
        .from("messages")
        .update({ is_read: true })
        .in("id", unreadIds);
    }

    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load conversation." },
      { status: 500 }
    );
  }
}

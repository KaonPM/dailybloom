import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { authorizeMessageUser } from "@/app/lib/message-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  isActivePlatformSupportUser,
  isPlatformSupportConversationParticipant,
} from "@/app/lib/platform-support-messaging";

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

    const [currentUserIsSupport, contactIsSupport] = await Promise.all([
      isActivePlatformSupportUser(authorization.userId, PERMISSIONS.MESSAGE_SEND),
      isActivePlatformSupportUser(contactId, PERMISSIONS.MESSAGE_SEND),
    ]);

    if (currentUserIsSupport || contactIsSupport) {
      const isAllowed =
        !learnerId &&
        (await isPlatformSupportConversationParticipant({
          schoolId,
          currentUserId: authorization.userId,
          contactId,
          permission: PERMISSIONS.MESSAGE_SEND,
        }));

      if (!isAllowed) {
        return NextResponse.json(
          {
            error:
              "DailyBloom Support messages are available only between school leadership and authorised Master users.",
          },
          { status: 403 }
        );
      }
    }

    let outgoingQuery = supabaseAdmin
      .from("messages")
      .select("*")
      .eq("school_id", schoolId)
      .eq("sender_id", authorization.userId)
      .eq("recipient_id", contactId);
    let incomingQuery = supabaseAdmin
      .from("messages")
      .select("*")
      .eq("school_id", schoolId)
      .eq("sender_id", contactId)
      .eq("recipient_id", authorization.userId);

    if (learnerId) {
      outgoingQuery = outgoingQuery.eq("learner_id", learnerId);
      incomingQuery = incomingQuery.eq("learner_id", learnerId);
    }

    const [outgoing, incoming] = await Promise.all([
      outgoingQuery.order("created_at", { ascending: true }).limit(200),
      incomingQuery.order("created_at", { ascending: true }).limit(200),
    ]);

    if (outgoing.error || incoming.error) {
      return NextResponse.json(
        { error: outgoing.error?.message || incoming.error?.message },
        { status: 400 }
      );
    }

    const messages = [...(outgoing.data || []), ...(incoming.data || [])]
      .sort((left, right) =>
        String(left.created_at || "").localeCompare(String(right.created_at || ""))
      )
      .slice(-200);

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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load conversation." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { authorizeMessageUser } from "@/app/lib/message-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

async function getSchoolName(schoolId: number) {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("school_name")
    .eq("id", schoolId)
    .single();

  if (error) {
    console.error("Could not load school name for notification:", error.message);
  }

  return data?.school_name || "DailyBloom";
}

async function sendPushNotification({
  schoolId,
  recipientId,
  recipientRole,
  senderName,
  message,
}: {
  schoolId: number;
  recipientId: string;
  recipientRole: string;
  senderName: string;
  message: string;
}) {
  const appId =
    process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey || !recipientId) {
    return;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";
  const destination =
    recipientRole === "parent"
      ? `${siteUrl}/parent/messages`
      : `${siteUrl}/messages`;
  const schoolName = await getSchoolName(schoolId);

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${restApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: {
        external_id: [recipientId],
      },
      headings: {
        en: schoolName,
      },
      contents: {
        en: `${senderName || "DailyBloom"}: ${message}`,
      },
      url: destination,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OneSignal notification failed:", errorText);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = Number(body.school_id);
    const message = String(body.message || "").trim();
    const senderRole = String(body.sender_role || "").trim();
    const senderId = String(body.sender_id || "").trim();
    const recipientRole = String(body.recipient_role || "").trim();
    const recipientId = String(body.recipient_id || "").trim();
    const recipientName = String(body.recipient_name || "").trim();
    const learnerId = body.learner_id ? String(body.learner_id) : null;
    const authorization = await authorizeMessageUser(request, schoolId, senderId, learnerId, PERMISSIONS.MESSAGE_SEND);
    if (!authorization.ok) return authorization.response;

    if (
      !schoolId ||
      !message ||
      !senderRole ||
      !senderId ||
      !recipientRole ||
      !recipientId
    ) {
      return NextResponse.json(
        { error: "Missing message sender, recipient, school, or message text." },
        { status: 400 }
      );
    }

    if (recipientRole === "parent") {
      const { data: linkedParent } = await supabaseAdmin.from("learners").select("id")
        .eq("school_id", schoolId).eq("id", learnerId || "").eq("parent_phone", recipientId).maybeSingle();
      if (!linkedParent) return NextResponse.json({ error: "The selected parent is not linked to this learner and school." }, { status: 403 });
    } else {
      const { data: linkedStaff } = await supabaseAdmin.from("profiles").select("id, role")
        .eq("id", recipientId).eq("school_id", schoolId).in("role", ["teacher", "principal", "admin", "owner"]).maybeSingle();
      if (!linkedStaff) return NextResponse.json({ error: "The selected staff recipient does not belong to this school." }, { status: 403 });
      if (linkedStaff.role === "admin") {
        const { data: messagingMembership } = await supabaseAdmin
          .from("school_memberships")
          .select("user_id")
          .eq("user_id", recipientId)
          .eq("school_id", schoolId)
          .eq("role", "admin")
          .eq("status", "active")
          .contains("permissions", [PERMISSIONS.MESSAGE_VIEW])
          .maybeSingle();
        if (!messagingMembership) {
          return NextResponse.json(
            { error: "This administrator does not have message access." },
            { status: 403 }
          );
        }
      }
    }

    const schoolName = await getSchoolName(schoolId);
    const senderDisplayName =
      authorization.kind === "staff"
        ? authorization.role === "admin"
          ? `${schoolName} Admin`
          : authorization.staffName
        : authorization.parent?.name || "Parent/guardian";

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert([
        {
          school_id: schoolId,
          learner_id: learnerId,
          sender_role: authorization.role,
          sender_id: authorization.userId,
          sender_name: senderDisplayName,
          recipient_role: recipientRole,
          recipient_id: recipientId,
          recipient_name: recipientName || "Recipient",
          message,
          is_read: false,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await sendPushNotification({
      schoolId,
      recipientId,
      recipientRole,
      senderName: senderDisplayName,
      message,
    });

    return NextResponse.json({ message: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send message." },
      { status: 500 }
    );
  }
}

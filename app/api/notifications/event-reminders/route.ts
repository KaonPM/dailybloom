import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

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

async function sendOneSignalPush({
  externalIds,
  title,
  message,
  url,
}: {
  externalIds: string[];
  title: string;
  message: string;
  url: string;
}) {
  const appId =
    process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey || externalIds.length === 0) {
    return;
  }

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
        external_id: externalIds,
      },
      headings: {
        en: title,
      },
      contents: {
        en: message,
      },
      url,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OneSignal notification failed.");
  }
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const tomorrow = getTomorrowDate();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("events")
      .select("id, school_id, title, event_date")
      .eq("event_date", tomorrow);

    if (eventsError) {
      throw eventsError;
    }

    let sent = 0;

    for (const event of events || []) {
      const schoolId = Number(event.school_id);

      if (!schoolId) {
        continue;
      }

      const { data: learners, error: learnersError } = await supabaseAdmin
        .from("learners")
        .select("parent_phone")
        .eq("school_id", schoolId)
        .not("parent_phone", "is", null);

      if (learnersError) {
        throw learnersError;
      }

      const parentPhones = uniqueValues(
        (learners || []).map((learner) => learner.parent_phone)
      );
      const schoolName = await getSchoolName(schoolId);

      await sendOneSignalPush({
        externalIds: parentPhones,
        title: schoolName,
        message: `${event.title || "A school event"} is tomorrow.`,
        url: `${siteUrl}/parent/dashboard`,
      });

      sent += parentPhones.length;
    }

    return NextResponse.json({
      date: tomorrow,
      events: events?.length || 0,
      recipients: sent,
    });
  } catch (error: unknown) {
    console.error("Event reminder notifications failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send event reminders." },
      { status: 500 }
    );
  }
}

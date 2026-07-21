import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { requireStaffPermission, writeSecurityAudit } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

type ParentPushType = "daily_summary" | "broadcast" | "event_reminder" | "incident_report";

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function getParentPhonesForSchool(schoolId: number) {
  const { data, error } = await supabaseAdmin
    .from("learners")
    .select("parent_phone")
    .eq("school_id", schoolId)
    .not("parent_phone", "is", null);

  if (error) {
    throw error;
  }

  return uniqueValues((data || []).map((row) => row.parent_phone));
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
    return { skipped: true };
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

  return { skipped: false };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = String(body.type || "") as ParentPushType;
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(request, PERMISSIONS.PARENT_NOTIFY, schoolId);
    if (!authorization.ok) return authorization.response;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";

    if (!schoolId || !["daily_summary", "broadcast", "event_reminder", "incident_report"].includes(type)) {
      return NextResponse.json(
        { error: "Missing or unsupported parent notification type." },
        { status: 400 }
      );
    }

    let externalIds: string[] = [];
    let title = "DailyBloom";
    let message = "You have a new update.";
    let url = `${siteUrl}/parent/dashboard`;
    const schoolName = await getSchoolName(schoolId);
    const allowedParentPhones = await getParentPhonesForSchool(schoolId);

    if (type === "daily_summary") {
      externalIds = uniqueValues([body.parent_phone]).filter((phone) => allowedParentPhones.includes(phone));
      title = schoolName;
      message = `${body.learner_name || "Your child"} has a new daily summary.`;
    }

    if (type === "broadcast") {
      externalIds = body.parent_phones?.length
        ? uniqueValues(body.parent_phones).filter((phone) => allowedParentPhones.includes(phone))
        : allowedParentPhones;
      title = schoolName;
      message = body.title || body.message || "A new school broadcast is available.";
    }

    if (type === "event_reminder") {
      if (String(body.event_date || "") !== getTomorrowDate()) {
        return NextResponse.json({ skipped: true, reason: "Event is not tomorrow." });
      }

      externalIds = allowedParentPhones;
      title = schoolName;
      message = `${body.title || "A school event"} is tomorrow.`;
    }

    if (type === "incident_report") {
      externalIds = uniqueValues([body.parent_phone]).filter((phone) => allowedParentPhones.includes(phone));
      title = schoolName;
      message = `${body.learner_name || "Your child"} has an incident report ready for acknowledgement.`;
      url = `${siteUrl}/parent/incidents`;
    }

    const result = await sendOneSignalPush({
      externalIds,
      title,
      message,
      url,
    });
    await writeSecurityAudit(authorization.staff, "parent.notification_sent", { school_id: schoolId, type, recipients: externalIds.length });

    return NextResponse.json({
      ...result,
      recipients: externalIds.length,
    });
  } catch (error: unknown) {
    console.error("Parent push notification failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send parent push notification." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const { data: campaigns, error } = await supabase
    .from("payment_reminders")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ message: "No due reminders" });
  }

  const results = [];

  for (const campaign of campaigns) {
    const result = await processCampaign(campaign.id);
    results.push({
      reminder_id: campaign.id,
      ...result,
    });
  }

  return NextResponse.json({
    success: true,
    processed: campaigns.length,
    results,
  });
}

async function processCampaign(reminderId: number) {
  const { data: messages, error } = await supabase
    .from("message_logs")
    .select("*")
    .eq("reminder_id", reminderId)
    .in("status", ["pending", "retry"]);

  if (error) {
    return {
      status: "failed",
      sent: 0,
      failed: 0,
      error: error.message,
    };
  }

  if (!messages || messages.length === 0) {
    return {
      status: "no_messages",
      sent: 0,
      failed: 0,
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const msg of messages) {
    if (msg.sent_at) {
      skippedCount++;
      continue;
    }

    if ((msg.retry_count || 0) >= 3) {
      skippedCount++;
      continue;
    }

    const sent = await sendSMS(msg);

    if (sent) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  const nextStatus =
    failedCount === 0 && sentCount > 0
      ? "completed"
      : sentCount > 0 && failedCount > 0
      ? "processing"
      : "failed";

  await supabase
    .from("payment_reminders")
    .update({
      status: nextStatus,
    })
    .eq("id", reminderId);

  return {
    status: nextStatus,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
  };
}

function sanitizePhone(phone?: string | null) {
  if (!phone) return "";

  let cleaned = phone.replace(/[^\d]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "27" + cleaned.slice(1);
  }

  return cleaned;
}

async function sendSMS(msg: any): Promise<boolean> {
  try {
    const token = await getSmsPortalToken();
    const phone = sanitizePhone(msg.parent_phone);

    if (!phone || phone.length < 10) {
      throw new Error("Invalid phone number");
    }

    const res = await fetch("https://rest.smsportal.com/v1/bulkmessages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            content: msg.message,
            destination: phone,
          },
        ],
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.message || "SMS sending failed");
    }

    await supabase
      .from("message_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result?.batchId || result?.id || null,
        error_message: null,
      })
      .eq("id", msg.id);

    return true;
  } catch (err: any) {
    await supabase
      .from("message_logs")
      .update({
        status: "retry",
        retry_count: (msg.retry_count || 0) + 1,
        error_message: err?.message || "Unknown SMS error",
      })
      .eq("id", msg.id);

    return false;
  }
}

async function getSmsPortalToken() {
  const clientId = process.env.SMSPORTAL_CLIENT_ID;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SMSPortal environment variables");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch("https://rest.smsportal.com/v1/authentication", {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Failed to authenticate SMSPortal");
  }

  return data.token;
}
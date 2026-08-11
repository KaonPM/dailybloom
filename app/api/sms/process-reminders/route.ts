import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordCommunicationNotification } from "@/app/lib/communication-notification-centre";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

type MessageLog = { id: number; parent_phone?: string | null; message?: string | null; retry_count?: number | null };
type BillingPaymentReminder = {
  id: number;
  school_id: number;
  phone_number: string;
  message: string;
  retry_count?: number | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = new Date().toISOString().split("T")[0];

  const [campaignResponse, billingReminderResponse] = await Promise.all([
    supabase
      .from("payment_reminders")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_date", today),
    supabase
      .from("billing_payment_reminders")
      .select("id, school_id, phone_number, message, retry_count")
      .in("status", ["scheduled", "retry"])
      .lte("scheduled_date", today),
  ]);

  if (campaignResponse.error || billingReminderResponse.error) {
    return NextResponse.json(
      {
        error:
          campaignResponse.error?.message || billingReminderResponse.error?.message,
      },
      { status: 500 }
    );
  }

  const campaigns = campaignResponse.data || [];
  const billingReminders =
    (billingReminderResponse.data || []) as BillingPaymentReminder[];

  if (campaigns.length === 0 && billingReminders.length === 0) {
    return NextResponse.json({ message: "No due reminders" });
  }

  const preschoolResults = [];

  for (const campaign of campaigns) {
    const result = await processCampaign(campaign.id, Number(campaign.school_id || 0));
    preschoolResults.push({
      reminder_id: campaign.id,
      ...result,
    });
  }

  const dailyBloomResults = [];
  for (const reminder of billingReminders) {
    const result = await processBillingPaymentReminder(reminder);
    dailyBloomResults.push({ reminder_id: reminder.id, ...result });
  }

  return NextResponse.json({
    success: true,
    processed: campaigns.length + billingReminders.length,
    preschool_fee_reminders: preschoolResults,
    dailybloom_subscription_reminders: dailyBloomResults,
  });
}

async function processCampaign(reminderId: number, schoolId: number) {
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

    const sent = await sendSMS(msg, schoolId);

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

async function sendSMS(msg: MessageLog, schoolId: number): Promise<boolean> {
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

    if (schoolId > 0) {
      await recordCommunicationNotification({
        schoolId,
        channel: "sms",
        communicationType: "learner_fee_payment_reminder",
        sourceType: "message_log",
        sourceId: String(msg.id),
        status: "sent",
        recipientPhone: phone,
        bodyPreview: msg.message,
        providerMessageId: String(result?.batchId || result?.id || "") || null,
        sentAt: new Date().toISOString(),
      });
    }

    return true;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown SMS error";
    await supabase
      .from("message_logs")
      .update({
        status: "retry",
        retry_count: (msg.retry_count || 0) + 1,
        error_message: errorMessage,
      })
      .eq("id", msg.id);

    if (schoolId > 0) {
      await recordCommunicationNotification({
        schoolId,
        channel: "sms",
        communicationType: "learner_fee_payment_reminder",
        sourceType: "message_log",
        sourceId: String(msg.id),
        status: (msg.retry_count || 0) + 1 >= 3 ? "failed" : "retry_scheduled",
        recipientPhone: sanitizePhone(msg.parent_phone),
        bodyPreview: msg.message,
        attemptCount: (msg.retry_count || 0) + 1,
        failedAt: (msg.retry_count || 0) + 1 >= 3 ? new Date().toISOString() : null,
        errorMessage,
      });
    }

    return false;
  }
}

async function processBillingPaymentReminder(
  reminder: BillingPaymentReminder
) {
  if ((reminder.retry_count || 0) >= 3) {
    return { status: "failed", error: "Maximum delivery attempts reached." };
  }

  try {
    const token = await getSmsPortalToken();
    const phone = sanitizePhone(reminder.phone_number);
    if (!phone || phone.length < 10) throw new Error("Invalid phone number");

    const response = await fetch("https://rest.smsportal.com/v1/bulkmessages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [{ content: reminder.message, destination: phone }],
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.message || "SMS sending failed");

    const { error } = await supabase
      .from("billing_payment_reminders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result?.batchId || result?.id || null,
        error_message: null,
      })
      .eq("id", reminder.id);
    if (error) throw error;
    await recordCommunicationNotification({
      schoolId: reminder.school_id,
      channel: "sms",
      communicationType: "dailybloom_subscription_payment_reminder",
      sourceType: "billing_payment_reminder",
      sourceId: String(reminder.id),
      status: "sent",
      recipientPhone: phone,
      bodyPreview: reminder.message,
      providerMessageId: String(result?.batchId || result?.id || "") || null,
      sentAt: new Date().toISOString(),
    });
    return { status: "sent" };
  } catch (error: unknown) {
    const retryCount = (reminder.retry_count || 0) + 1;
    const nextStatus = retryCount >= 3 ? "failed" : "retry";
    const { error: updateError } = await supabase
      .from("billing_payment_reminders")
      .update({
        status: nextStatus,
        retry_count: retryCount,
        error_message:
          error instanceof Error ? error.message : "Unknown SMS error",
      })
      .eq("id", reminder.id);
    if (updateError) throw updateError;
    await recordCommunicationNotification({
      schoolId: reminder.school_id,
      channel: "sms",
      communicationType: "dailybloom_subscription_payment_reminder",
      sourceType: "billing_payment_reminder",
      sourceId: String(reminder.id),
      status: nextStatus === "failed" ? "failed" : "retry_scheduled",
      recipientPhone: sanitizePhone(reminder.phone_number),
      bodyPreview: reminder.message,
      attemptCount: retryCount,
      failedAt: nextStatus === "failed" ? new Date().toISOString() : null,
      errorMessage: error instanceof Error ? error.message : "Unknown SMS error",
    });
    return { status: nextStatus };
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

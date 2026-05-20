import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

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

  for (const campaign of campaigns) {
    await processCampaign(campaign.id);
  }

  return NextResponse.json({ success: true, processed: campaigns.length });
}

async function processCampaign(reminderId: number) {
  const { data: messages } = await supabase
    .from("message_logs")
    .select("*")
    .eq("reminder_id", reminderId)
    .eq("status", "pending");

  if (!messages || messages.length === 0) return;

  for (const msg of messages) {
    await sendSMS(msg.id, msg.parent_phone, msg.message);
  }

  await supabase
    .from("payment_reminders")
    .update({ status: "completed" })
    .eq("id", reminderId);
}

async function sendSMS(logId: string, phone: string, message: string) {
  try {
    const token = await getSmsPortalToken();

    const res = await fetch("https://rest.smsportal.com/v1/bulkmessages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            content: message,
            destination: phone,
          },
        ],
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.message || "SMS failed");
    }

    await supabase
      .from("message_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", logId);
  } catch (err: any) {
    await supabase
      .from("message_logs")
      .update({
        status: "failed",
        error_message: err.message,
      })
      .eq("id", logId);
  }

  async function getSmsPortalToken() {
  const res = await fetch("https://rest.smsportal.com/v1/authentication", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: process.env.SMSPORTAL_CLIENT_ID,
      clientSecret: process.env.SMSPORTAL_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to authenticate SMSPortal");
  }

  const data = await res.json();
  return data.token;
}
}
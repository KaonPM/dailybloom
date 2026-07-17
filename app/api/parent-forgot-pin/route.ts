import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { enforceRateLimit } from "@/app/lib/rate-limit";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendSms } from "@/app/lib/sms-portal";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("27") ? `0${digits.slice(2)}` : digits;
}

const GENERIC_MESSAGE = "If that contact number is linked to DailyBloom, a verification code has been sent by SMS.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(String(body.phone || ""));
  const limited = await enforceRateLimit(request, "parent-forgot-pin", 5, 3600, phone);
  if (limited) return limited;

  if (!/^0\d{9}$/.test(phone)) {
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }

  const { data: rows } = await supabaseAdmin
    .from("parent_access")
    .select("id")
    .eq("phone", phone);

  if (!rows?.length) {
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const rowIds = rows.map((row) => row.id);

  await supabaseAdmin.from("parent_access").update({
    reset_otp_hash: otpHash,
    reset_otp_expires_at: expiresAt,
    reset_otp_attempts: 0,
  }).in("id", rowIds);

  try {
    await sendSms(phone, `DailyBloom Parent Portal verification code: ${otp}. It expires in 10 minutes. Do not share this code.`);
  } catch (error) {
    console.error("Parent PIN reset SMS failed:", error);
    await supabaseAdmin.from("parent_access").update({
      reset_otp_hash: null,
      reset_otp_expires_at: null,
      reset_otp_attempts: 0,
    }).in("id", rowIds);
  }

  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}

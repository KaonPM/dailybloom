import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { enforceRateLimit } from "@/app/lib/rate-limit";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("27") ? `0${digits.slice(2)}` : digits;
}

const INVALID_CODE = "The verification code is invalid or has expired.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(String(body.phone || ""));
  const otp = String(body.otp || "").trim();
  const newPin = String(body.new_pin || "").trim();
  const limited = await enforceRateLimit(request, "parent-pin-reset", 8, 900, phone);
  if (limited) return limited;

  if (!/^0\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: "Your new PIN must contain exactly 4 digits." }, { status: 400 });
  }

  const { data: rows } = await supabaseAdmin
    .from("parent_access")
    .select("id, reset_otp_hash, reset_otp_expires_at, reset_otp_attempts")
    .eq("phone", phone);
  const accessRows = rows ?? [];
  const primary = accessRows[0];
  if (!primary?.reset_otp_hash || !primary.reset_otp_expires_at || new Date(primary.reset_otp_expires_at) <= new Date()) {
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  const rowIds = accessRows.map((row) => row.id);
  const attempts = Number(primary.reset_otp_attempts || 0);
  if (attempts >= 5) {
    await supabaseAdmin.from("parent_access").update({ reset_otp_hash: null, reset_otp_expires_at: null }).in("id", rowIds);
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  const valid = await bcrypt.compare(otp, primary.reset_otp_hash);
  if (!valid) {
    await supabaseAdmin.from("parent_access").update({ reset_otp_attempts: attempts + 1 }).in("id", rowIds);
    return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(newPin, 10);
  const { error } = await supabaseAdmin.from("parent_access").update({
    pin_hash: pinHash,
    must_change_pin: false,
    temporary_pin_expires_at: null,
    failed_login_attempts: 0,
    locked_until: null,
    session_token: null,
    session_token_hash: null,
    session_expires_at: null,
    reset_otp_hash: null,
    reset_otp_expires_at: null,
    reset_otp_attempts: 0,
  }).in("id", rowIds);

  if (error) return NextResponse.json({ error: "Your PIN could not be updated. Please try again." }, { status: 500 });
  return NextResponse.json({ success: true, message: "Your Parent Portal PIN has been updated." });
}

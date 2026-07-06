import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function normalizePhone(phone: string) {
  let clean = phone.replace(/\D/g, "");

  // Convert SA international format to local
  if (clean.startsWith("27")) {
    clean = "0" + clean.slice(2);
  }

  return clean;
}

export async function POST(req: Request) {
  const { phone, pin } = await req.json();
  const cleanPhone = normalizePhone(phone || "");

  if (!cleanPhone || !pin) {
    return NextResponse.json(
      { error: "Contact number and PIN are required" },
      { status: 400 }
    );
  }

  // Fetch ALL rows for this phone (one row per linked child)
  const { data: records, error: fetchError } = await supabase
    .from("parent_access")
    .select(
      "id, phone, pin_hash, failed_login_attempts, locked_until, learner_id"
    )
    .eq("phone", cleanPhone);

  if (fetchError || !records || records.length === 0) {
    return NextResponse.json(
      { error: "Parent not found" },
      { status: 401 }
    );
  }

  // Use the first record as the source of truth for lockout/pin state
  const primary = records[0];
  const rowIds = records.map((r) => r.id);

  if (primary.locked_until && new Date(primary.locked_until) > new Date()) {
    return NextResponse.json(
      { error: "Account temporarily locked. Please try again later." },
      { status: 429 }
    );
  }

  async function registerFailedAttempt() {
    // Re-read the current count right before writing to narrow the race
    // window. NOT fully atomic — under real concurrent requests, two
    // attempts can still both read the same value before either writes.
    // Fine for DailyBloom's current volume; revisit with a Postgres
    // function (atomic increment via RPC) if parent login volume grows.
    const { data: fresh } = await supabase
      .from("parent_access")
      .select("failed_login_attempts")
      .eq("id", primary.id)
      .single();

    const currentAttempts = Number(fresh?.failed_login_attempts ?? 0);
    const attempts = currentAttempts + 1;
    const lockUser = attempts >= MAX_ATTEMPTS;

    await supabase
      .from("parent_access")
      .update({
        failed_login_attempts: lockUser ? 0 : attempts,
        locked_until: lockUser
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
          : null,
      })
      .in("id", rowIds);
  }

  async function resetAttempts() {
    await supabase
      .from("parent_access")
      .update({
        failed_login_attempts: 0,
        locked_until: null,
      })
      .in("id", rowIds);
  }

  // FIRST LOGIN — no pin_hash set yet, expect last 4 digits of phone as temp PIN
  if (!primary.pin_hash) {
    const tempPin = cleanPhone;

    if (pin !== tempPin) {
      await registerFailedAttempt();
      return NextResponse.json(
        { error: "Incorrect temporary PIN" },
        { status: 401 }
      );
    }

    // Short-lived cookie so the create-pin page can verify this phone
    // without trusting a value the client could tamper with
    const cookieStore = await cookies();
    cookieStore.set("parent_pending_phone", cleanPhone, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes to complete PIN creation
    });

    return NextResponse.json({
      needsPinCreation: true,
    });
  }

  // EXISTING LOGIN
  const validPin = await bcrypt.compare(pin, primary.pin_hash);

  if (!validPin) {
    await registerFailedAttempt();
    return NextResponse.json(
      { error: "Incorrect PIN" },
      { status: 401 }
    );
  }

  await resetAttempts();

  // Fetch linked children (deduped, and guarded against malformed IDs)
  const learnerIds = [
    ...new Set(
      records
        .map((r) => r.learner_id)
        .filter((id) => typeof id === "string")
    ),
  ];

  const { data: children, error: childError } = await supabase
    .from("learners")
    .select("*")
    .in("id", learnerIds);

  if (childError || !children || children.length === 0) {
    return NextResponse.json(
      { error: "Could not load children" },
      { status: 500 }
    );
  }

  // Random opaque session token, stored server-side — not a value that can
  // be guessed or forged like a raw phone number, and can be revoked by
  // clearing the column.
  const sessionToken = crypto.randomUUID();

  const { error: sessionError } = await supabase
    .from("parent_access")
    .update({ session_token: sessionToken })
    .in("id", rowIds);

  if (sessionError) {
    return NextResponse.json(
      { error: "Could not create session" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("parent_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    success: true,
    children,
  });
}
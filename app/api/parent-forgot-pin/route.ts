import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePhone(phone: string) {
  let clean = phone.replace(/\D/g, "");

  if (clean.startsWith("27")) {
    clean = "0" + clean.slice(2);
  }

  return clean;
}

export async function POST(req: Request) {
  const { phone } = await req.json();

  const cleanPhone =
    normalizePhone(phone || "");

  if (!cleanPhone) {
    return NextResponse.json(
      { error: "Contact number required" },
      { status: 400 }
    );
  }

  const { data: records } =
    await supabase
      .from("parent_access")
      .select("id")
      .eq(
        "phone",
        cleanPhone
      );

  if (
    !records ||
    records.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Parent account not found"
      },
      { status: 404 }
    );
  }

  const ids =
    records.map(
      (r) => r.id
    );

  const { error } =
    await supabase
      .from("parent_access")
      .update({
        pin_hash: null,
        failed_login_attempts: 0,
        locked_until: null,
        session_token: null,
      })
      .in(
        "id",
        ids
      );

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not reset PIN"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
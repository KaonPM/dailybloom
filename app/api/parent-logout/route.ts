import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const cookieStore = await cookies();

  const sessionToken =
    cookieStore.get(
      "parent_session"
    )?.value;

  if (sessionToken) {
    // Remove token from DB
    await supabase
      .from("parent_access")
      .update({
        session_token: null,
      })
      .eq(
        "session_token",
        sessionToken
      );
  }

  // Delete cookie
  cookieStore.delete(
    "parent_session"
  );

  // Clear temporary create-pin cookie too
  cookieStore.delete(
    "parent_pending_phone"
  );

  return NextResponse.redirect(
    new URL(
      "/parent-login",
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    )
  );
}
import "server-only";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number, subject = "") {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const normalizedSubject = subject.trim().toLowerCase();
  const keys = [
    { key: `${scope}:ip:${ip}`.slice(0, 500), limit: normalizedSubject ? limit * 5 : limit },
    ...(normalizedSubject
      ? [{
          key: `${scope}:subject:${createHash("sha256").update(normalizedSubject).digest("hex")}`,
          limit,
        }]
      : []),
  ];
  const results = await Promise.all(
    keys.map(({ key, limit: keyLimit }) =>
      supabaseAdmin.rpc("consume_api_rate_limit", {
        p_key: key,
        p_limit: keyLimit,
        p_window_seconds: windowSeconds,
      })
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("Rate-limit check failed:", failed.error.message);
    return NextResponse.json(
      { error: "This request cannot be processed safely right now. Please try again later." },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }
  return results.some((result) => result.data === false)
    ? NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(windowSeconds) } }
      )
    : null;
}

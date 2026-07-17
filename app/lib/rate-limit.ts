import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number, subject = "") {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = `${scope}:${ip}:${subject.trim().toLowerCase()}`.slice(0, 500);
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("Rate-limit check failed:", error.message);
    return null;
  }
  return data === false ? NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(windowSeconds) } }) : null;
}

export type ServerErrorEvent = {
  source: "dailybloom-server";
  level: "error";
  occurred_at: string;
  error_id: string;
  digest: string | null;
  message: string;
  method: string;
  path: string;
  route: string;
  route_type: string;
  runtime: string;
  release: string | null;
};

function limit(value: unknown, maximum: number) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maximum);
}

function redactSensitive(value: unknown) {
  return String(value || "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\d\s-]{7,}\d)\b/g, "[redacted-number]");
}

export function isExpectedDynamicUsage(error: Error & { digest?: string }) {
  return (
    error.digest === "DYNAMIC_SERVER_USAGE" ||
    error.message.includes("Dynamic server usage") ||
    error.message.includes("couldn't be rendered statically")
  );
}

export function createServerErrorEvent({
  error,
  request,
  context,
  now = new Date(),
  errorId = crypto.randomUUID(),
}: {
  error: Error & { digest?: string };
  request: { path?: string; method?: string };
  context: { routePath?: string; routeType?: string };
  now?: Date;
  errorId?: string;
}): ServerErrorEvent {
  return {
    source: "dailybloom-server",
    level: "error",
    occurred_at: now.toISOString(),
    error_id: limit(errorId, 80),
    digest: error.digest ? limit(error.digest, 120) : null,
    message: limit(redactSensitive(error.message || "Unexpected server error"), 500),
    method: limit(request.method || "UNKNOWN", 12).toUpperCase(),
    path: limit(String(request.path || "").split("?")[0], 240) || "/",
    route: limit(context.routePath || "unknown", 240),
    route_type: limit(context.routeType || "unknown", 40),
    runtime: limit(process.env.NEXT_RUNTIME || "nodejs", 20),
    release: limit(process.env.VERCEL_GIT_COMMIT_SHA, 80) || null,
  };
}

export async function deliverErrorAlert(event: ServerErrorEvent) {
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch (error) {
    console.warn("[DailyBloom monitoring] Alert delivery failed", {
      error_id: event.error_id,
      reason: error instanceof Error ? error.message : "Unknown delivery error",
    });
    return false;
  }
}

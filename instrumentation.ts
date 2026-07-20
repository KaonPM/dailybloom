import type { Instrumentation } from "next";
import {
  createServerErrorEvent,
  deliverErrorAlert,
  isExpectedDynamicUsage,
} from "./app/lib/error-monitoring";

export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const capturedError =
    error instanceof Error
      ? (error as Error & { digest?: string })
      : new Error(String(error || "Unexpected server error"));

  if (isExpectedDynamicUsage(capturedError)) return;

  const event = createServerErrorEvent({ error: capturedError, request, context });
  console.error("[DailyBloom server error]", JSON.stringify(event));
  await deliverErrorAlert(event);
};

import test from "node:test";
import assert from "node:assert/strict";
import {
  createServerErrorEvent,
  isExpectedDynamicUsage,
} from "./error-monitoring";

test("server error events omit query strings and request headers", () => {
  const event = createServerErrorEvent({
    error: new Error("Database request failed"),
    request: {
      method: "post",
      path: "/api/messages/send?phone=0820000000&learner=secret",
    },
    context: { routePath: "/api/messages/send", routeType: "route" },
    now: new Date("2026-07-20T12:00:00.000Z"),
    errorId: "error-123",
  });

  assert.equal(event.path, "/api/messages/send");
  assert.equal(event.method, "POST");
  assert.equal(event.error_id, "error-123");
  assert.equal("headers" in event, false);
  assert.equal(JSON.stringify(event).includes("0820000000"), false);
});

test("server error fields are bounded for safe log ingestion", () => {
  const event = createServerErrorEvent({
    error: new Error(`Failure\n${"x".repeat(800)}`),
    request: { method: "GET", path: `/${"p".repeat(400)}` },
    context: { routePath: `/${"r".repeat(400)}`, routeType: "render" },
    errorId: "fixed-id",
  });

  assert.equal(event.message.includes("\n"), false);
  assert.equal(event.message.length, 500);
  assert.equal(event.path.length, 240);
  assert.equal(event.route.length, 240);
});

test("common contact details and bearer tokens are redacted from error messages", () => {
  const event = createServerErrorEvent({
    error: new Error(
      "Failed for parent@example.com at 082 123 4567 using Bearer secret-token"
    ),
    request: { method: "POST", path: "/api/example" },
    context: { routePath: "/api/example", routeType: "route" },
    errorId: "fixed-id",
  });

  assert.equal(event.message.includes("parent@example.com"), false);
  assert.equal(event.message.includes("082 123 4567"), false);
  assert.equal(event.message.includes("secret-token"), false);
});

test("expected Next.js dynamic rendering signals are not treated as incidents", () => {
  const dynamicError = Object.assign(new Error("Dynamic server usage"), {
    digest: "DYNAMIC_SERVER_USAGE",
  });
  assert.equal(isExpectedDynamicUsage(dynamicError), true);
  assert.equal(isExpectedDynamicUsage(new Error("Unexpected failure")), false);
});

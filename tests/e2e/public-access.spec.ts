import { expect, test } from "@playwright/test";

test("homepage links to both staff and parent login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "DailyBloom", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "School Login" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Parent Portal" })).toHaveAttribute("href", "/parent-login");
});

test("staff login renders without contacting production data", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  await expect(page.getByPlaceholder("Email Address")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeEnabled();
});

test("parent login exposes PIN recovery and install entry points", async ({ page }) => {
  await page.goto("/parent-login");

  await expect(page.getByText("Parent Portal", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Contact Number")).toBeVisible();
  await expect(page.getByPlaceholder("PIN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot PIN?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install DailyBloom App" })).toBeVisible();
});

test("parent APIs reject requests without a parent session", async ({ request }) => {
  const dashboard = await request.get(
    "/api/parent-dashboard/updates?learner_id=learner-a&school_id=11"
  );
  expect(dashboard.status()).toBe(401);
  await expect(dashboard.json()).resolves.toMatchObject({
    error: "Parent session required.",
  });

  const incidents = await request.get("/api/parent-incidents");
  expect(incidents.status()).toBe(401);
  await expect(incidents.json()).resolves.toMatchObject({
    error: "Parent session required.",
  });
});

test("health endpoint is available without exposing configuration", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = await response.json();
  expect(body).toMatchObject({ status: "ok", service: "dailybloom" });
  expect(body).not.toHaveProperty("environment");
  expect(body).not.toHaveProperty("supabase_url");
});

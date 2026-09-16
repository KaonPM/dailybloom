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

test("pressing Enter submits the staff login form", async ({ page }) => {
  await page.route("https://example.supabase.co/auth/v1/token**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: "staff-test", aud: "authenticated", role: "authenticated", email: "staff@example.test" },
      }),
    });
  });
  await page.route("**/api/auth/profile", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ profile: { id: "staff-test", role: "principal", is_active: true, school_is_active: true } }),
    });
  });

  await page.goto("/login");
  await page.getByPlaceholder("Email Address").fill("staff@example.test");
  await page.getByPlaceholder("Password").fill("password");
  await page.getByPlaceholder("Password").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("pressing Enter submits the parent login form", async ({ page }) => {
  let loginRequests = 0;
  await page.route("**/api/parent-login", async (route) => {
    loginRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ children: [{ id: "learner-test", school_id: 12, name: "Test Learner" }] }),
    });
  });

  await page.goto("/parent-login");
  await page.getByPlaceholder("Contact Number").fill("0712345678");
  await page.getByPlaceholder("PIN").fill("1234");
  await page.getByPlaceholder("PIN").press("Enter");
  await expect(page).toHaveURL(/\/parent\/dashboard$/);
  expect(loginRequests).toBe(1);
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

  const events = await request.get(
    "/api/parent-events?learner_id=learner-a&school_id=11&range=Upcoming&page=0"
  );
  expect(events.status()).toBe(401);
  await expect(events.json()).resolves.toMatchObject({
    error: "Parent session required.",
  });
});

test("scheduled notification APIs fail closed without cron authorization", async ({ request }) => {
  const eventReminders = await request.get("/api/notifications/event-reminders");
  expect(eventReminders.status()).toBe(401);

  const smsReminders = await request.get("/api/sms/process-reminders");
  expect(smsReminders.status()).toBe(401);
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

test("core staff modules return signed-out visitors to login without crashing", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["/dashboard", "/children", "/classrooms", "/attendance", "/payments", "/progress-reports", "/learner-requirements", "/school-documents"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("mobile login pages fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/login", "/parent-login"]) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `${route} should not scroll horizontally`).toBe(false);
  }
});

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseUrl = process.env.E2E_SUPABASE_URL || "";
const anonKey = process.env.E2E_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || "";
const authenticatedE2EEnabled = Boolean(supabaseUrl && anonKey && serviceRoleKey);

const password = "LocalOnly-Phase2-2026!";
const parentPin = "246810";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const principalEmail = `phase2-principal-${runId}@dailybloom.test`;
const teacherEmail = `phase2-teacher-${runId}@dailybloom.test`;
const parentPhone = `079${String(Date.now()).slice(-7)}`;

let admin: SupabaseClient;
let principalId = "";
let teacherId = "";
let schoolId = 0;
let classroomName = "";
let learnerId = "";

test.describe("authenticated role workflows", () => {
  test.skip(
    !authenticatedE2EEnabled,
    "Requires an isolated local Supabase stack and E2E_SUPABASE_* variables."
  );
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: classroom, error: classroomError } = await admin
      .from("classrooms")
      .select("school_id, classroom_name")
      .not("school_id", "is", null)
      .limit(1)
      .single();
    if (classroomError || !classroom?.school_id) {
      throw classroomError || new Error("A restored classroom is required.");
    }

    schoolId = Number(classroom.school_id);
    classroomName = String(classroom.classroom_name || "");

    const { data: learner, error: learnerError } = await admin
      .from("learners")
      .select("id")
      .eq("school_id", schoolId)
      .limit(1)
      .single();
    if (learnerError || !learner?.id) {
      throw learnerError || new Error("A restored learner is required.");
    }
    learnerId = String(learner.id);

    const principal = await admin.auth.admin.createUser({
      email: principalEmail,
      password,
      email_confirm: true,
    });
    if (principal.error || !principal.data.user) throw principal.error;
    principalId = principal.data.user.id;

    const teacher = await admin.auth.admin.createUser({
      email: teacherEmail,
      password,
      email_confirm: true,
    });
    if (teacher.error || !teacher.data.user) throw teacher.error;
    teacherId = teacher.data.user.id;

    const { error: profileError } = await admin.from("profiles").upsert([
      {
        id: principalId,
        email: principalEmail,
        full_name: "Phase 2 Principal",
        school_id: schoolId,
        role: "principal",
        is_active: true,
        must_change_password: false,
      },
      {
        id: teacherId,
        email: teacherEmail,
        full_name: "Phase 2 Teacher",
        school_id: schoolId,
        role: "teacher",
        is_active: true,
        classroom_name: classroomName,
        must_change_password: false,
      },
    ]);
    if (profileError) throw profileError;

    const { error: membershipError } = await admin
      .from("school_memberships")
      .upsert(
        [
          { user_id: principalId, school_id: schoolId, role: "principal", status: "active" },
          { user_id: teacherId, school_id: schoolId, role: "teacher", status: "active" },
        ],
        { onConflict: "user_id,school_id" }
      );
    if (membershipError) throw membershipError;

    const { error: parentError } = await admin.from("parent_access").insert({
      phone: parentPhone,
      school_id: schoolId,
      learner_id: learnerId,
      pin_hash: await bcrypt.hash(parentPin, 10),
      must_change_pin: false,
      failed_login_attempts: 0,
      locked_until: null,
    });
    if (parentError) throw parentError;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin.from("parent_access").delete().eq("phone", parentPhone);
    const userIds = [principalId, teacherId].filter(Boolean);
    if (userIds.length) {
      await admin.from("school_memberships").delete().in("user_id", userIds);
      await admin.from("profiles").delete().in("id", userIds);
    }
    if (principalId) await admin.auth.admin.deleteUser(principalId);
    if (teacherId) await admin.auth.admin.deleteUser(teacherId);
  });

  test("principal signs in and reaches the principal dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email Address").fill(principalEmail);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Principal Dashboard", { exact: true })).toBeVisible();
  });

  test("teacher signs in and reaches the assigned teacher dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email Address").fill(teacherEmail);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/teacher$/);
    await expect(page.getByText("Teacher Dashboard", { exact: true })).toBeVisible();
  });

  test("parent signs in with a PIN and reaches the linked learner dashboard", async ({ page }) => {
    await page.goto("/parent-login");
    await page.getByPlaceholder("Contact Number").fill(parentPhone);
    await page.getByPlaceholder("PIN").fill(parentPin);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/parent\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/^Viewing updates for /)).toBeVisible();
  });
});

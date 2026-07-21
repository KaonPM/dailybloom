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
let otherSchoolId = 0;
let otherLearnerId = "";
let classroomName = "";
let learnerId = "";
let principalToken = "";
let teacherToken = "";

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

    const { data: otherSchool, error: otherSchoolError } = await admin
      .from("schools")
      .select("id")
      .neq("id", schoolId)
      .limit(1)
      .single();
    if (otherSchoolError || !otherSchool?.id) {
      throw otherSchoolError || new Error("A second restored school is required.");
    }
    otherSchoolId = Number(otherSchool.id);

    const { data: otherLearner, error: otherLearnerError } = await admin
      .from("learners")
      .select("id")
      .eq("school_id", otherSchoolId)
      .limit(1)
      .single();
    if (otherLearnerError || !otherLearner?.id) {
      throw otherLearnerError || new Error("A learner from the second school is required.");
    }
    otherLearnerId = String(otherLearner.id);

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

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const principalSession = await authClient.auth.signInWithPassword({
      email: principalEmail,
      password,
    });
    if (principalSession.error || !principalSession.data.session) throw principalSession.error;
    principalToken = principalSession.data.session.access_token;

    const teacherSession = await authClient.auth.signInWithPassword({
      email: teacherEmail,
      password,
    });
    if (teacherSession.error || !teacherSession.data.session) throw teacherSession.error;
    teacherToken = teacherSession.data.session.access_token;
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

    const unrelatedLearnerStatus = await page.evaluate(
      async ({ learnerId: requestedLearnerId, requestedSchoolId }) => {
        const response = await fetch(
          `/api/parent-dashboard/updates?learner_id=${encodeURIComponent(requestedLearnerId)}&school_id=${requestedSchoolId}`,
          { credentials: "same-origin" }
        );
        return response.status;
      },
      { learnerId: otherLearnerId, requestedSchoolId: otherSchoolId }
    );
    expect(unrelatedLearnerStatus).toBe(403);
  });

  test("sensitive staff APIs enforce authentication, permissions, and school isolation", async ({ request }) => {
    const principalHeaders = {
      authorization: `Bearer ${principalToken}`,
      "content-type": "application/json",
    };
    const teacherHeaders = {
      authorization: `Bearer ${teacherToken}`,
      "content-type": "application/json",
    };

    const unauthenticated = await request.post("/api/create-teacher", {
      data: { school_id: schoolId },
    });
    expect(unauthenticated.status()).toBe(401);

    const forgedToken = await request.post("/api/create-teacher", {
      headers: {
        authorization: "Bearer invalid-phase-2-token",
        "content-type": "application/json",
      },
      data: { school_id: schoolId },
    });
    expect(forgedToken.status()).toBe(401);

    const ownSchoolDirectory = await request.post("/api/list-teachers", {
      headers: principalHeaders,
      data: { school_id: schoolId },
    });
    expect(ownSchoolDirectory.status()).toBe(200);

    const crossSchoolDirectory = await request.post("/api/list-teachers", {
      headers: principalHeaders,
      data: { school_id: otherSchoolId },
    });
    expect(crossSchoolDirectory.status()).toBe(403);

    const teacherCreatesStaff = await request.post("/api/create-teacher", {
      headers: teacherHeaders,
      data: { school_id: schoolId },
    });
    expect(teacherCreatesStaff.status()).toBe(403);

    const principalCreatesCrossSchoolStaff = await request.post("/api/create-teacher", {
      headers: principalHeaders,
      data: { school_id: otherSchoolId },
    });
    expect(principalCreatesCrossSchoolStaff.status()).toBe(403);

    const principalCreatesPlatformPrincipal = await request.post("/api/create-principal", {
      headers: principalHeaders,
      data: { schoolId },
    });
    expect(principalCreatesPlatformPrincipal.status()).toBe(403);

    const principalApprovesSchool = await request.post("/api/approve-signup", {
      headers: principalHeaders,
      data: {},
    });
    expect(principalApprovesSchool.status()).toBe(403);

    const teacherManagesBilling = await request.post("/api/payment-received", {
      headers: teacherHeaders,
      data: { school_id: schoolId },
    });
    expect(teacherManagesBilling.status()).toBe(403);

    const teacherUploadsLearnerDocument = await request.post(
      "/api/learner-requirements/documents",
      {
        headers: { authorization: `Bearer ${teacherToken}` },
        multipart: {
          school_id: String(schoolId),
          classroom_id: classroomName,
          learner_id: learnerId,
          document_type: "Phase 2 authorization probe",
        },
      }
    );
    expect(teacherUploadsLearnerDocument.status()).toBe(403);

    const teacherImpersonatesPrincipal = await request.post("/api/messages/send", {
      headers: teacherHeaders,
      data: {
        school_id: schoolId,
        learner_id: learnerId,
        sender_role: "principal",
        sender_id: principalId,
        sender_name: "Phase 2 Principal",
        recipient_role: "teacher",
        recipient_id: teacherId,
        recipient_name: "Phase 2 Teacher",
        message: "Authorization probe",
      },
    });
    expect(teacherImpersonatesPrincipal.status()).toBe(403);
  });
});

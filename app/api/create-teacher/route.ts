import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendLoginEmail } from "../../lib/send-login-email";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const schoolId = Number(body.school_id);
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const classroomName = String(body.classroom_name || "").trim();
    const authorization = await requireStaffPermission(request, PERMISSIONS.STAFF_MANAGE, schoolId);
    if (!authorization.ok) return authorization.response;

    const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!schoolId || !fullName || !email || !password) {
      return NextResponse.json(
        { error: "Please complete practitioner name, email, password, and school." },
        { status: 400 }
      );
    }

    if (!strongPasswordRegex.test(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters and include letters, numbers, and a special character.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase service role key." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id, email, school_id, role, is_active")
      .eq("email", email)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json({ error: profileLookupError.message }, { status: 400 });
    }

    if (existingProfile && existingProfile.role !== "teacher") {
      return NextResponse.json(
        { error: "This email belongs to a different DailyBloom role and cannot be used for a practitioner." },
        { status: 400 }
      );
    }

    if (existingProfile && existingProfile.is_active !== false && Number(existingProfile.school_id) === schoolId) {
      return NextResponse.json(
        { error: "This practitioner is already active at this school. Use Edit Practitioner to update their details." },
        { status: 400 }
      );
    }

    if (existingProfile && existingProfile.is_active !== false && existingProfile.school_id) {
      return NextResponse.json(
        {
          error:
            "This practitioner is still active at another school. Remove them from that school first, then add them here.",
        },
        { status: 400 }
      );
    }

    let userId = existingProfile?.id || "";
    let createdNewUser = false;

    if (userId) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "teacher" },
      });

      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
      }
    } else {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "teacher" },
      });

      if (authData.user) {
        userId = authData.user.id;
        createdNewUser = true;
      } else if (authError?.message.toLowerCase().includes("already been registered")) {
        let existingAuthUser = null;
        let page = 1;

        while (page <= 100) {
          const { data, error: lookupError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

          if (lookupError) {
            return NextResponse.json({ error: lookupError.message }, { status: 400 });
          }

          existingAuthUser =
            data.users.find(
              (candidate) => String(candidate.email || "").trim().toLowerCase() === email
            ) || null;

          if (existingAuthUser || !data.nextPage) break;
          page = data.nextPage;
        }

        if (!existingAuthUser) {
          return NextResponse.json(
            { error: "Could not find the existing practitioner login." },
            { status: 400 }
          );
        }

        const existingAuthRole = String(existingAuthUser.user_metadata?.role || "").trim();
        if (existingAuthRole && existingAuthRole !== "teacher") {
          return NextResponse.json(
            { error: "This email belongs to a different DailyBloom role and cannot be used for a practitioner." },
            { status: 400 }
          );
        }

        userId = existingAuthUser.id;
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "teacher" },
        });

        if (authUpdateError) {
          return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
        }
      } else {
        return NextResponse.json(
          { error: authError?.message || "Could not create practitioner login." },
          { status: 400 }
        );
      }
    }

    const { data: activeMemberships, error: membershipLookupError } = await admin
      .from("school_memberships")
      .select("school_id")
      .eq("user_id", userId)
      .eq("status", "active");

    if (membershipLookupError) {
      return NextResponse.json({ error: membershipLookupError.message }, { status: 400 });
    }

    const membershipsAtOtherSchools = (activeMemberships || []).filter(
      (membership) => Number(membership.school_id) !== schoolId
    );

    if (membershipsAtOtherSchools.length > 0 && existingProfile?.is_active !== false) {
      return NextResponse.json(
        {
          error:
            "This practitioner is still active at another school. Remove them from that school first, then add them here.",
        },
        { status: 400 }
      );
    }

    if (membershipsAtOtherSchools.length > 0) {
      const { error: revokeError } = await admin
        .from("school_memberships")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");

      if (revokeError) {
        return NextResponse.json({ error: revokeError.message }, { status: 400 });
      }
    }

    const profileValues = {
      school_id: schoolId,
      full_name: fullName,
      email,
      role: "teacher",
      classroom_id: null,
      classroom_name: classroomName || null,
      is_active: true,
      must_change_password: true,
    };

    const profileWrite = existingProfile
      ? await admin.from("profiles").update(profileValues).eq("id", userId)
      : await admin.from("profiles").insert([{ id: userId, ...profileValues }]);

    if (profileWrite.error) {
      if (createdNewUser) await admin.auth.admin.deleteUser(userId);

      return NextResponse.json({ error: profileWrite.error.message }, { status: 400 });
    }

    const { error: membershipError } = await admin.from("school_memberships").upsert(
      {
        user_id: userId,
        school_id: schoolId,
        role: "teacher",
        status: "active",
        permissions: [],
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,school_id" }
    );

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    await sendLoginEmail({
      toEmail: email,
      fullName,
      temporaryPassword: password,
      roleLabel: "practitioner",
    });

    const reassigned = Boolean(existingProfile) || !createdNewUser;
    await writeSecurityAudit(authorization.staff, reassigned ? "teacher.reassigned" : "teacher.created", {
      teacher_id: userId,
      school_id: schoolId,
    });

    return NextResponse.json({
      success: true,
      message: reassigned
        ? "Practitioner reassigned successfully. A new temporary login has been emailed."
        : "Practitioner created successfully. Login email sent.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create practitioner." },
      { status: 500 }
    );
  }
}

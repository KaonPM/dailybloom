import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, school_id } = body;
    const authorization = await requireStaffPermission(request, PERMISSIONS.PRINCIPAL_MANAGE, Number(school_id));
    if (!authorization.ok) return authorization.response;

    if (!full_name || !email || !school_id) {
      return NextResponse.json(
        { error: "full_name, email and school_id are required" },
        { status: 400 }
      );
    }

    const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za/"}/login`,
      data: {
        full_name,
        role: "principal",
        school_id: Number(school_id),
      },
    });

    if (inviteResult.error) {
      return NextResponse.json(
        { error: inviteResult.error.message },
        { status: 400 }
      );
    }

    const invitedUserId = inviteResult.data.user?.id;

    if (invitedUserId) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          [
            {
              id: invitedUserId,
              full_name,
              email,
              role: "principal",
              school_id: Number(school_id),
              approval_status: "approved",
            },
          ],
          { onConflict: "id" }
        );

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 400 }
        );
      }
      await supabaseAdmin.from("school_memberships").upsert({ user_id: invitedUserId, school_id: Number(school_id), role: "principal", status: "invited", invited_by: authorization.staff.userId, invited_at: new Date().toISOString() }, { onConflict: "user_id,school_id" });
    }

    await writeSecurityAudit(authorization.staff, "principal.invited", { principal_id: invitedUserId, school_id: Number(school_id) });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

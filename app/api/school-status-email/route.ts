import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { schoolId, status } = await request.json();
    const authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_STATUS, Number(schoolId));
    if (!authorization.ok) return authorization.response;

    if (!schoolId || !status) {
      return NextResponse.json(
        { error: "Missing schoolId or status" },
        { status: 400 }
      );
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("school_name")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    const { data: principal, error: principalError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("school_id", schoolId)
      .eq("role", "principal")
      .single();

    if (principalError || !principal?.email) {
      return NextResponse.json(
        { error: "Principal email not found" },
        { status: 404 }
      );
    }

    const schoolName = school.school_name || "your school";

    let subject = "";
    let message = "";

    if (status === "suspended") {
      subject = "DailyBloom account temporarily suspended";
      message = `Your DailyBloom school account for ${schoolName} has been temporarily suspended. Please contact DailyBloom to restore access.`;
    } else if (status === "inactive") {
      subject = "DailyBloom subscription inactive";
      message = `Your DailyBloom subscription for ${schoolName} has been marked inactive. Please contact DailyBloom if you would like to reactivate your school account.`;
    } else if (status === "active") {
      subject = "DailyBloom account reactivated";
      message = `Your DailyBloom school account for ${schoolName} has been reactivated. You may now continue using DailyBloom.`;
    } else {
      return NextResponse.json(
        { error: "Invalid school status" },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: "DailyBloom <onboarding@resend.dev>",
      to: principal.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #2D2A3E;">
          <h2>${subject}</h2>
          <p>Dear ${principal.full_name || "Principal"},</p>
          <p>${message}</p>
          <p>
            If you believe this is an error, please contact DailyBloom support.
          </p>
          <p style="margin-top: 24px;">
            Kind regards,<br />
            DailyBloom Team
          </p>
        </div>
      `,
    });
    await writeSecurityAudit(authorization.staff, "school.status_email_sent", { school_id: Number(schoolId), status });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send school status email" },
      { status: 500 }
    );
  }
}

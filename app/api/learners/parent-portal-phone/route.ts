import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

function normalizeSouthAfricanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^27\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const schoolId = Number(body.school_id);
  const learnerId = String(body.learner_id || "").trim();
  const newPhone = normalizeSouthAfricanPhone(String(body.phone || ""));
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.PARENT_ACCESS_MANAGE,
    schoolId
  );
  if (!authorization.ok) return authorization.response;

  if (!learnerId || !newPhone) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit South African mobile number." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "change_learner_parent_portal_phone",
    {
      p_school_id: schoolId,
      p_learner_id: learnerId,
      p_new_phone: newPhone,
    }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = Array.isArray(data) ? data[0] : data;
  await writeSecurityAudit(
    authorization.staff,
    "learner.parent_portal_phone_changed",
    {
      learner_id: learnerId,
      old_phone: result?.old_phone || null,
      new_phone: newPhone,
    }
  );
  return NextResponse.json({
    phone: newPhone,
    message:
      "Parent Portal phone number updated. Existing sessions for this learner were signed out.",
  });
}

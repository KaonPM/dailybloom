import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

export const runtime = "nodejs";

const BUCKET = "school-logos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  const form = await request.formData();
  const schoolId = Number(form.get("school_id"));
  const file = form.get("file");
  const authorization = await requireStaffPermission(
    request,
    PERMISSIONS.SCHOOL_MANAGE,
    schoolId
  );

  if (!authorization.ok) return authorization.response;
  if (!schoolId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Select a school and logo file." },
      { status: 400 }
    );
  }

  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Upload a JPG, PNG or WebP logo no larger than 5 MB." },
      { status: 400 }
    );
  }

  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const filePath = `school-${schoolId}/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
  const { error: updateError } = await supabaseAdmin
    .from("schools")
    .update({ logo_url: data.publicUrl })
    .eq("id", schoolId);

  if (updateError) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await writeSecurityAudit(authorization.staff, "school.logo_updated", {
    school_id: schoolId,
  });
  return NextResponse.json({ success: true, logo_url: data.publicUrl });
}

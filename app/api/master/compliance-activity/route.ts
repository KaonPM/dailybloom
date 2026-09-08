import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { complianceAuditPresentation } from "@/app/lib/compliance-audit";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const pageSize = 30;

export async function GET(request: Request) {
  const authorization = await requireStaffPermission(request, PERMISSIONS.PLATFORM_REPORTS_VIEW);
  if (!authorization.ok || !authorization.staff.isPlatformUser) return authorization.ok ? NextResponse.json({ error: "Master access required." }, { status: 403 }) : authorization.response;
  const params = new URL(request.url).searchParams; const page = Math.max(Number(params.get("page") || 0), 0);
  let query = supabaseAdmin.from("security_audit_log").select("actor_name, actor_role, school_id, action, target_type, created_at", { count: "exact" }).or("action.like.dbe.%,action.like.compliance.%").order("created_at", { ascending: false });
  const schoolId = Number(params.get("school_id") || 0); if (schoolId) query = query.eq("school_id", schoolId);
  const actor = String(params.get("actor") || "").trim(); if (actor) query = query.ilike("actor_name", `%${actor.slice(0, 100)}%`);
  const from = String(params.get("from") || ""); if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  const to = String(params.get("to") || ""); if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  const module = String(params.get("module") || "");
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const filtered = (data || []).map((item) => ({ ...item, presentation: complianceAuditPresentation(item.action) })).filter((item) => item.presentation && (!module || item.presentation.module === module));
  const schoolIds = [...new Set(filtered.map((item) => item.school_id).filter((id): id is number => typeof id === "number"))];
  const [schools, schoolOptions] = await Promise.all([
    schoolIds.length ? supabaseAdmin.from("schools").select("id, school_name").in("id", schoolIds) : Promise.resolve({ data: [] as Array<{ id: number; school_name: string }> }),
    supabaseAdmin.from("schools").select("id, school_name").order("school_name").limit(500),
  ]);
  const schoolNames = new Map((schools.data || []).map((school) => [school.id, school.school_name]));
  return NextResponse.json({ items: filtered.map((item) => ({ created_at: item.created_at, school_id: item.school_id, school_name: item.school_id ? schoolNames.get(item.school_id) || "School" : "Platform", actor_name: item.actor_name || "System", actor_role: item.actor_role || "System", action: item.action, action_label: item.presentation!.label, module: item.presentation!.module, target_type: item.target_type || null })), schools: schoolOptions.data || [], page, has_more: (count || 0) > (page + 1) * pageSize });
}

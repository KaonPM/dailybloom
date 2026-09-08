import { NextResponse } from "next/server";
import { getSchoolComplianceAttention } from "@/app/lib/server-compliance-attention";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

function isMilestone(item: { type: string; days_until_due: number | null; days_overdue: number | null }) {
  if (item.type === "corrective_action_verification") return true;
  if (item.days_overdue !== null) return item.days_overdue === 1;
  return item.days_until_due !== null && [30, 7, 1, 0].includes(item.days_until_due);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { data: schools, error } = await supabaseAdmin.from("schools").select("id");
    if (error) throw error;
    let created = 0;
    for (const school of schools || []) {
      const items = await getSchoolComplianceAttention(Number(school.id));
      for (const item of items.filter(isMilestone)) {
        const { error: upsertError } = await supabaseAdmin.from("communication_notifications").upsert({
          school_id: item.school_id, channel: "in_app", communication_type: "Compliance", direction: "system", source_type: "compliance_attention", source_id: item.key,
          subject: item.title, body_preview: item.description, status: "sent", sent_at: new Date().toISOString(), recipient_count: 0,
          metadata: { category: "Compliance", severity: item.severity, action_url: item.action_url, action_label: item.action_label, recipient_roles: item.recipient_roles },
        }, { onConflict: "source_type,source_id,channel", ignoreDuplicates: true });
        if (upsertError) throw upsertError;
        created += 1;
      }
    }
    return NextResponse.json({ schools: schools?.length || 0, evaluated: true, notifications_created_or_existing: created });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Compliance attention evaluation failed." }, { status: 500 }); }
}

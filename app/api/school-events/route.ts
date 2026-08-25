import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PERMISSIONS } from "../../lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";

type EventAction = "create" | "update" | "delete";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const action = String(body.action || "") as EventAction;
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.EVENTS_MANAGE,
      schoolId
    );

    if (!authorization.ok) return authorization.response;
    if (!schoolId || !["create", "update", "delete"].includes(action)) {
      return NextResponse.json({ error: "School and a valid event action are required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase server keys." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const eventId = Number(body.event_id);
    if (action === "delete") {
      if (!eventId) return NextResponse.json({ error: "Event is required." }, { status: 400 });
      const { error } = await admin.from("events").delete().eq("id", eventId).eq("school_id", schoolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await writeSecurityAudit(authorization.staff, "school_event.deleted", { event_id: eventId });
      return NextResponse.json({ success: true });
    }

    const eventDate = String(body.event_date || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim() || null;
    if (!eventDate || !title) {
      return NextResponse.json({ error: "Event date and title are required." }, { status: 400 });
    }

    if (action === "update") {
      if (!eventId) return NextResponse.json({ error: "Event is required." }, { status: 400 });
      const { error } = await admin
        .from("events")
        .update({ event_date: eventDate, title, description })
        .eq("id", eventId)
        .eq("school_id", schoolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await writeSecurityAudit(authorization.staff, "school_event.updated", { event_id: eventId });
      return NextResponse.json({ success: true });
    }

    const { data, error } = await admin
      .from("events")
      .insert({ school_id: schoolId, event_date: eventDate, title, description })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, "school_event.created", { event_id: data.id });
    return NextResponse.json({ success: true, event_id: data.id });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save school event." },
      { status: 500 }
    );
  }
}

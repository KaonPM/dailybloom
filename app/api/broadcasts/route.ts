import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  AuthorizedStaff,
  requireStaffPermission,
  writeSecurityAudit,
} from "@/app/lib/server-authorization";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecipientScope = "school" | "classroom";

type Classroom = {
  id: number;
  classroom_name?: string | null;
};

type LearnerRecipient = {
  id: string;
  name?: string | null;
  parent_phone?: string | null;
  classroom_id?: number | null;
};

type BroadcastRecord = {
  id: number;
  school_id: number;
  title?: string | null;
  message?: string | null;
  audience?: string | null;
  recipient_scope?: string | null;
  classroom_id?: number | null;
  classroom_name?: string | null;
  recipient_count?: number | null;
  status?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => String(value || "").trim()).filter(Boolean)
    ),
  ];
}

function isPractitioner(staff: AuthorizedStaff) {
  return ["teacher", "practitioner", "educator"].includes(
    String(staff.role || "").toLocaleLowerCase()
  );
}

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase();
}

function dateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function asRecipientScope(value: unknown): RecipientScope {
  return value === "classroom" ? "classroom" : "school";
}

async function getSchoolClassrooms(schoolId: number) {
  const { data, error } = await supabaseAdmin
    .from("classrooms")
    .select("id, classroom_name")
    .eq("school_id", schoolId)
    .order("classroom_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as Classroom[];
}

function assignedClassroom(staff: AuthorizedStaff, classrooms: Classroom[]) {
  const assignedClassroomId = Number(staff.profile.classroom_id || 0);
  const classroomById = classrooms.find(
    (classroom) => Number(classroom.id) === assignedClassroomId
  );

  if (classroomById) {
    return classroomById;
  }

  const assignedName = normalise(staff.profile.classroom_name);
  return classrooms.find(
    (classroom) => normalise(classroom.classroom_name) === assignedName
  );
}

async function getSchoolName(schoolId: number) {
  const { data } = await supabaseAdmin
    .from("schools")
    .select("school_name")
    .eq("id", schoolId)
    .maybeSingle();

  return String(data?.school_name || "DailyBloom");
}

async function getRecipients(
  schoolId: number,
  recipientScope: RecipientScope,
  classroomId: number | null
) {
  let query = supabaseAdmin
    .from("learners")
    .select("id, name, parent_phone, classroom_id")
    .eq("school_id", schoolId);

  if (recipientScope === "classroom" && classroomId) {
    query = query.eq("classroom_id", classroomId);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as LearnerRecipient[];
}

async function sendParentPush(
  schoolName: string,
  title: string,
  message: string,
  parentPhones: string[]
) {
  const appId =
    process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey || parentPhones.length === 0) {
    return { sent: false, skipped: true };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za";
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${restApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: parentPhones },
      headings: { en: schoolName },
      contents: { en: title || message || "A new broadcast is available." },
      url: `${siteUrl}/parent/dashboard`,
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "OneSignal notification failed.");
  }

  return { sent: true, skipped: false };
}

async function deliverBroadcast({
  schoolId,
  title,
  message,
  recipients,
}: {
  schoolId: number;
  title: string;
  message: string;
  recipients: LearnerRecipient[];
}) {
  const recipientsWithPhones = recipients.filter((recipient) =>
    String(recipient.parent_phone || "").trim()
  );
  const parentPhones = uniqueValues(
    recipientsWithPhones.map((recipient) => recipient.parent_phone)
  );

  if (parentPhones.length === 0) {
    throw new Error("No parent phone numbers were found for this audience.");
  }

  const communicationRows = recipientsWithPhones.map((recipient) => ({
    school_id: schoolId,
    learner_name: recipient.name || null,
    parent_phone: recipient.parent_phone || null,
    communication_type: "Broadcast",
    message,
    status: "Sent",
    sent_date: dateOnly(),
  }));

  const { error: communicationError } = await supabaseAdmin
    .from("communications")
    .insert(communicationRows);

  if (communicationError) {
    throw communicationError;
  }

  try {
    await sendParentPush(await getSchoolName(schoolId), title, message, parentPhones);
  } catch (pushError) {
    // The broadcast and parent dashboard update remain available even if a
    // device has not subscribed to push notifications or the provider fails.
    console.error("Could not send broadcast push notification:", pushError);
  }

  return parentPhones.length;
}

function jsonError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = Number(searchParams.get("school_id"));
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BROADCASTS_MANAGE,
      schoolId
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    if (!schoolId) {
      return NextResponse.json({ error: "School context is required." }, { status: 400 });
    }

    const classrooms = await getSchoolClassrooms(schoolId);
    const practitionerClassroom = isPractitioner(authorization.staff)
      ? assignedClassroom(authorization.staff, classrooms)
      : null;
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");

    let query = supabaseAdmin
      .from("broadcasts")
      .select(
        "id, school_id, title, message, audience, recipient_scope, classroom_id, classroom_name, recipient_count, status, created_at, created_by, created_by_name"
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (isPractitioner(authorization.staff)) {
      query = practitionerClassroom
        ? query.or(
            `recipient_scope.eq.school,classroom_id.eq.${Number(
              practitionerClassroom.id
            )}`
          )
        : query.eq("recipient_scope", "school");
    }

    if (isIsoDate(fromDate)) {
      query = query.gte("created_at", `${fromDate} 00:00:00`);
    }

    if (isIsoDate(toDate)) {
      query = query.lte("created_at", `${toDate} 23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({
      broadcasts: (data || []) as BroadcastRecord[],
      is_practitioner: isPractitioner(authorization.staff),
      assigned_classroom: practitionerClassroom || null,
      classrooms: isPractitioner(authorization.staff) ? [] : classrooms,
    });
  } catch (error: unknown) {
    console.error("Could not load broadcasts:", error);
    return jsonError(error, "Could not load broadcasts.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BROADCASTS_MANAGE,
      schoolId
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const status = body.status === "draft" ? "draft" : "sent";

    if (!schoolId || !title || !message) {
      return NextResponse.json(
        { error: "A school, title and message are required." },
        { status: 400 }
      );
    }

    const classrooms = await getSchoolClassrooms(schoolId);
    const practitionerClassroom = isPractitioner(authorization.staff)
      ? assignedClassroom(authorization.staff, classrooms)
      : null;
    let recipientScope = asRecipientScope(body.recipient_scope);
    let classroom: Classroom | undefined;

    if (isPractitioner(authorization.staff)) {
      if (!practitionerClassroom) {
        return NextResponse.json(
          { error: "A classroom assignment is required before you can send a class broadcast." },
          { status: 400 }
        );
      }

      recipientScope = "classroom";
      classroom = practitionerClassroom;
    } else if (recipientScope === "classroom") {
      const requestedClassroomId = Number(body.classroom_id);
      classroom = classrooms.find(
        (candidate) => Number(candidate.id) === requestedClassroomId
      );

      if (!classroom) {
        return NextResponse.json(
          { error: "Choose a classroom in this school." },
          { status: 400 }
        );
      }
    }

    const recipients = await getRecipients(
      schoolId,
      recipientScope,
      classroom ? Number(classroom.id) : null
    );
    const recipientCount = uniqueValues(
      recipients.map((recipient) => recipient.parent_phone)
    ).length;

    if (status === "sent" && recipientCount === 0) {
      return NextResponse.json(
        { error: "No parent phone numbers were found for this audience." },
        { status: 400 }
      );
    }

    const audience =
      recipientScope === "classroom"
        ? `${classroom?.classroom_name || "Classroom"} parents`
        : "All school parents";
    // A sent broadcast starts as a draft while its communication records are
    // being created. If delivery fails, the draft remains available to retry
    // instead of appearing as sent when parents did not receive it.
    const { data: createdBroadcast, error: insertError } = await supabaseAdmin
      .from("broadcasts")
      .insert({
        school_id: schoolId,
        title,
        message,
        audience,
        recipient_scope: recipientScope,
        classroom_id: classroom ? Number(classroom.id) : null,
        classroom_name: classroom?.classroom_name || null,
        recipient_count: recipientCount,
        status: "draft",
        created_by: authorization.staff.userId,
        created_by_name:
          authorization.staff.profile.full_name || authorization.staff.profile.email || null,
      })
      .select(
        "id, school_id, title, message, audience, recipient_scope, classroom_id, classroom_name, recipient_count, status, created_at, created_by, created_by_name"
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    let broadcast = createdBroadcast as BroadcastRecord;
    let deliveredRecipients = 0;
    if (status === "sent") {
      deliveredRecipients = await deliverBroadcast({
        schoolId,
        title,
        message,
        recipients,
      });

      const { data: sentBroadcast, error: sentError } = await supabaseAdmin
        .from("broadcasts")
        .update({ status: "sent", recipient_count: deliveredRecipients })
        .eq("id", broadcast.id)
        .eq("school_id", schoolId)
        .select(
          "id, school_id, title, message, audience, recipient_scope, classroom_id, classroom_name, recipient_count, status, created_at, created_by, created_by_name"
        )
        .single();

      if (sentError) {
        throw sentError;
      }

      broadcast = sentBroadcast as BroadcastRecord;
    }

    await writeSecurityAudit(
      authorization.staff,
      status === "sent" ? "broadcast.sent" : "broadcast.draft_created",
      {
        broadcast_id: broadcast.id,
        recipient_scope: recipientScope,
        classroom_id: classroom?.id || null,
        recipient_count: status === "sent" ? deliveredRecipients : recipientCount,
      }
    );

    return NextResponse.json({
      broadcast,
      recipients: status === "sent" ? deliveredRecipients : recipientCount,
    });
  } catch (error: unknown) {
    console.error("Could not create broadcast:", error);
    return jsonError(error, "Could not create broadcast.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const broadcastId = Number(body.broadcast_id);
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.BROADCASTS_MANAGE,
      schoolId
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    if (!schoolId || !broadcastId) {
      return NextResponse.json(
        { error: "A school and broadcast are required." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("broadcasts")
      .select(
        "id, school_id, title, message, audience, recipient_scope, classroom_id, classroom_name, recipient_count, status, created_at, created_by, created_by_name"
      )
      .eq("id", broadcastId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
    }

    const broadcast = existing as BroadcastRecord;
    if (broadcast.status !== "draft") {
      return NextResponse.json(
        { error: "Only a draft broadcast can be sent." },
        { status: 400 }
      );
    }

    const classrooms = await getSchoolClassrooms(schoolId);
    const practitionerClassroom = isPractitioner(authorization.staff)
      ? assignedClassroom(authorization.staff, classrooms)
      : null;

    if (isPractitioner(authorization.staff)) {
      const canSendClassDraft =
        practitionerClassroom &&
        asRecipientScope(broadcast.recipient_scope) === "classroom" &&
        Number(broadcast.classroom_id) === Number(practitionerClassroom.id) &&
        String(broadcast.created_by || "") === authorization.staff.userId;

      if (!canSendClassDraft) {
        return NextResponse.json(
          { error: "You can only send drafts created for your assigned classroom." },
          { status: 403 }
        );
      }
    }

    const recipientScope = asRecipientScope(broadcast.recipient_scope);
    const recipients = await getRecipients(
      schoolId,
      recipientScope,
      recipientScope === "classroom" ? Number(broadcast.classroom_id) : null
    );
    const recipientCount = uniqueValues(
      recipients.map((recipient) => recipient.parent_phone)
    ).length;

    if (recipientCount === 0) {
      return NextResponse.json(
        { error: "No parent phone numbers were found for this audience." },
        { status: 400 }
      );
    }

    const deliveredRecipients = await deliverBroadcast({
      schoolId,
      title: String(broadcast.title || "Broadcast"),
      message: String(broadcast.message || ""),
      recipients,
    });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("broadcasts")
      .update({ status: "sent", recipient_count: deliveredRecipients })
      .eq("id", broadcastId)
      .eq("school_id", schoolId)
      .select(
        "id, school_id, title, message, audience, recipient_scope, classroom_id, classroom_name, recipient_count, status, created_at, created_by, created_by_name"
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    await writeSecurityAudit(authorization.staff, "broadcast.draft_sent", {
      broadcast_id: broadcastId,
      recipient_scope: recipientScope,
      classroom_id: broadcast.classroom_id || null,
      recipient_count: deliveredRecipients,
    });

    return NextResponse.json({
      broadcast: updated as BroadcastRecord,
      recipients: deliveredRecipients,
    });
  } catch (error: unknown) {
    console.error("Could not send draft broadcast:", error);
    return jsonError(error, "Could not send draft broadcast.");
  }
}

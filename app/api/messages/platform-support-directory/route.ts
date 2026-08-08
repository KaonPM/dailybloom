import { NextResponse } from "next/server";
import { authorizeMessageUser } from "@/app/lib/message-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  isActiveSchoolLeadershipUser,
  listPlatformSupportContacts,
} from "@/app/lib/platform-support-messaging";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schoolId = Number(body.school_id);
    const authorization = await authorizeMessageUser(
      request,
      schoolId,
      undefined,
      null,
      PERMISSIONS.MESSAGE_SEND
    );
    if (!authorization.ok) return authorization.response;

    if (!schoolId) {
      return NextResponse.json({ error: "School ID is required." }, { status: 400 });
    }

    const canContactSupport = await isActiveSchoolLeadershipUser({
      userId: authorization.userId,
      schoolId,
      permission: PERMISSIONS.MESSAGE_SEND,
    });
    if (!canContactSupport) {
      return NextResponse.json(
        { error: "DailyBloom Support messaging is available to authorised school leadership only." },
        { status: 403 }
      );
    }

    const contacts = await listPlatformSupportContacts(PERMISSIONS.MESSAGE_SEND);
    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load DailyBloom Support contacts." },
      { status: 500 }
    );
  }
}

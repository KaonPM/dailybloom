import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";
import {
  getPlatformSupportInbox,
  isActivePlatformSupportUser,
} from "@/app/lib/platform-support-messaging";

export async function POST(request: Request) {
  try {
    const authorization = await requireStaffPermission(request, PERMISSIONS.MESSAGE_VIEW);
    if (!authorization.ok) return authorization.response;

    const canReplyToSupportRequests = await isActivePlatformSupportUser(
      authorization.staff.userId,
      PERMISSIONS.MESSAGE_SEND
    );
    if (!canReplyToSupportRequests) {
      return NextResponse.json(
        { error: "DailyBloom Support messaging is not enabled for this account." },
        { status: 403 }
      );
    }

    const contacts = await getPlatformSupportInbox(authorization.staff.userId);
    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load DailyBloom Support inbox." },
      { status: 500 }
    );
  }
}

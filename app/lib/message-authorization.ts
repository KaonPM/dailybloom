import "server-only";
import { NextResponse } from "next/server";
import { getCurrentParent } from "./getCurrentParent";
import { requireStaffPermission } from "./server-authorization";
import { PERMISSIONS, type Permission } from "./permissions";

type ParentChild = {
  id: string | number;
  school_id?: number | null;
};

type AuthorizedParent = {
  phone?: string | null;
  name?: string | null;
  children: ParentChild[];
};

type MessageAuthorization =
  | { ok: true; kind: "staff"; userId: string; role: string; parent: null }
  | { ok: true; kind: "parent"; userId: string; role: "parent"; parent: AuthorizedParent }
  | { ok: false; response: NextResponse };

export async function authorizeMessageUser(request: Request, schoolId: number, claimedUserId?: string, learnerId?: string | null, permission: Permission = PERMISSIONS.MESSAGE_VIEW): Promise<MessageAuthorization> {
  if (request.headers.get("authorization")) {
    const authorization = await requireStaffPermission(request, permission, schoolId);
    if (!authorization.ok) return authorization;
    if (claimedUserId && claimedUserId !== authorization.staff.userId) {
      return { ok: false, response: NextResponse.json({ error: "Sender identity does not match your session." }, { status: 403 }) };
    }
    return { ok: true, kind: "staff", userId: authorization.staff.userId, role: authorization.staff.role, parent: null };
  }

  const parent = await getCurrentParent();
  if (!parent) return { ok: false, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const phone = String(parent.phone || "");
  const children = (parent.children || []) as ParentChild[];
  const hasSchool = children.some((child) => Number(child.school_id) === schoolId);
  const hasLearner = !learnerId || children.some((child) => String(child.id) === String(learnerId) && Number(child.school_id) === schoolId);
  if (!hasSchool || !hasLearner || (claimedUserId && claimedUserId !== phone)) {
    return { ok: false, response: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  }
  return { ok: true, kind: "parent", userId: phone, role: "parent", parent };
}

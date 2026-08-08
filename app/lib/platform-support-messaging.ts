import "server-only";

import { effectivePermissions, hasPermission } from "./authorization-policy";
import { type Permission, PERMISSIONS, ROLE_PERMISSIONS } from "./permissions";
import { supabaseAdmin } from "./supabase-admin";

const SUPPORT_ROLES = new Set(["master", "master_admin"]);
const SCHOOL_LEADERSHIP_ROLES = new Set(["principal", "owner", "admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProfileRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
  is_active?: boolean | null;
};

type PlatformRoleRow = {
  user_id: string;
  role?: string | null;
  status?: string | null;
  permissions?: string[] | null;
};

export type PlatformSupportContact = {
  id: string;
  name: string;
  role: "master" | "master_admin" | "principal" | "owner" | "admin";
  role_label: "master" | "master_admin" | "principal" | "owner" | "admin";
  subtitle: string;
  school_id?: number | null;
  unread_count?: number;
  last_message_at?: string | null;
};

function normalizedRole(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function supportsPermission(role: string, permissions: readonly string[] | null | undefined, permission: Permission) {
  const effective = effectivePermissions(role, permissions || []);
  return hasPermission(effective, permission);
}

export async function isActivePlatformSupportUser(userId: string, permission: Permission) {
  if (!UUID_PATTERN.test(userId)) return false;

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("platform_user_roles")
      .select("user_id, role, status, permissions")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (!profile || profile.is_active === false) return false;

  const platformRoleName = normalizedRole(platformRole?.role);
  if (SUPPORT_ROLES.has(platformRoleName)) {
    return supportsPermission(platformRoleName, platformRole?.permissions, permission);
  }

  return normalizedRole(profile.role) === "master"
    ? hasPermission(ROLE_PERMISSIONS.master, permission)
    : false;
}

export async function isActiveSchoolLeadershipUser({
  userId,
  schoolId,
  permission,
}: {
  userId: string;
  schoolId: number;
  permission: Permission;
}) {
  if (!UUID_PATTERN.test(userId) || !schoolId) return false;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, school_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.is_active === false || Number(profile.school_id || 0) !== schoolId) {
    return false;
  }

  const role = normalizedRole(profile.role);
  if (!SCHOOL_LEADERSHIP_ROLES.has(role)) return false;

  if (role !== "admin") {
    return supportsPermission(role, [], permission);
  }

  const { data: membership } = await supabaseAdmin
    .from("school_memberships")
    .select("role, status, permissions")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  return Boolean(membership && supportsPermission("admin", membership.permissions, permission));
}

export async function isPlatformSupportConversationParticipant({
  schoolId,
  currentUserId,
  contactId,
  permission,
}: {
  schoolId: number;
  currentUserId: string;
  contactId: string;
  permission: Permission;
}) {
  const [currentIsSupport, contactIsSupport] = await Promise.all([
    isActivePlatformSupportUser(currentUserId, permission),
    isActivePlatformSupportUser(contactId, permission),
  ]);

  if (currentIsSupport === contactIsSupport) return false;

  const schoolLeaderId = currentIsSupport ? contactId : currentUserId;
  return isActiveSchoolLeadershipUser({ userId: schoolLeaderId, schoolId, permission });
}

export async function listPlatformSupportContacts(permission: Permission) {
  const [{ data: masterProfiles }, { data: platformRoles }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("role", "master")
      .neq("is_active", false),
    supabaseAdmin
      .from("platform_user_roles")
      .select("user_id, role, status, permissions")
      .eq("status", "active")
      .in("role", ["master", "master_admin"]),
  ]);

  const platformRows = ((platformRoles || []) as PlatformRoleRow[]).filter((platformRole) =>
    SUPPORT_ROLES.has(normalizedRole(platformRole.role)) &&
    supportsPermission(normalizedRole(platformRole.role), platformRole.permissions, permission)
  );
  const platformIds = [...new Set(platformRows.map((row) => row.user_id))];
  const { data: platformProfiles } = platformIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, is_active")
        .in("id", platformIds)
        .neq("is_active", false)
    : { data: [] as ProfileRow[] };

  const profileById = new Map(
    ((platformProfiles || []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const contacts = new Map<string, PlatformSupportContact>();

  ((masterProfiles || []) as ProfileRow[]).forEach((profile) => {
    contacts.set(profile.id, {
      id: profile.id,
      name: String(profile.full_name || "DailyBloom Master"),
      role: "master",
      role_label: "master",
      subtitle: "DailyBloom Support",
    });
  });

  platformRows.forEach((platformRole) => {
    const profile = profileById.get(platformRole.user_id);
    if (!profile) return;

    const role = normalizedRole(platformRole.role) as "master" | "master_admin";
    contacts.set(platformRole.user_id, {
      id: platformRole.user_id,
      name: String(profile.full_name || (role === "master" ? "DailyBloom Master" : "DailyBloom Master Admin")),
      role,
      role_label: role,
      subtitle: role === "master" ? "DailyBloom Support" : "DailyBloom Support - Master Admin",
    });
  });

  return [...contacts.values()].sort((left, right) => {
    if (left.role !== right.role) return left.role === "master" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function getPlatformSupportInbox(platformUserId: string) {
  const { data: conversations, error } = await supabaseAdmin
    .from("messages")
    .select("school_id, sender_id, sender_name, sender_role, recipient_id, recipient_name, recipient_role, is_read, created_at")
    .or(`sender_id.eq.${platformUserId},recipient_id.eq.${platformUserId}`)
    .is("learner_id", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const schoolIds = [...new Set((conversations || []).map((message) => Number(message.school_id)).filter(Boolean))];
  const { data: schools } = schoolIds.length
    ? await supabaseAdmin.from("schools").select("id, school_name").in("id", schoolIds)
    : { data: [] as { id: number; school_name?: string | null }[] };
  const schoolNameById = new Map(
    (schools || []).map((school) => [Number(school.id), String(school.school_name || "Preschool")])
  );

  const contacts = new Map<string, PlatformSupportContact>();
  const leadershipAccess = new Map<string, boolean>();

  for (const message of conversations || []) {
    const currentIsSender = String(message.sender_id || "") === platformUserId;
    const contactId = String(currentIsSender ? message.recipient_id || "" : message.sender_id || "");
    const contactRole = normalizedRole(currentIsSender ? message.recipient_role : message.sender_role);
    const schoolId = Number(message.school_id || 0);
    if (!contactId || !schoolId || !SCHOOL_LEADERSHIP_ROLES.has(contactRole)) continue;

    const accessKey = `${schoolId}:${contactId}`;
    let canMessage = leadershipAccess.get(accessKey);
    if (canMessage === undefined) {
      canMessage = await isActiveSchoolLeadershipUser({
        userId: contactId,
        schoolId,
        permission: PERMISSIONS.MESSAGE_SEND,
      });
      leadershipAccess.set(accessKey, canMessage);
    }
    if (!canMessage) continue;

    const key = `${schoolId}:${contactId}`;
    const existing = contacts.get(key);
    const unread = !currentIsSender && message.is_read === false ? 1 : 0;
    contacts.set(key, {
      id: contactId,
      name: String(currentIsSender ? message.recipient_name || "School leadership" : message.sender_name || "School leadership"),
      role: contactRole as "principal" | "owner" | "admin",
      role_label: contactRole as "principal" | "owner" | "admin",
      subtitle: schoolNameById.get(schoolId) || "Preschool",
      school_id: schoolId,
      unread_count: (existing?.unread_count || 0) + unread,
      last_message_at: existing?.last_message_at || message.created_at,
    });
  }

  return [...contacts.values()].sort((left, right) =>
    String(right.last_message_at || "").localeCompare(String(left.last_message_at || ""))
  );
}

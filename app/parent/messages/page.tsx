import { getCurrentParent } from "@/app/lib/getCurrentParent";
import MessagesClient from "@/app/messages/MessagesClient";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { PERMISSIONS } from "@/app/lib/permissions";

type ParentChildSchool = {
  school_id?: number | null;
  schools?:
    | { id?: number | null }
    | { id?: number | null }[]
    | null;
};

export default async function ParentMessagesPage() {
  const parent = await getCurrentParent();
  const schoolIds = [
    ...new Set(
      ((parent?.children || []) as ParentChildSchool[])
        .map((child) => {
          const school = Array.isArray(child.schools)
            ? child.schools[0]
            : child.schools;

          return Number(child.school_id || school?.id);
        })
        .filter(Boolean)
    ),
  ];

  const { data: schoolStaffRows } =
    schoolIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, role, school_id, classroom_name")
          .in("school_id", schoolIds)
          .in("role", ["teacher", "principal", "master", "owner", "admin"])
      : { data: [] };
  const adminIds = (schoolStaffRows || [])
    .filter((staff) => staff.role === "admin")
    .map((staff) => staff.id);
  const { data: messagingAdminMemberships } =
    adminIds.length > 0
      ? await supabaseAdmin
          .from("school_memberships")
          .select("user_id, school_id")
          .in("school_id", schoolIds)
          .in("user_id", adminIds)
          .eq("role", "admin")
          .eq("status", "active")
          .contains("permissions", [PERMISSIONS.MESSAGE_VIEW])
      : { data: [] };
  const messagingAdminKeys = new Set(
    (messagingAdminMemberships || []).map(
      (membership) => `${membership.user_id}:${membership.school_id}`
    )
  );
  const schoolStaff = (schoolStaffRows || []).filter(
    (staff) =>
      staff.role !== "admin" ||
      messagingAdminKeys.has(`${staff.id}:${staff.school_id}`)
  );

  return (
    <MessagesClient
      initialParent={{
        ...parent,
        children: parent?.children || [],
        schoolStaff: schoolStaff || [],
      }}
      mode="parent"
    />
  );
}

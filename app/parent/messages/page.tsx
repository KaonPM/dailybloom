import { getCurrentParent } from "@/app/lib/getCurrentParent";
import MessagesClient from "@/app/messages/MessagesClient";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export default async function ParentMessagesPage() {
  const parent = await getCurrentParent();
  const schoolIds = [
    ...new Set(
      (parent?.children || [])
        .map((child: any) => {
          const school = Array.isArray(child.schools)
            ? child.schools[0]
            : child.schools;

          return Number(child.school_id || school?.id);
        })
        .filter(Boolean)
    ),
  ];

  const { data: schoolStaff } =
    schoolIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, role, school_id, classroom_name")
          .in("school_id", schoolIds)
          .in("role", ["teacher", "principal", "master", "owner", "admin"])
      : { data: [] };

  return (
    <MessagesClient
      initialParent={{
        ...parent,
        schoolStaff: schoolStaff || [],
      }}
      mode="parent"
    />
  );
}

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

  const { data: principals } =
    schoolIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, role, school_id")
          .in("school_id", schoolIds)
          .in("role", ["principal", "master", "owner"])
      : { data: [] };

  return (
    <MessagesClient
      initialParent={{
        ...parent,
        schoolPrincipals: principals || [],
      }}
      mode="parent"
    />
  );
}

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getCurrentParent() {
  try {
    const cookieStore = await cookies();

    const session =
      cookieStore.get("parent_session");

    if (!session?.value) {
      return null;
    }

    // Find parent rows linked to this session
    const { data: parentRows, error } =
      await supabase
        .from("parent_access")
        .select(
          `
          phone,
          learner_id
        `
        )
        .eq(
          "session_token",
          session.value
        );

    if (
      error ||
      !parentRows ||
      parentRows.length === 0
    ) {
      return null;
    }

    const learnerIds = [
      ...new Set(
        parentRows
          .map((r) => r.learner_id)
          .filter(Boolean)
      ),
    ];

    const { data: children } =
      await supabase
        .from("learners")
        .select("*")
        .in(
          "id",
          learnerIds
        );

    return {
      phone: parentRows[0].phone,
      children: children || [],
    };
  } catch (err) {
    console.error(
      "Parent session error:",
      err
    );

    return null;
  }
}
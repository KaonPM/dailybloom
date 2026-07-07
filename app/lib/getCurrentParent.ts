import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getCurrentParent() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("parent_session");

    if (!session?.value) {
      return null;
    }

    const { data: parentRows, error } = await supabase
      .from("parent_access")
      .select(
        `
          phone,
          learner_id
        `
      )
      .eq("session_token", session.value);

    if (error || !parentRows || parentRows.length === 0) {
      console.error("Parent access error:", JSON.stringify(error, null, 2));
      return null;
    }

    const learnerIds = [
      ...new Set(parentRows.map((r) => r.learner_id).filter(Boolean)),
    ];

    const { data: children, error: learnerError } = await supabase
      .from("learners")
      .select(
        `
          id,
          name,
          school_id,
          classroom_id,
          parent_phone,
          date_of_birth,

          classrooms:classroom_id(
            id,
            classroom_name,
            teacher_name,
            age_group
          ),

          schools:school_id(
            id,
            school_name,
            logo_url,
            primary_color,
            secondary_color
          )
        `
      )
      .in("id", learnerIds);

    if (learnerError) {
      console.error("Learner fetch error:", JSON.stringify(learnerError, null, 2));
      return null;
    }

    return {
      phone: parentRows[0].phone,
      name: parentRows[0].phone,
      children: children || [],
    };
  } catch (err) {
    console.error("Parent session error:", err);
    return null;
  }
}
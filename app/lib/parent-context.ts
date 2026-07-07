import { supabase } from "./supabase";

export async function getParentContext(
  learnerId: string
) {

const { data, error } = await supabase
.from("learners")
.select(`
id,
name,
school_id,
classroom_id,

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
`)
.eq("id", learnerId)
.single();

return {
data,
error
};

}
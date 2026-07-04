import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migratePins() {
  try {
    console.log("Starting PIN migration...");

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id,pin")
      .eq("role", "parent")
      .not("pin", "is", null);

    if (error) {
      throw error;
    }

    if (!profiles?.length) {
      console.log("No parent PINs found.");
      return;
    }

    for (const profile of profiles) {
      console.log(`Migrating ${profile.id}`);

      const pinHash = await bcrypt.hash(
        String(profile.pin),
        10
      );

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          pin_hash: pinHash,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error(
          `Failed for ${profile.id}:`,
          updateError.message
        );
        continue;
      }

      console.log(`Completed ${profile.id}`);
    }

    console.log("PIN migration complete");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migratePins();
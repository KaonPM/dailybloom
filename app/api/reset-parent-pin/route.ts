import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        {
          error: "Contact number required",
        },
        { status: 400 }
      );
    }

    const digitsOnly = phone.replace(/\D/g, "");

    const normalizedPhone =
      digitsOnly.startsWith("27")
        ? "0" + digitsOnly.slice(2)
        : digitsOnly;

    const { data: parent, error } =
      await supabaseAdmin
        .from("parent_profiles")
        .select("*")
        .eq(
          "phone",
          normalizedPhone
        )
        .single();

    if (error || !parent) {
      return NextResponse.json(
        {
          error:
            "Parent account not found",
        },
        { status: 404 }
      );
    }

    // temporary PIN becomes full number
    const tempPin =
      normalizedPhone;

    const pinHash =
      await bcrypt.hash(
        tempPin,
        10
      );

    const { error: updateError } =
      await supabaseAdmin
        .from("parent_profiles")
        .update({
          pin_hash: pinHash,
          must_change_pin: true,
        })
        .eq(
          "id",
          parent.id
        );

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "Could not reset PIN",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        error:
          "Something went wrong",
      },
      { status: 500 }
    );
  }
}
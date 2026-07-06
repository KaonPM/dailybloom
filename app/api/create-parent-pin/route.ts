import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {

    const { pin } =
      await req.json();

    if (
      !pin ||
      pin.length !== 4
    ) {
      return NextResponse.json(
        {
          error:
            "PIN must be 4 digits",
        },
        {
          status: 400,
        }
      );
    }

    const cookieStore =
      await cookies();

    const phone =
      cookieStore.get(
        "parent_pending_phone"
      )?.value;

    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Session expired. Please login again.",
        },
        {
          status: 401,
        }
      );
    }

    const hashedPin =
      await bcrypt.hash(
        pin,
        10
      );

    const {
      data: parentRows,
      error: lookupError,
    } = await supabase
      .from(
        "parent_access"
      )
      .select(
        "id"
      )
      .eq(
        "phone",
        phone
      );

    if (
      lookupError ||
      !parentRows ||
      parentRows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Parent not found",
        },
        {
          status: 404,
        }
      );
    }

    const rowIds =
      parentRows.map(
        (r) => r.id
      );

    const {
      error: updateError,
    } = await supabase
      .from(
        "parent_access"
      )
      .update({
        pin_hash:
          hashedPin,

        must_change_pin:
          false,

        failed_login_attempts: 0,

        locked_until:
          null,
      })
      .in(
        "id",
        rowIds
      );

    if (updateError) {
      console.log(
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Could not save PIN",
        },
        {
          status: 500,
        }
      );
    }

    cookieStore.delete(
      "parent_pending_phone"
    );

    return NextResponse.json({
      success: true,
    });

  } catch (err) {

    console.log(
      "Create PIN error:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}
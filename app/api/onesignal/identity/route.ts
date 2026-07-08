import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";

export async function GET() {
  const parent = await getCurrentParent();

  if (!parent?.phone) {
    return NextResponse.json({ externalId: null });
  }

  return NextResponse.json({
    externalId: String(parent.phone),
    role: "parent",
  });
}

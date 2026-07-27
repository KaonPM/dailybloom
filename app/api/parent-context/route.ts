import { NextResponse } from "next/server";
import { getCurrentParent } from "@/app/lib/getCurrentParent";

export const dynamic = "force-dynamic";

export async function GET() {
  const parent = await getCurrentParent();
  if (!parent) return NextResponse.json({ error: "Parent session required." }, { status: 401 });
  return NextResponse.json(
    { children: parent.children || [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

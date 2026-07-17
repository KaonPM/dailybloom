import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authorization = await requireStaffPermission(request, PERMISSIONS.MESSAGE_SEND, Number(body.school_id));
    if (!authorization.ok) return authorization.response;

    const schoolName = String(body.school_name || "").trim();
    const learnerName = String(body.learner_name || "").trim();
    const healthSafety = String(body.health_safety || "").trim();
    const meals = String(body.meals || "").trim();
    const rest = String(body.rest || "").trim();
    const mood = String(body.mood || "").trim();
    const todayHighlight = String(body.today_highlight || "").trim();
    const teacherNotes = String(body.teacher_notes || "").trim();

    if (!schoolName || !learnerName) {
      return NextResponse.json(
        { error: "School name and learner name are required." },
        { status: 400 }
      );
    }

    const healthLine =
      healthSafety.toLowerCase() === "no incident"
        ? "There were no health or safety concerns reported."
        : `Health and safety note: ${healthSafety}.`;

    const noteLine = teacherNotes ? `Teacher note: ${teacherNotes}.` : "";

    const messageParts = [
      `Good day from ${schoolName}.`,
      `${learnerName} had a ${mood.toLowerCase()} day today.`,
      `Meals: ${meals.toLowerCase()}.`,
      `Rest: ${rest.toLowerCase()}.`,
      `Highlight: ${todayHighlight.toLowerCase()}.`,
      healthLine,
      noteLine,
    ].filter(Boolean);

    const message = messageParts.join(" ");

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json(
      { error: "Could not generate parent message." },
      { status: 500 }
    );
  }
}

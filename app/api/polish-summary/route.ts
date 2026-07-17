import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/app/lib/server-authorization";
import { PERMISSIONS } from "@/app/lib/permissions";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is missing." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const authorization = await requireStaffPermission(req, PERMISSIONS.MESSAGE_SEND, Number(body.school_id));
    if (!authorization.ok) return authorization.response;

    const {
      learnerName,
      mood,
      meals,
      rest,
      healthSafety,
      todayHighlight,
      teacherNotes,
    } = body;

    if (
      !learnerName ||
      !mood ||
      !meals ||
      !rest ||
      !healthSafety ||
      !todayHighlight
    ) {
      return NextResponse.json(
        { error: "Missing summary fields." },
        { status: 400 }
      );
    }

    const prompt = `
Write one polished WhatsApp message from a preschool teacher to a parent.

Rules:
- Write only the final message.
- Do not include headings like Mood, Meals, Rest, or Health and Safety.
- Do not use bullet points.
- Do not say "Here is today's summary" more than once.
- Keep it warm, simple, and professional.
- Keep it between 4 and 6 short sentences.
- Use the learner's name naturally.
- Do not exaggerate.
- Do not diagnose health issues.
- Do not add information that was not provided.
- Use no more than one emoji.

Details:
Learner name: ${learnerName}
Mood: ${mood}
Meals: ${meals}
Rest: ${rest}
Health and safety: ${healthSafety}
Today's highlight: ${todayHighlight}
Teacher notes: ${teacherNotes || "None"}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "OpenAI request failed." },
        { status: response.status }
      );
    }

    const message =
      data.output_text || data.output?.[0]?.content?.[0]?.text || "";

    return NextResponse.json({
      message:
        message ||
        `Good day parent/guardian.

${learnerName} had a positive day today. Mood: ${mood}. Meals: ${meals}. Rest: ${rest}. Today’s highlight was ${todayHighlight}.

Thank you.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong while polishing the message." },
      { status: 500 }
    );
  }
}

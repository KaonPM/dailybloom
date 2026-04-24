import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
You write preschool WhatsApp summaries for parents.

Rules:
- Keep the message warm, natural, and professional.
- Always start with a greeting.
- Always mention the school name and learner name.
- Keep it short, between 45 and 80 words.
- Use only the facts provided.
- Take the teacher notes as they are.
- Do not invent details.
- Do not use bullet points.
- Do not sound robotic.

School: ${schoolName}
Learner: ${learnerName}
Health & Safety: ${healthSafety}
Meals: ${meals}
Rest: ${rest}
Mood: ${mood}
Today's Highlight: ${todayHighlight}
Teacher Notes: ${teacherNotes || "None"}
      `,
    });

    return NextResponse.json({
      message: response.output_text || "Could not generate message.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not generate summary message." },
      { status: 500 }
    );
  }
}
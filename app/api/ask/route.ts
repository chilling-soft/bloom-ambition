import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

const body = z.object({
  code: codeSchema,
  q: z.string().min(1).max(300),
  context: z.string().max(4000).default(""),
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(20).default([]),
});

const SYSTEM =
  "You are Alter, a quiet assistant that lives at the OS layer. Answer in at most three short sentences. Use the page the user is looking at if it is relevant, otherwise answer from general knowledge. If you are not sure, say so instead of guessing. Never invent facts about the user.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, q, context, facts } = parsed.data;
  const canned = "I could not reach Alter just now. Try again in a moment.";

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) return NextResponse.json({ text: canned, live: false });
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `Question: ${q}\n\nPage the user is looking at:\n${context || "(none)"}\n\nWhat Alter knows about the user:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(nothing yet)"}`,
      maxOutputTokens: 300,
      abortSignal: AbortSignal.timeout(10000),
    });
    return NextResponse.json({ text: text.trim() || canned, live: true });
  } catch {
    return NextResponse.json({ text: canned, live: false });
  }
}

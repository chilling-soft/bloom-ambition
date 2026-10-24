import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

const body = z.object({
  code: codeSchema,
  term: z.string().min(1).max(60),
  context: z.string().max(800),
});

const CANNED: Record<string, string> = {
  snowballing:
    "Snowballing means turning an early advantage into more gold and map control, so every later fight gets easier to win.",
  baron:
    "Baron is the strongest neutral objective. Taking it gives the whole team a temporary buff that makes pushing and ending the game far easier.",
};

const SYSTEM =
  "You are Alter, a quiet assistant inside the user's browser. Explain the selected term in at most two plain sentences, using the surrounding text for meaning. No preamble, no markdown.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, term, context } = parsed.data;
  const canned =
    CANNED[term.toLowerCase()] ?? `"${term}" is used here in the context of the article you are reading.`;

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) {
    return NextResponse.json({ text: canned, live: false });
  }
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `Selected term: ${term}\nSurrounding text: ${context}`,
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(8000),
    });
    return NextResponse.json({ text: text.trim() || canned, live: true });
  } catch {
    return NextResponse.json({ text: canned, live: false });
  }
}

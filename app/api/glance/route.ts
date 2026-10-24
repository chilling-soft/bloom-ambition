import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

const body = z.object({
  code: codeSchema,
  title: z.string().max(200),
  text: z.string().max(4000),
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(20),
});

const SYSTEM =
  "You are Alter, quietly reading along with the user. From the page, produce: (1) a gist in exactly 3 bullets of at most 18 words each; (2) up to 3 follow-up questions THIS user is likely to want answered next, each at most 12 words, using their interests and what they already looked up so you do not repeat what they know; (3) one short reason you are offering this. Never invent facts about the user.";

const CANNED = {
  gist: [
    "T1 beat their semifinal opponent in five games and reached the final.",
    "They turned a slow start into a lead by snowballing mid game, then took Baron.",
    "The final is next Saturday.",
  ],
  questions: ["How did T1 snowball in the mid game?", "Who do they face in the final?", "Why does taking Baron end games?"],
  why: "You were on a long article for a while.",
};

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, title, text, facts } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) return NextResponse.json({ ...CANNED, live: false });
  try {
    const { output } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `Page title: ${title}\n\nPage text:\n${text}\n\nWhat Alter knows about the user:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(nothing yet)"}`,
      output: Output.object({
        schema: z.object({ gist: z.array(z.string()).min(1).max(3), questions: z.array(z.string()).max(3), why: z.string() }),
      }),
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(10000),
    });
    return NextResponse.json({ ...output, live: true });
  } catch {
    return NextResponse.json({ ...CANNED, live: false });
  }
}

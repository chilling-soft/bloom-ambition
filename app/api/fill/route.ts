import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

const body = z.object({
  code: codeSchema,
  label: z.string().max(80),
  facts: z
    .array(z.object({ id: z.string().max(64), label: z.string().max(60), value: z.string().max(300) }))
    .max(30),
});

const SYSTEM =
  "You write a short answer (max 40 words, first person) for a form field on the user's behalf. Rule 0: use ONLY the provided facts. Never invent anything. Return the ids of the facts you used.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, label, facts } = parsed.data;
  const interest = facts.find((f) => f.label.toLowerCase().includes("interest"));
  const canned = {
    text: interest
      ? `I follow ${interest.value} closely and want to join a community where I can talk about it and learn from others.`
      : "I'd love to join and learn from the community.",
    usedFactIds: interest ? [interest.id] : [],
    live: false,
  };

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) return NextResponse.json(canned);
  try {
    const { output } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `Field: ${label}\nFacts:\n${facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`).join("\n")}`,
      output: Output.object({ schema: z.object({ text: z.string(), usedFactIds: z.array(z.string()) }) }),
      maxOutputTokens: 300,
      abortSignal: AbortSignal.timeout(10000),
    });
    const ids = new Set(facts.map((f) => f.id));
    return NextResponse.json({
      text: output.text,
      usedFactIds: output.usedFactIds.filter((i) => ids.has(i)),
      live: true,
    });
  } catch {
    return NextResponse.json(canned);
  }
}

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
  "당신은 OS 계층에서 조용히 사는 비서 Alter입니다. 질문과 같은 언어로(기본은 한국어) 최대 세 문장으로 짧게 답하세요. 사용자가 보고 있는 글이 관련 있으면 그걸 쓰고, 아니면 일반 지식으로 답하세요. 확실하지 않으면 추측하지 말고 모른다고 하세요. 사용자에 대해 지어내지 마세요.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, q, context, facts } = parsed.data;
  const canned = "지금은 Alter에 닿지 않아요. 잠시 뒤에 다시 해 주세요.";

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) return NextResponse.json({ text: canned, live: false });
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `질문: ${q}\n\n사용자가 보고 있는 글:\n${context || "(없음)"}\n\nAlter가 아는 사용자 정보:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(아직 없음)"}`,
      maxOutputTokens: 300,
      abortSignal: AbortSignal.timeout(10000),
    });
    return NextResponse.json({ text: text.trim() || canned, live: true });
  } catch {
    return NextResponse.json({ text: canned, live: false });
  }
}

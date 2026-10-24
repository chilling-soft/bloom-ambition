import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

export const maxDuration = 30;

const body = z.object({
  code: codeSchema,
  q: z.string().min(1).max(300),
  context: z.string().max(4000).default(""),
  loose: z.boolean().default(false), // a fixed-format reply (a summary line) need not end like a sentence
  // accept a long list and keep only the newest: a long session must never turn into a rejected request
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(100).default([]),
});

const SYSTEM =
  "당신은 OS 계층에서 조용히 사는 비서 Alter입니다. 사용자의 하루(진행중인 일, 오늘의 링, 일정, 방금 읽은 글)를 이미 알고 있습니다. 질문과 같은 언어로(기본은 한국어) 최대 세 문장으로 짧고 구체적으로 답하세요. " +
  "'뭘 해야 돼?', '뭐가 남았어?' 같은 질문에는 아래 하루 정보에서 구체적인 다음 행동 하나를 우선순위와 함께 골라 말하세요(예: 화요일 발표가 가까우면 62%만 읽은 글부터). 하루 정보에 있는 것은 모른다고 하지 마세요. " +
  "하루 정보에 없는 일반 질문은 일반 지식으로 답하고, 정말 확실하지 않을 때만 모른다고 하세요. 사용자에 대해 지어내지 마세요.";

const fail = (reason: string, status: number) => NextResponse.json({ reason }, { status });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    console.error("ask bad body", parsed.error.issues[0]?.path.join("."), parsed.error.issues[0]?.message);
    return fail("bad_body", 400);
  }
  const { code, q, context, loose } = parsed.data;
  const facts = parsed.data.facts.slice(-15);

  if (!process.env.ANTHROPIC_API_KEY) return fail("no_key", 503);
  if (!(await allow(code))) return fail("cap", 429);

  const prompt = `질문: ${q}\n\n사용자가 보고 있는 글:\n${context || "(없음)"}\n\nAlter가 아는 사용자 정보:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(아직 없음)"}`;
  // two tries of 12s fit inside maxDuration; most failures are a transient timeout or overload
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text } = await generateText({
        model: anthropic("claude-haiku-5-5"),
        system: SYSTEM,
        prompt,
        maxOutputTokens: 800,
        abortSignal: AbortSignal.timeout(12000),
      });
      const t = text.trim();
      if (!t) continue;
      // the model sometimes stops mid-sentence: cut back to the last full sentence instead of calling it again
      const ends = /[.!?。요다죠까]["”)]?$/.test(t);
      if (loose || ends) return NextResponse.json({ text: t, live: true });
      const cut = Math.max(t.lastIndexOf("."), t.lastIndexOf("다"), t.lastIndexOf("요"));
      return NextResponse.json({ text: cut > 40 ? t.slice(0, cut + 1) : t, live: true });
    } catch (e) {
      console.error(`ask failed (attempt ${attempt})`, e instanceof Error ? e.message : e);
    }
  }
  return fail("error", 502);
}

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

export const maxDuration = 30;

const body = z.object({
  code: codeSchema,
  q: z.string().min(1).max(300),
  context: z.string().max(4000).default(""),
  // accept a long list and keep only the newest: a long session must never turn into a rejected request
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(100).default([]),
});

const SYSTEM =
  "당신은 OS 계층에서 조용히 사는 비서 Alter입니다. 사용자의 하루(진행중인 일, 오늘의 링, 일정, 방금 읽은 글)를 이미 알고 있습니다. 질문과 같은 언어로(기본은 한국어) 두세 문장으로 짧고 구체적으로 답하세요. " +
  "'뭘 해야 돼?', '뭐가 남았어?' 같은 질문에는 아래 하루 정보에서 구체적인 다음 행동 하나를 우선순위와 함께 골라 말하세요(예: 화요일 발표가 가까우면 62%만 읽은 글부터). 하루 정보에 있는 것은 모른다고 하지 마세요. " +
  "하루 정보에 없는 일반 질문은 일반 지식으로 답하고, 정말 확실하지 않을 때만 모른다고 하세요. 사용자에 대해 지어내지 마세요.";

const fail = (reason: string, status: number) => NextResponse.json({ reason }, { status });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    console.error("ask bad body", parsed.error.issues[0]?.path.join("."), parsed.error.issues[0]?.message);
    return fail("bad_body", 400);
  }
  const { code, q, context } = parsed.data;
  const facts = parsed.data.facts.slice(-15);

  if (!process.env.ANTHROPIC_API_KEY) return fail("no_key", 503);
  if (!(await allow(code))) return fail("cap", 429);

  const prompt = `질문: ${q}\n\n사용자가 보고 있는 글:\n${context || "(없음)"}\n\nAlter가 아는 사용자 정보:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(아직 없음)"}`;
  // streamed: the first words show up in about a second instead of after the whole reply
  const result = streamText({
    model: anthropic("claude-haiku-5-5"),
    // the model otherwise spends its output budget on hidden thinking: replies came back cut short, empty and slow
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    system: SYSTEM,
    prompt,
    maxOutputTokens: 400,
    abortSignal: AbortSignal.timeout(20000),
    onError: ({ error }) => console.error("ask stream failed", error instanceof Error ? error.message : error),
  });
  return result.toTextStreamResponse();
}

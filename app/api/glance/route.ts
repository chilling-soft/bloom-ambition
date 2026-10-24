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
  "당신은 Alter입니다. 사용자가 읽는 글을 옆에서 조용히 함께 읽고 있어요. 다음을 한국어로 만드세요. (1) 글의 핵심을 정확히 3개의 불릿으로, 각 40자 이내. (2) 이 사용자가 다음에 궁금해할 만한 후속 질문 최대 3개, 각 30자 이내. 사용자의 관심사와 이미 찾아본 것을 반영하고 이미 아는 것은 반복하지 마세요. (3) 왜 이걸 제안하는지 짧은 이유 한 문장. 사용자에 대해 지어내지 마세요.";

const CANNED = {
  gist: [
    "AlphaFold 3는 단백질뿐 아니라 DNA·RNA·작은 분자가 붙은 복합체까지 예측해요.",
    "구조를 만드는 마지막 단계가 diffusion 모듈로 바뀌었어요.",
    "틀 없이 원자 좌표를 바로 다루지만, 가짜 구조를 만들 수 있어요.",
  ],
  questions: ["왜 잡음을 섞어서 시작해요?", "AlphaFold 2와 뭐가 달라요?", "가짜 구조는 어떻게 줄여요?"],
  why: "이 글에 한동안 머물러 있었어요.",
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
      prompt: `글 제목: ${title}\n\n글 내용:\n${text}\n\nAlter가 아는 사용자 정보:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(아직 없음)"}`,
      output: Output.object({
        schema: z.object({ gist: z.array(z.string()).min(1).max(3), questions: z.array(z.string()).max(3), why: z.string() }),
      }),
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(10000),
    });
    return NextResponse.json({ ...output, live: true });
  } catch {
    return NextResponse.json({ ...CANNED, live: false });
  }
}

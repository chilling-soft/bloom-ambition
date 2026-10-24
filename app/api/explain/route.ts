import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

export const maxDuration = 30;

const body = z.object({
  code: codeSchema,
  term: z.string().min(1).max(60),
  context: z.string().max(2000),
});

const CANNED: Record<string, string> = {
  "diffusion 모듈": "잡음을 걷어내는 법을 배운 생성 모델이에요. 여기서는 그 방법을 원자 좌표에 적용해, 틀 없이 복합체 구조를 바로 만들어요.",
  "diffusion module": "잡음을 걷어내는 법을 배운 생성 모델이에요. 여기서는 그 방법을 원자 좌표에 적용해, 틀 없이 복합체 구조를 바로 만들어요.",
  evoformer: "AlphaFold 2에서 정렬된 서열 정보(MSA)를 오래 처리하던 블록이에요. AlphaFold 3는 이걸 더 단순한 pairformer로 바꿨어요.",
  pairformer: "AlphaFold 3의 중심 모듈로, 아미노산 쌍 사이의 관계를 정리해 구조 예측의 바탕을 만들어요.",
  잡음: "원래 값에 무작위로 섞인 흐트러짐이에요. diffusion 모델은 이 흐트러짐을 걷어내는 방법을 학습해요.",
};

const SYSTEM =
  "당신은 사용자의 브라우저 곁에서 조용히 일하는 Alter입니다. 선택한 용어를 주변 글의 맥락으로 두 문장 이내로 쉽게 한국어로 설명하세요. 서두나 마크다운 없이 답하세요.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, term, context } = parsed.data;
  const canned = CANNED[term.toLowerCase()] ?? `"${term}"은(는) 지금 읽고 있는 글에서 쓰인 용어예요.`;

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) {
    return NextResponse.json({ text: canned, live: false });
  }
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-5-5"),
    // the model otherwise spends its output budget on hidden thinking: replies came back cut short, empty and slow
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      system: SYSTEM,
      prompt: `선택한 용어: ${term}\n주변 글: ${context}`,
      maxOutputTokens: 500, // Korean needs more tokens per sentence; 250 cut answers mid-sentence
      abortSignal: AbortSignal.timeout(15000),
    });
    return NextResponse.json({ text: text.trim() || canned, live: true });
  } catch (e) {
    console.error("explain failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ text: canned, live: false, reason: "error" });
  }
}

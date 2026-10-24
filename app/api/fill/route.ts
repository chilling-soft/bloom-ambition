import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, codeSchema } from "@/lib/server";

const body = z.object({
  code: codeSchema,
  label: z.string().max(120),
  facts: z
    .array(z.object({ id: z.string().max(64), label: z.string().max(60), value: z.string().max(300) }))
    .max(30),
});

const SYSTEM =
  "사용자를 대신해 양식 칸에 들어갈 짧은 글(최대 60자, 1인칭, 한국어)을 씁니다. 규칙 0: 주어진 사실만 쓰고 절대 지어내지 마세요. 사용한 사실의 id도 함께 돌려주세요.";

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { code, label, facts } = parsed.data;
  const interest = facts.find((f) => f.label.includes("관심"));
  const isReply = /답장|메일|이메일/.test(label);
  const topic = interest?.value ?? "이 주제";
  const canned = {
    text: isReply
      ? `방금 읽은 글을 바탕으로, ${topic}의 핵심 차이를 중심으로 발표를 정리해 가겠습니다.`
      : interest
        ? `${interest.value}에 관심이 있어서, 최신 흐름을 직접 듣고 토론하고 싶어 신청합니다.`
        : "배우고 싶어서 신청합니다.",
    usedFactIds: interest ? [interest.id] : [],
    live: false,
  };

  if (!process.env.ANTHROPIC_API_KEY || !(await allow(code))) return NextResponse.json(canned);
  try {
    const { output } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      system: SYSTEM,
      prompt: `칸 이름: ${label}\n사실:\n${facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`).join("\n")}`,
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

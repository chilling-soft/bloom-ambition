import { NextResponse } from "next/server";
import { codeSchema, loadSession, saveSession, sessionSchema } from "@/lib/server";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const s = await loadSession(code.data);
  return NextResponse.json(s ?? { facts: [], handoff: null, updatedAt: 0 });
}

export async function PUT(req: Request, ctx: Ctx) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const body = sessionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad body" }, { status: 400 });
  await saveSession(code.data, body.data);
  return NextResponse.json({ ok: true });
}

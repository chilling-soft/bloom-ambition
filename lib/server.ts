import { Redis } from "@upstash/redis";
import { z } from "zod";
import type { Session } from "./types";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// ponytail: in-memory fallback is per-instance; pairing across devices needs Redis in production
const g = globalThis as unknown as { __alter?: Map<string, string> };
const mem = (g.__alter ??= new Map<string, string>());

export const codeSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);

export const sessionSchema = z.object({
  facts: z
    .array(
      z.object({
        id: z.string().max(64),
        kind: z.enum(["identity", "interest", "activity", "habit"]),
        key: z.string().max(40),
        label: z.string().max(60),
        value: z.string().max(300),
        source: z.string().max(80),
        confidence: z.number().min(0).max(1),
        isNew: z.boolean().optional(),
        userEdited: z.boolean().optional(),
      }),
    )
    .max(50),
  minutes: z.record(z.string().max(20), z.number().min(0).max(600)).optional(),
  handoff: z
    .object({
      title: z.string().max(120),
      term: z.string().max(60),
      explanation: z.string().max(600),
      ts: z.number(),
    })
    .nullable(),
  updatedAt: z.number(),
});

const key = (code: string) => `alter:${code}`;

export async function loadSession(code: string): Promise<Session | null> {
  const raw = redis ? await redis.get<Session | string>(key(code)) : mem.get(key(code));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Session) : raw;
}

export async function saveSession(code: string, s: Session) {
  if (redis) await redis.set(key(code), JSON.stringify(s), { ex: 60 * 60 * 24 });
  else mem.set(key(code), JSON.stringify(s));
}

const counts = new Map<string, number>();

// per-session cap on Claude calls so open demo links can't burn credits
export async function allow(code: string, limit = 60): Promise<boolean> {
  if (redis) {
    const k = `alter:rl:${code}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 60 * 60 * 24);
    return n <= limit;
  }
  const n = (counts.get(code) ?? 0) + 1;
  counts.set(code, n);
  return n <= limit;
}

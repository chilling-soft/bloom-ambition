export type FailReason = "cap" | "error" | "no_key" | "bad_body" | "network";

// what the person sees for each kind of failure; never shown as if it were an answer
export const FAIL_TEXT: Record<FailReason, string> = {
  cap: "오늘 체험 한도에 닿았어요. 내일 다시 써 보세요.",
  error: "답을 가져오지 못했어요. 다시 눌러 보세요.",
  no_key: "지금은 AI가 꺼져 있어요.",
  bad_body: "요청을 보내지 못했어요. 새로고침하고 다시 해 보세요.",
  network: "연결이 끊겼어요. 다시 눌러 보세요.",
};

export type Result<T> = { ok: true; data: T } | { ok: false; reason: FailReason };

export async function postJson<T>(url: string, body: unknown): Promise<Result<T>> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (r.ok && j) return { ok: true, data: j as T };
    const reason = j?.reason as FailReason | undefined;
    return { ok: false, reason: reason ?? (r.status === 400 ? "bad_body" : "error") };
  } catch {
    return { ok: false, reason: "network" };
  }
}

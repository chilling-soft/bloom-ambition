"use client";

import { useEffect, useRef, useState } from "react";
import { INTERESTS, isClosed, PICKS, START_DONE, type Done } from "@/lib/rings";
import type { Session } from "@/lib/types";
import { Rings } from "./Rings";

export default function Phone({ code }: { code: string }) {
  const [s, setS] = useState<Session | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let live = true;
    const pull = async () => {
      if (dirty.current) return;
      const r = await fetch(`/api/store/${code}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (live && r) setS(r);
    };
    pull();
    const t = setInterval(pull, 2000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [code]);

  const remove = async (id: string) => {
    if (!s) return;
    const next = { ...s, facts: s.facts.filter((f) => f.id !== id) };
    dirty.current = true;
    setS(next);
    await fetch(`/api/store/${code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
    dirty.current = false;
  };

  const done = { ...START_DONE, ...(s?.done ?? {}) } as Done;
  const closed = INTERESTS.filter((i) => isClosed(done, i)).map((i) => i.short);
  const h = s?.handoff;

  return (
    <main className="mx-auto min-h-screen max-w-sm bg-[#f4efe9] p-4 pb-10">
      <p className="font-mono text-xs tracking-[0.14em] text-black/40">ALTER · {code}</p>

      <section aria-label="오늘의 링" className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-base font-semibold">{closed.length ? `${closed.join(", ")} 링을 완료했어요` : "오늘의 링"}</h1>
        <div className="mt-3 flex items-center gap-4">
          <Rings done={done} size={120} />
          <div className="flex flex-1 flex-col gap-2">
            {INTERESTS.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
                <span className="flex-1 font-medium">{i.name}</span>
                {isClosed(done, i) ? (
                  <span className="font-semibold text-rose-700">닫힘</span>
                ) : (
                  <span>
                    <b>{done[i.id]}</b>
                    <span className="text-black/50"> /{i.goal}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="이어받은 일" className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">노트북에서 이어받았어요</h2>
          <span className="font-mono text-[11px] text-black/40">누르면 그 창으로</span>
        </div>
        {h ? (
          <div className="mt-3">
            <p className="text-sm font-medium">{h.title}</p>
            <p className="mt-2 text-sm"><span className="rounded bg-yellow-100 px-1">{h.term}</span></p>
            <p className="mt-1 text-sm text-black/70">{h.explanation}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-black/50">아직 없어요. 노트북 데모에서 글을 읽다가 단어를 선택해 보세요.</p>
        )}
      </section>

      <section aria-label="오늘 태스크" className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">오늘 태스크</h2>
          <span className="font-mono text-[11px] text-black/40">{PICKS.length}개</span>
        </div>
        <ul className="mt-3 space-y-2">
          {PICKS.map((p) => (
            <li key={p.title} className="rounded-xl bg-black/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 text-sm font-medium">{p.title}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-4">
                <span className="flex-1 text-xs text-black/50">{p.meta}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">✦ 브리핑</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-2 mt-6 text-xs font-medium text-black/40">Alter가 아는 것</h2>
      <ul className="space-y-2">
        {s?.facts.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs text-black/40">{f.label} · {f.source}{f.isNew && <span className="ml-1 rounded bg-black px-1 text-[10px] text-white">새로</span>}</p>
              <p className="break-words text-sm">{f.value}</p>
            </div>
            <button aria-label="지우기" onClick={() => remove(f.id)} className="text-black/40">✕</button>
          </li>
        ))}
      </ul>
    </main>
  );
}

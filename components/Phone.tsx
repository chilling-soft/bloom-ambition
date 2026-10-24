"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/types";

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

  const h = s?.handoff;
  return (
    <main className="mx-auto min-h-screen max-w-sm bg-[#f4efe9] p-4">
      <p className="text-xs font-mono tracking-widest text-black/40">ALTER · {code}</p>
      <h1 className="mt-1 text-xl font-semibold">Picking up where you left off</h1>

      {h ? (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-black/40">From your laptop</p>
          <p className="mt-1 font-medium">{h.title}</p>
          <p className="mt-3 text-sm"><span className="rounded bg-yellow-100 px-1">{h.term}</span></p>
          <p className="mt-1 text-sm text-black/70">{h.explanation}</p>
        </section>
      ) : (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-black/50">Nothing yet. Select a word in the demo on your laptop.</p>
      )}

      <h2 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-black/40">What Alter knows</h2>
      <ul className="space-y-2">
        {s?.facts.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs text-black/40">{f.label} · {f.source}{f.isNew && <span className="ml-1 rounded bg-black px-1 text-[10px] text-white">new</span>}</p>
              <p className="break-words text-sm">{f.value}</p>
            </div>
            <button aria-label="Delete" onClick={() => remove(f.id)} className="text-black/40">✕</button>
          </li>
        ))}
      </ul>
    </main>
  );
}

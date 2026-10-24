"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FAIL_TEXT, postJson } from "@/lib/api";
import { ARTICLE, ARTICLE_TEXT } from "@/lib/article";
import { upsert } from "@/lib/facts";
import type { Fact } from "@/lib/types";

export type Proactivity = "quiet" | "balanced" | "eager";

export type Glance = {
  status: "prefetch" | "loading" | "ready" | "open"; // prefetch: ready in the background, not shown yet
  gist: string[];
  questions: string[];
  answers: Record<string, string>;
  errors: Record<string, string>; // a failed question shows its reason, never a fake answer
  why: string;
  live: boolean;
  counted: boolean; // opening was already counted as one "accepted" nudge
};

type GlanceReply = { gist: string[]; questions?: string[]; why?: string; live?: boolean };

type Nudges = { opened: number; dismissed: number };
const ZERO: Nudges = { opened: 0, dismissed: 0 };
const KEY = "alter-nudges";
const DWELL_MS = 3000;
const RECENT_FACTS = 15; // what a request carries from a long session

function readNudges(): Nudges {
  if (typeof window === "undefined") return ZERO;
  try {
    return { ...ZERO, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return ZERO;
  }
}

const without = (o: Record<string, string>, k: string) => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));

type Args = {
  code: string | null;
  facts: Fact[];
  setFacts: (update: (facts: Fact[]) => Fact[]) => void;
  learning: boolean;
  watching: boolean; // the user is on the article, in the browser
  proactivity: Proactivity;
  onEngage: (kind: "gist") => void; // taking an offer completes a task toward the daily rings
};

// Alter reads along with the page and offers help on its own. How you react (open or pass)
// becomes a "habit" fact, and after repeated passes it stops offering by itself.
export function useGlance({ code, facts, setFacts, learning, watching, proactivity, onEngage }: Args) {
  const [glance, setGlance] = useState<Glance | null>(null);
  const [nudges, setNudges] = useState<Nudges>(readNudges);
  const tried = useRef(false);
  const cache = useRef<GlanceReply | null>(null); // one gist per session: coming back to the page costs nothing

  const autoOffer = proactivity !== "quiet" && (nudges.dismissed < 2 || nudges.opened >= nudges.dismissed);

  // only what the person told or showed Alter, never their identity details, and only the newest few
  const context = useCallback(
    () => facts.filter((f) => f.kind !== "identity").slice(0, RECENT_FACTS).map(({ label, value }) => ({ label, value })),
    [facts],
  );

  const show = useCallback((r: GlanceReply, showNow: boolean) => {
    setGlance({
      status: showNow ? "open" : "ready",
      gist: r.gist,
      questions: r.questions ?? [],
      answers: {},
      errors: {},
      why: r.why ?? "",
      live: !!r.live,
      counted: false,
    });
  }, []);

  const load = useCallback(
    async (showNow: boolean) => {
      if (!code) return;
      if (cache.current) return show(cache.current, showNow);
      setGlance({ status: showNow ? "loading" : "prefetch", gist: [], questions: [], answers: {}, errors: {}, why: "", live: false, counted: false });
      const r = await postJson<GlanceReply>("/api/glance", { code, title: ARTICLE.title, text: ARTICLE_TEXT, facts: context() });
      if (!r.ok || !r.data.gist) return setGlance(null);
      cache.current = r.data;
      show(r.data, showNow);
    },
    [code, context, show],
  );

  // after a few quiet seconds on the page, prepare help in the background and offer it
  useEffect(() => {
    if (!watching || !code || !autoOffer || tried.current) return;
    const t = setTimeout(() => {
      tried.current = true;
      void load(proactivity === "eager");
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [watching, code, autoOffer, proactivity, load]);

  const bump = (key: keyof Nudges) => {
    const next = { ...nudges, [key]: nudges[key] + 1 };
    setNudges(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    return next;
  };

  // taking the offer counts as "accepted" whether it opens the panel or just does something small
  const accepted = () => {
    const n = bump("opened");
    onEngage("gist");
    if (learning) {
      setFacts((f) =>
        upsert(f, {
          kind: "habit",
          key: "habit:gist",
          label: "도와주는 방식",
          value: "긴 글은 핵심 요약을 먼저 보여줘요",
          source: `${n.opened}번 열어봤어요`,
          confidence: Math.min(1, 0.4 + 0.15 * n.opened),
        }),
      );
    }
  };

  const open = () => {
    if (!glance) return;
    setGlance({ ...glance, status: "open", counted: true });
    if (!glance.counted) accepted();
  };

  // e.g. "easier" or "next task" from the HUD: the offer is taken, but no panel opens
  const accept = () => {
    if (!glance || glance.counted) return;
    setGlance({ ...glance, counted: true });
    accepted();
  };

  const minimize = () => setGlance((g) => (g && g.status === "open" ? { ...g, status: "ready" } : g));

  // an offer that was closed, or left unopened when the user moved on, counts as "not now"
  const recordIgnored = () => {
    const n = bump("dismissed");
    if (learning && n.dismissed >= 2 && n.opened < n.dismissed) {
      setFacts((f) =>
        upsert(f, {
          kind: "habit",
          key: "habit:gist",
          label: "도와주는 방식",
          value: "요약은 ⌘E로 부를 때만 보여줘요",
          source: `${n.dismissed}번 넘겼어요`,
          confidence: 0.7,
        }),
      );
    }
  };

  const dismiss = () => {
    setGlance(null);
    recordIgnored();
  };

  const ask = async (q: string) => {
    if (!code) return;
    setGlance((g) => g && { ...g, answers: { ...g.answers, [q]: "…" }, errors: without(g.errors, q) });
    const r = await postJson<{ text: string }>("/api/ask", { code, q, context: ARTICLE_TEXT, facts: context() });
    if (!r.ok) {
      setGlance((g) => g && { ...g, answers: without(g.answers, q), errors: { ...g.errors, [q]: FAIL_TEXT[r.reason] } });
      return;
    }
    setGlance((g) => g && { ...g, answers: { ...g.answers, [q]: r.data.text } });
    if (learning) setFacts((f) => upsert(f, { kind: "activity", key: `activity:asked:${q.slice(0, 40)}`, label: "물어본 것", value: q.slice(0, 120), source: "Protein Notes", confidence: 0.5 }));
  };

  // a new page visit starts fresh
  const reset = () => {
    if (glance?.status === "ready" && !glance.counted) recordIgnored(); // offered, never opened
    tried.current = false;
    setGlance(null);
  };

  return { glance, nudges, autoOffer, load, open, accept, minimize, dismiss, ask, reset };
}

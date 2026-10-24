"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ARTICLE, ARTICLE_TEXT } from "@/lib/article";
import { upsert } from "@/lib/facts";
import type { Fact } from "@/lib/types";

export type Proactivity = "quiet" | "balanced" | "eager";

export type Glance = {
  status: "prefetch" | "loading" | "ready" | "open"; // prefetch: ready in the background, not shown yet
  gist: string[];
  questions: string[];
  answers: Record<string, string>;
  why: string;
  live: boolean;
  counted: boolean; // opening was already counted as one "accepted" nudge
};

type Nudges = { opened: number; dismissed: number };
const ZERO: Nudges = { opened: 0, dismissed: 0 };
const KEY = "alter-nudges";
const DWELL_MS = 3000;

function readNudges(): Nudges {
  if (typeof window === "undefined") return ZERO;
  try {
    return { ...ZERO, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return ZERO;
  }
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => null);

type Args = {
  code: string | null;
  facts: Fact[];
  setFacts: (update: (facts: Fact[]) => Fact[]) => void;
  learning: boolean;
  watching: boolean; // the user is on the article, in the browser
  proactivity: Proactivity;
};

// Alter reads along with the page and offers a gist on its own. How you react (open or dismiss)
// becomes a "habit" fact, and after repeated dismissals it stops offering by itself.
export function useGlance({ code, facts, setFacts, learning, watching, proactivity }: Args) {
  const [glance, setGlance] = useState<Glance | null>(null);
  const [nudges, setNudges] = useState<Nudges>(readNudges);
  const tried = useRef(false);

  const autoOffer = proactivity !== "quiet" && (nudges.dismissed < 2 || nudges.opened >= nudges.dismissed);

  // only what the person told or showed Alter, never their identity details
  const context = useCallback(
    () => facts.filter((f) => f.kind !== "identity").map(({ label, value }) => ({ label, value })),
    [facts],
  );

  const load = useCallback(
    async (showNow: boolean) => {
      if (!code) return;
      setGlance({ status: showNow ? "loading" : "prefetch", gist: [], questions: [], answers: {}, why: "", live: false, counted: false });
      const r = await post("/api/glance", { code, title: ARTICLE.title, text: ARTICLE_TEXT, facts: context() });
      if (!r?.gist) return setGlance(null);
      setGlance({
        status: showNow ? "open" : "ready",
        gist: r.gist,
        questions: r.questions ?? [],
        answers: {},
        why: r.why ?? "",
        live: !!r.live,
        counted: false,
      });
    },
    [code, context],
  );

  // after a few quiet seconds on the page, prepare a gist in the background and show a small chip
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

  const open = () => {
    if (!glance) return;
    setGlance({ ...glance, status: "open", counted: true });
    if (glance.counted) return;
    const n = bump("opened");
    if (learning) {
      setFacts((f) =>
        upsert(f, {
          kind: "habit",
          key: "habit:gist",
          label: "How I help",
          value: "Shows a short gist of long pages",
          source: `You opened it ${n.opened}×`,
          confidence: Math.min(1, 0.4 + 0.15 * n.opened),
        }),
      );
    }
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
          label: "How I help",
          value: "Prefers to ask for summaries (⌘E)",
          source: `You passed on it ${n.dismissed}×`,
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
    setGlance((g) => g && { ...g, answers: { ...g.answers, [q]: "…" } });
    const r = await post("/api/ask", { code, q, context: ARTICLE_TEXT, facts: context() });
    const text: string = r?.text ?? "Could not reach Alter. Try again.";
    setGlance((g) => g && { ...g, answers: { ...g.answers, [q]: text } });
    if (learning) setFacts((f) => upsert(f, { kind: "activity", key: `activity:asked:${q.slice(0, 40)}`, label: "Asked", value: q, source: "Esports Daily", confidence: 0.5 }));
  };

  // a new page visit starts fresh
  const reset = () => {
    if (glance?.status === "ready") recordIgnored(); // offered, never opened
    tried.current = false;
    setGlance(null);
  };

  return { glance, nudges, autoOffer, load, open, minimize, dismiss, ask, reset };
}

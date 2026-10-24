"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ARTICLE } from "@/lib/article";
import { collectFields, isDeniedHost, setValue } from "@/lib/core";
import { upsert } from "@/lib/facts";
import type { Fact, Handoff } from "@/lib/types";
import { useGlance, type Proactivity } from "./useGlance";

type Tab = "article" | "signup" | "bank";
const TABS: { id: Tab; title: string; host: string }[] = [
  { id: "article", title: "Esports Daily", host: "esports-daily.example" },
  { id: "signup", title: "Join the club", host: "club.example" },
  { id: "bank", title: "Sign in", host: "mybank.example" },
];

const SEED: Fact[] = [
  { id: "f1", kind: "identity", key: "name", label: "Name", value: "Alex Kim", source: "Earlier sign-up", confidence: 0.9 },
  { id: "f2", kind: "identity", key: "email", label: "Email", value: "alex.kim@example.com", source: "Earlier sign-up", confidence: 0.9 },
  { id: "f3", kind: "identity", key: "address", label: "Address", value: "1 Market St, San Francisco, CA", source: "Earlier sign-up", confidence: 0.8 },
  { id: "f4", kind: "interest", key: "interest:esports", label: "Interest", value: "Esports (League of Legends)", source: "Reading history", confidence: 0.6 },
];

// still explained, but not worth remembering as something the user "looked up"
const STOPWORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "they", "their", "were", "have", "after", "into", "through", "within", "next"]);

type Sel = { x: number; y: number; text: string; context: string };
type Card = { term: string; text: string; live: boolean };
type Draft = { used: string[]; live: boolean };

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 text-xs">
      <span className="px-1 font-mono uppercase tracking-wide text-black/40">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-3 py-1 ${value === v ? "bg-black text-white" : "text-black/70 hover:bg-black/5"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

// words worth selecting get a dotted underline, so a first-time visitor knows what to try
const HINT_WORDS = /(snowballing|Baron)/g;
function withHints(text: string) {
  return text.split(HINT_WORDS).map((part, i) =>
    i % 2 ? (
      <span key={i} className="underline decoration-indigo-400 decoration-dotted underline-offset-4">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function Demo() {
  const [tab, setTab] = useState<Tab>("article");
  const [facts, setFacts] = useState<Fact[]>(SEED);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [trigger, setTrigger] = useState<"manual" | "auto">("manual");
  const [learning, setLearning] = useState<"on" | "off">("on");
  // the code only reaches the DOM inside the (initially closed) phone modal, so a client-only initializer can't mismatch
  const [code] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("alter-code");
    const c = saved ?? Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    localStorage.setItem("alter-code", c);
    return c;
  });
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [detected, setDetected] = useState(0);
  const [filled, setFilled] = useState(false);
  const [fillMode, setFillMode] = useState<"auto" | "ask" | "off">("auto");
  const [marks, setMarks] = useState<Record<string, string>>({}); // field name -> where the value came from
  const [draft, setDraft] = useState<Draft | null>(null);
  const [joined, setJoined] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [popover, setPopover] = useState(false); // menu-bar window: context + settings
  const [palette, setPalette] = useState(false); // Raycast-style command palette (⌘E with no selection)
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [cardPos, setCardPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [app, setApp] = useState<"browser" | "mail">("browser"); // the "OS": two apps, Alter sits above both
  const [mail, setMail] = useState({ to: "", subject: "", body: "" });
  const [mailUsed, setMailUsed] = useState<string[]>([]);
  const [mailDrafting, setMailDrafting] = useState(false);
  const [proactivity, setProactivity] = useState<Proactivity>("balanced");
  // first-run guide: each step ticks itself when the visitor really does it
  const [tour, setTour] = useState({ explained: false, filled: false, mailed: false, menu: false, phone: false });
  const [coach, setCoach] = useState<"open" | "folded">(() =>
    typeof window !== "undefined" && localStorage.getItem("alter-tour") === "folded" ? "folded" : "open",
  );
  const [declined, setDeclined] = useState(false); // the user undid the fill on this form
  const [focusAsk, setFocusAsk] = useState<{ x: number; y: number } | null>(null); // "fill from Alter?" under a focused field
  const [optOut, setOptOut] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("alter-optout") ?? "[]");
    } catch {
      return [];
    }
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const undoRef = useRef<Map<HTMLInputElement | HTMLTextAreaElement, string>>(new Map());
  const autoFilledRef = useRef(false);

  const host = TABS.find((t) => t.id === tab)!.host;
  const denied = app === "browser" && isDeniedHost(host);
  const canLearn = learning === "on" && !denied;
  const optedOut = optOut.includes(host);

  const g = useGlance({ code, facts, setFacts, learning: canLearn, watching: app === "browser" && tab === "article", proactivity });

  const markDone = (step: keyof typeof tour) => setTour((t) => (t[step] ? t : { ...t, [step]: true }));
  const openMenu = () => {
    markDone("menu");
    setPopover(true);
  };
  const toggleMenu = () => {
    if (!popover) markDone("menu");
    setPopover(!popover);
  };
  const openPhone = () => {
    markDone("phone");
    setShowPhone(true);
  };
  const foldCoach = (to: "open" | "folded") => {
    setCoach(to);
    try {
      localStorage.setItem("alter-tour", to);
    } catch {}
  };

  const saveOptOut = (next: string[]) => {
    setOptOut(next);
    try {
      localStorage.setItem("alter-optout", JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => {
      fetch(`/api/store/${code}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts, handoff, updatedAt: Date.now() }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [code, facts, handoff]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const explain = useCallback(
    async (s: Sel) => {
      if (!code) return;
      setSel(null);
      setCard(null);
      setCardPos({ x: s.x, y: s.y + 46 });
      setLoading(true);
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, term: s.text, context: s.context }),
      })
        .then((x) => x.json())
        .catch(() => null);
      const text: string = r?.text ?? "Could not reach Alter. Try again.";
      setLoading(false);
      setCard({ term: s.text, text, live: !!r?.live });
      setTour((t) => (t.explained ? t : { ...t, explained: true }));
      setHandoff({ title: "Esports Daily: T1 reach the final", term: s.text, explanation: text, ts: Date.now() });
      if (learning === "on" && s.text.length >= 4 && !STOPWORDS.has(s.text.toLowerCase())) {
        setFacts((f) => {
          let n = upsert(f, { kind: "interest", key: "interest:esports", label: "Interest", value: "Esports (League of Legends)", source: "Reading history", confidence: 0.7 });
          n = upsert(n, { kind: "activity", key: `activity:${s.text.toLowerCase()}`, label: "Looked up", value: s.text, source: "Esports Daily", confidence: 0.5 });
          return n;
        });
      }
    },
    [code, learning],
  );

  const onArticleMouseUp = () => {
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    if (!s || !text || text.length > 40 || !articleRef.current?.contains(s.anchorNode) || denied) return setSel(null);
    const r = s.getRangeAt(0).getBoundingClientRect();
    const c = contentRef.current!.getBoundingClientRect();
    const para = s.anchorNode?.parentElement?.closest("p")?.textContent ?? text;
    const next = { x: r.left - c.left + r.width / 2, y: r.top - c.top + contentRef.current!.scrollTop - 40, text, context: para };
    setSel(next);
    if (trigger === "auto") setTimeout(() => explain(next), 600);
  };

  const fill = useCallback(async () => {
    const form = formRef.current;
    if (!form || !code) return;
    const fields = collectFields(form);
    undoRef.current = new Map();
    const m: Record<string, string> = {};
    for (const f of fields) {
      if (f.sensitive || !f.key) continue;
      const fact = facts.find((x) => x.kind === "identity" && x.key === f.key);
      if (fact) {
        undoRef.current.set(f.el, f.el.value);
        setValue(f.el, fact.value);
        m[f.el.name] = fact.source;
      }
    }
    setMarks(m);
    setFilled(true);
    setTour((t) => (t.filled ? t : { ...t, filled: true }));
    setDeclined(false);
    setFocusAsk(null);
    const ft = fields.find((f) => f.freeText);
    if (ft) {
      const share = facts.filter((f) => f.kind !== "identity").map(({ id, label, value }) => ({ id, label, value }));
      const r = await fetch("/api/fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, label: ft.label, facts: share }),
      })
        .then((x) => x.json())
        .catch(() => null);
      if (r?.text) {
        undoRef.current.set(ft.el, "");
        setValue(ft.el, r.text);
        setMarks((x) => ({ ...x, [ft.el.name]: "Drafted from what Alter knows" }));
        setDraft({ used: r.usedFactIds ?? [], live: !!r.live });
      }
    }
  }, [code, facts]);

  const undo = () => {
    undoRef.current.forEach((v, el) => setValue(el, v));
    undoRef.current = new Map();
    setFilled(false);
    setDraft(null);
    setMarks({});
    setDeclined(true); // from now on, offer again when a field gets focus instead of refilling on its own
  };

  // after Undo: focusing a fillable field offers to fill again (or to stop offering on this site)
  const onFormFocus = (e: React.FocusEvent) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!declined || filled || optedOut || !formRef.current || !contentRef.current) return;
    const f = collectFields(formRef.current).find((x) => x.el === el);
    if (!f || f.sensitive || (!f.key && !f.freeText)) return;
    const r = el.getBoundingClientRect();
    const c = contentRef.current.getBoundingClientRect();
    // above the field: the browser's own autofill list opens below it
    setFocusAsk({ x: r.left - c.left, y: r.top - c.top + contentRef.current.scrollTop - 52 });
  };

  // cross-app moment: what was read in the Browser becomes the draft in Mail
  const draftMail = async () => {
    if (!code) return;
    setMailDrafting(true);
    const share = facts.filter((f) => f.kind !== "identity").map(({ id, label, value }) => ({ id, label, value }));
    if (handoff) share.push({ id: "just-read", label: "Just read", value: handoff.title });
    const r = await fetch("/api/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, label: "Short email to the club about the article I just read", facts: share }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setMailDrafting(false);
    if (!r?.text) return;
    setMail((m) => ({ ...m, subject: m.subject || "About the final", body: r.text }));
    setMailUsed(r.usedFactIds ?? []);
    setMarks({ body: "Drafted from what you just read", subject: "Drafted from what you just read" });
    setFilled(true);
    setTour((t) => (t.mailed ? t : { ...t, mailed: true }));
  };

  const undoMail = () => {
    setMail((m) => ({ ...m, subject: "", body: "" }));
    setMailUsed([]);
    setMarks({});
    setFilled(false);
  };

  const openApp = (a: "browser" | "mail") => {
    setApp(a);
    setSel(null);
    setCard(null);
    setPalette(false);
    setPopover(false);
    setMarks({});
    setFilled(false);
    setDraft(null);
    setJoined(false);
    setDeclined(false);
    setFocusAsk(null);
    g.reset();
  };

  // a value the user types over stops being "filled by Alter" (synthetic events from fill() are not trusted)
  const onFormInput = (e: React.FormEvent) => {
    if (!e.nativeEvent.isTrusted) return;
    const n = (e.target as HTMLInputElement).name;
    setMarks((m) => (n in m ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== n)) : m));
  };

  useEffect(() => {
    if (tab !== "signup" || app !== "browser") return;
    autoFilledRef.current = false;
    const t = setTimeout(() => setDetected(formRef.current ? collectFields(formRef.current).filter((f) => !f.sensitive).length : 0), 0);
    return () => clearTimeout(t);
  }, [tab, app]);

  useEffect(() => {
    // forms fill themselves (standard fields are low-risk and Undo is one tap); only "explain" is gated by the Call toggle
    if (app === "browser" && tab === "signup" && fillMode === "auto" && !optedOut && !joined && detected && code && !autoFilledRef.current) {
      autoFilledRef.current = true;
      fill();
    }
  }, [app, tab, fillMode, optedOut, joined, detected, code, fill]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formRef.current && canLearn) {
      let n = 0;
      let next = facts;
      for (const f of collectFields(formRef.current)) {
        if (f.sensitive || !f.key) continue; // password and payment fields are never read
        const value = f.el.value.trim();
        const old = next.find((x) => x.kind === "identity" && x.key === f.key);
        if (value && old?.value !== value) {
          next = upsert(next, { kind: "identity", key: f.key, label: f.key[0].toUpperCase() + f.key.slice(1), value, source: "This sign-up", confidence: 0.8 });
          n++;
        }
      }
      setFacts(next);
      setToast(n ? `Alter learned ${n} new ${n === 1 ? "thing" : "things"}` : "Nothing new to learn");
    }
    setJoined(true);
  };

  const saveEdit = () => {
    if (!editing) return;
    setFacts((f) => f.map((x) => (x.id === editing.id ? { ...x, value: editing.value, source: "Edited by you", userEdited: true, isNew: false } : x)));
    setEditing(null);
  };

  // palette actions depend on where the user is: only what makes sense right now
  // render only describes the actions (plain data); the work happens in runAction, called from handlers
  type ActionId = "fill" | "undo" | "draft" | "undoDraft" | "glance" | "settings" | "phone";
  const actions: { id: ActionId; label: string }[] = [];
  if (app === "browser" && tab === "article") actions.push({ id: "glance", label: "Summarize this page" });
  if (app === "browser" && tab === "signup" && !joined && !denied) actions.push(filled ? { id: "undo", label: "Undo auto-fill" } : { id: "fill", label: "Fill this form" });
  if (app === "mail") actions.push(filled ? { id: "undoDraft", label: "Undo draft" } : { id: "draft", label: "Draft a note from what I just read" });
  actions.push({ id: "settings", label: "Open what Alter knows & settings" }, { id: "phone", label: "Pair your phone" });

  const runAction = (id: ActionId) => {
    setPalette(false);
    if (id === "fill") fill();
    else if (id === "undo") undo();
    else if (id === "draft") draftMail();
    else if (id === "undoDraft") undoMail();
    else if (id === "glance") {
      if (g.glance && g.glance.status !== "loading") g.open();
      else g.load(true);
    }
    else if (id === "settings") openMenu();
    else openPhone();
  };

  const kbRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    kbRef.current = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (palette) setPalette(false);
        else if (sel) explain(sel);
        else {
          setPalette(true);
          setPaletteIdx(0);
        }
        return;
      }
      if (e.key === "Escape") {
        setPalette(false);
        setPopover(false);
        setCard(null);
        setSel(null);
        g.minimize();
        return;
      }
      if (!palette) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, actions.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && actions[paletteIdx]) { e.preventDefault(); runAction(actions[paletteIdx].id); }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => kbRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // anything Alter opened closes itself when you click somewhere else
  const outsideRef = useRef<(e: MouseEvent) => void>(() => {});
  useEffect(() => {
    outsideRef.current = (e) => {
      const t = e.target as Element;
      if (popover && !t.closest("[data-popover], [data-toggle]")) setPopover(false);
      if (card && !t.closest("[data-bubble]")) setCard(null);
      if (g.glance?.status === "open" && !t.closest("[data-glance]")) g.minimize();
      if (sel && !t.closest("[data-chip], article")) setSel(null);
      if (focusAsk && !t.closest("[data-askfill]")) setFocusAsk(null);
    };
  });
  useEffect(() => {
    const h = (e: MouseEvent) => outsideRef.current(e);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const inp = (k: string) => `mt-1 w-full rounded-lg border px-3 py-2 ${marks[k] ? "border-indigo-300 bg-indigo-50" : "border-black/15"}`;
  const tag = (k: string) =>
    marks[k] ? <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">✦ {marks[k]}</span> : null;

  const phoneUrl = typeof window !== "undefined" && code ? `${window.location.origin}/m?code=${code}` : "";
  const shown = [...facts].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));

  // the only thing Alter shows by itself: one short-lived line above the Dock
  const hud: React.ReactNode =
    denied ? (
      <span className="text-white/70">✦ Paused here. Nothing is read or learned.</span>
    ) : toast ? (
      <span>✦ {toast}</span>
    ) : app === "browser" && tab === "signup" && !joined && filled ? (
      <>
        <span>✦ Filled it in for you</span>
        <button onClick={undo} className="rounded-full border border-white/30 px-2.5 py-0.5 text-xs">Undo</button>
      </>
    ) : app === "browser" && tab === "signup" && !joined && fillMode === "ask" && !optedOut && detected ? (
      <>
        <span>✦ Fill this form for you?</span>
        <button onClick={fill} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-black">Fill it</button>
      </>
    ) : app === "mail" && mailDrafting ? (
      <span>✦ Drafting…</span>
    ) : app === "mail" && filled ? (
      <>
        <span>✦ Drafted from what you just read</span>
        <button onClick={undoMail} className="rounded-full border border-white/30 px-2.5 py-0.5 text-xs">Undo</button>
      </>
    ) : app === "mail" && handoff && !mail.body ? (
      <>
        <span>✦ Draft a note about what you just read?</span>
        <button onClick={draftMail} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-black">Draft</button>
      </>
    ) : null;

  const gl = g.glance;
  const steps = [
    { done: tour.explained || g.nudges.opened > 0, text: "Read for a few seconds, or select a word and press ⌘E" },
    { done: tour.filled, text: "Open “Join the club”. The form fills itself" },
    { done: tour.mailed, text: "Open Mail. Alter offers a draft from what you read" },
    { done: tour.menu, text: "Click ✦ to see what Alter knows" },
    { done: tour.phone, text: "Scan the QR with your phone" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const fromName = facts.find((f) => f.key === "name")?.value ?? "You";
  const fromEmail = facts.find((f) => f.key === "email")?.value ?? "";

  return (
    <div className="h-full">
      {/* a tiny OS that fills its container: menu bar, windows, Dock. Alter lives at the OS layer above every app */}
      <div className="relative h-full overflow-hidden bg-gradient-to-br from-[#d9cfe8] via-[#ead9d2] to-[#cfe0e8]">
        <div className="relative z-20 flex h-8 items-center justify-between bg-white/40 px-3 text-xs text-black/70 backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{app === "browser" ? "Browser" : "Mail"}</span>
            <span className="hidden gap-4 text-black/50 sm:flex"><span>File</span><span>Edit</span><span>View</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Fri 3:40 PM</span>
            <button data-toggle aria-label="Alter menu" onClick={toggleMenu} className={`rounded px-2 py-0.5 text-sm ${popover ? "bg-black text-white" : "hover:bg-black/10"}`}>
              ✦
            </button>
          </div>
        </div>

        {/* the page's title is wallpaper text, so there is no frame around the OS */}
        <div className="pointer-events-none absolute inset-x-0 top-8 px-4 pt-6 text-center [@media(max-height:700px)]:hidden">
          <h1 className="text-4xl font-semibold tracking-tight">Alter</h1>
          <p className="mt-1 text-base text-black/60">It quietly learns you, helps when it matters, and grows into a version of you.</p>
          <p className="mt-1 text-xs text-black/40">Not a recording. Select a word and press ⌘E, or click ✦ in the menu bar.</p>
        </div>

        {/* first-run guide, styled like an OS notification; shown only where it fits beside the window */}
        {coach === "open" ? (
          <div className="absolute left-4 top-44 z-10 hidden w-60 rounded-2xl border border-black/10 bg-white/85 p-4 text-sm shadow-xl backdrop-blur min-[1360px]:block">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Try Alter <span className="text-black/40">{doneCount}/{steps.length}</span>
              </p>
              <button aria-label="Hide guide" onClick={() => foldCoach("folded")} className="text-black/40 hover:text-black">✕</button>
            </div>
            <ul className="mt-2 space-y-2">
              {steps.map((s) => (
                <li key={s.text} className={`flex gap-2 ${s.done ? "text-black/40" : "text-black/80"}`}>
                  <span className={s.done ? "text-green-600" : "text-black/30"}>{s.done ? "✓" : "○"}</span>
                  <span className={s.done ? "line-through" : ""}>{s.text}</span>
                </li>
              ))}
            </ul>
            {doneCount === steps.length && (
              <p className="mt-3 text-xs text-black/60">
                That is the loop: Alter learned, helped, and you stayed in control. <a href="#how" className="underline">How it works</a>
              </p>
            )}
          </div>
        ) : (
          <button onClick={() => foldCoach("open")} className="absolute left-4 top-44 z-10 hidden rounded-full bg-white/85 px-3 py-1.5 text-xs shadow backdrop-blur min-[1360px]:block">
            Guide
          </button>
        )}

        {/* menu-bar window: what Alter knows + settings */}
        {popover && (
          <div data-popover className="absolute right-3 top-9 z-30 max-h-[75%] w-80 overflow-y-auto rounded-xl border border-black/10 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <b className="text-base">Alter</b>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50">{denied ? "paused here" : learning === "on" ? "learning" : "learning off"}</span>
            </div>

            <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-black/40">What Alter knows</p>
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {shown.map((f) => (
                <li key={f.id} className="rounded-lg bg-black/[0.03] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-black/40">
                        {f.label} · {f.source}
                        {f.isNew && <span className="ml-1 rounded bg-black px-1 text-[10px] text-white">new</span>}
                      </p>
                      {editing?.id === f.id ? (
                        <div className="mt-1 flex gap-1">
                          <input autoFocus value={editing.value} onChange={(e) => setEditing({ id: f.id, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveEdit()} className="min-w-0 flex-1 rounded border border-black/20 px-2 py-0.5" />
                          <button onClick={saveEdit} className="text-xs underline">save</button>
                        </div>
                      ) : (
                        <p className="break-words">{f.value}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1 text-black/40">
                      <button aria-label="Edit" onClick={() => setEditing({ id: f.id, value: f.value })} className="hover:text-black">✎</button>
                      <button aria-label="Delete" onClick={() => setFacts((x) => x.filter((y) => y.id !== f.id))} className="hover:text-black">✕</button>
                    </div>
                  </div>
                  <div className="mt-1 h-1 rounded bg-black/5"><div className="h-1 rounded bg-black/40" style={{ width: `${Math.round(f.confidence * 100)}%` }} /></div>
                </li>
              ))}
            </ul>

            <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-black/40">Settings</p>
            <div className="flex flex-wrap gap-2">
              <Chips label="Explain" value={trigger} options={[["manual", "Manual"], ["auto", "Auto"]]} onChange={setTrigger} />
              <Chips label="Forms" value={fillMode} options={[["auto", "Auto"], ["ask", "Ask"], ["off", "Off"]]} onChange={setFillMode} />
              <Chips label="Proactive" value={proactivity} options={[["quiet", "Quiet"], ["balanced", "Balanced"], ["eager", "Eager"]]} onChange={setProactivity} />
              <Chips label="Learning" value={learning} options={[["on", "On"], ["off", "Off"]]} onChange={setLearning} />
            </div>
            {optOut.length > 0 && (
              <div className="mt-3 text-xs text-black/60">
                <p className="mb-1 font-medium uppercase tracking-wide text-black/40">Not offering fill on</p>
                {optOut.map((h) => (
                  <p key={h} className="flex items-center justify-between">
                    <span className="font-mono">{h}</span>
                    <button onClick={() => saveOptOut(optOut.filter((x) => x !== h))} className="underline">Allow again</button>
                  </p>
                ))}
              </div>
            )}
            {g.nudges.opened + g.nudges.dismissed > 0 && (
              <p className="mt-3 text-xs text-black/60">
                Gists so far: opened {g.nudges.opened}, dismissed {g.nudges.dismissed}.{!g.autoOffer && proactivity !== "quiet" && " Paused: ask with ⌘E instead."}
              </p>
            )}
            <p className="mt-3 text-xs text-black/50">Never read or learned: passwords, payment fields, banking sites.</p>
            <p className="mt-1 text-xs text-black/40">Vault for sensitive items: coming next.</p>
            <button onClick={() => { openPhone(); setPopover(false); }} className="mt-4 w-full rounded-full bg-black py-2 text-xs text-white">See it on your phone</button>
          </div>
        )}

        {/* app window */}
        <div className="absolute inset-x-0 bottom-36 top-40 flex justify-center px-4 [@media(max-height:700px)]:top-8 [@media(max-height:700px)]:pt-5">
          {app === "browser" ? (
            <div className="relative flex h-full w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
              <div className="flex items-center gap-2 bg-[#ece7e1] px-3 pt-2">
                <div className="mr-2 flex gap-1.5 pb-2">
                  <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <i className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTab(t.id); setSel(null); setCard(null); setJoined(false); setFilled(false); setDraft(null); setMarks({}); setDeclined(false); setFocusAsk(null); g.reset(); }}
                    className={`rounded-t-lg px-4 py-1.5 text-sm ${tab === t.id ? "bg-white font-medium" : "text-black/60 hover:bg-white/50"}`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              <div className="border-b border-black/5 bg-black/[0.03] px-4 py-1.5 font-mono text-xs text-black/50">{host}</div>

              <div ref={contentRef} className="relative min-h-0 flex-1 overflow-y-auto p-6">
                {/* trigger: a small chip next to a selection */}
                {sel && (
                  <button data-chip onClick={() => explain(sel)} style={{ left: sel.x, top: sel.y }} className="absolute z-10 -translate-x-1/2 rounded-full bg-black px-3 py-1.5 text-xs text-white shadow-lg">
                    ✦ Explain <span className="ml-1 opacity-50">⌘E</span>
                  </button>
                )}

                {/* after Undo: a small offer under the field you just focused, like an autofill dropdown */}
                {focusAsk && tab === "signup" && (
                  <div data-askfill style={{ left: focusAsk.x, top: focusAsk.y }} className="absolute z-10 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-xl">
                    <span>✦ Fill from what I know?</span>
                    <button onClick={() => fill()} className="rounded-full bg-black px-3 py-1 text-xs text-white">Fill</button>
                    <button
                      onClick={() => { saveOptOut([...optOut, host]); setFocusAsk(null); setToast("Won’t offer here again. Change it in ✦ settings."); }}
                      className="rounded-full border border-black/20 px-3 py-1 text-xs"
                    >
                      Not on this site
                    </button>
                  </div>
                )}

                {/* answer: a small bubble next to the word, gone on Esc */}
                {(loading || card) && tab === "article" && (
                  <div data-bubble style={{ left: Math.max(8, Math.min(cardPos.x - 150, 400)), top: cardPos.y }} className="absolute z-10 w-72 rounded-xl border border-black/10 bg-white p-3 text-sm shadow-2xl">
                    {loading || !card ? (
                      <p className="text-black/50">✦ Thinking…</p>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <p className="font-medium">{card.term}</p>
                          <button aria-label="Close" onClick={() => setCard(null)} className="text-black/40 hover:text-black">✕</button>
                        </div>
                        <p className="mt-1 text-black/70">{card.text}</p>
                        {!card.live && <p className="mt-1 text-xs text-black/40">cached answer</p>}
                      </>
                    )}
                  </div>
                )}

                {tab === "article" && (
                  <article ref={articleRef} onMouseUp={onArticleMouseUp} className="mx-auto max-w-prose">
                    <p className="text-xs uppercase tracking-wide text-black/40">{ARTICLE.kicker}</p>
                    <h3 className="mt-1 text-2xl font-semibold">{ARTICLE.title}</h3>
                    {ARTICLE.paras.map((p, i) => (
                      <p key={i} className={`${i === 0 ? "mt-4" : "mt-3"} leading-relaxed text-black/80`}>{withHints(p)}</p>
                    ))}
                    <p className="mt-6 rounded-lg bg-black/[0.04] px-3 py-2 text-sm text-black/50">Just read. After a few seconds Alter offers a gist on its own. Or select a word and press ⌘E, then open Mail from the Dock.</p>
                  </article>
                )}

                {tab === "signup" && (
                  <form ref={formRef} onSubmit={onSubmit} onInput={onFormInput} onFocus={onFormFocus} className="mx-auto max-w-sm space-y-3">
                    <h3 className="text-xl font-semibold">Join the Esports Club</h3>
                    {joined ? (
                      <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Welcome! You’re in.</p>
                    ) : (
                      <>
                        <label className="block text-sm">Full name{tag("name")}<input name="name" autoComplete="name" className={inp("name")} /></label>
                        <label className="block text-sm">Email{tag("email")}<input name="email" type="email" autoComplete="email" className={inp("email")} /></label>
                        <label className="block text-sm">Address{tag("address")}<input name="address" autoComplete="street-address" className={inp("address")} /></label>
                        <label className="block text-sm">Password<span className="ml-2 text-[11px] text-black/40">never filled</span><input name="password" type="password" autoComplete="new-password" className={inp("password")} /></label>
                        <label className="block text-sm">Why do you want to join?{tag("motivation")}<textarea name="motivation" rows={3} className={inp("motivation")} /></label>
                        {draft && (
                          <p className="text-xs text-black/50">
                            Drafted from: {draft.used.map((id) => facts.find((f) => f.id === id)?.value).filter(Boolean).join(", ") || "your saved context"}
                            {!draft.live && " · cached"}
                          </p>
                        )}
                        <button className="w-full rounded-lg bg-black py-2.5 text-white">Join</button>
                      </>
                    )}
                  </form>
                )}

                {tab === "bank" && (
                  <form onSubmit={(e) => e.preventDefault()} className="mx-auto max-w-sm space-y-3">
                    <h3 className="text-xl font-semibold">Sign in to MyBank</h3>
                    <label className="block text-sm">Username<input className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
                    <label className="block text-sm">Password<input type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
                    <button className="w-full rounded-lg bg-black py-2.5 text-white">Sign in</button>
                  </form>
                )}
              </div>

              {/* proactive: Alter reads along and offers a gist by itself, as a small chip that opens on demand */}
              {tab === "article" && gl && gl.status !== "prefetch" && (
                gl.status === "ready" ? (
                  <div data-glance className="absolute bottom-4 right-4 z-10 flex items-center rounded-full bg-black text-sm text-white shadow-xl">
                    <button onClick={g.open} className="py-2 pl-4 pr-2">✦ Gist ready</button>
                    <button aria-label="Dismiss" onClick={g.dismiss} className="py-2 pl-1 pr-3 text-white/50 hover:text-white">✕</button>
                  </div>
                ) : gl.status === "loading" ? (
                  <div data-glance className="absolute bottom-4 right-4 z-10 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl">✦ Reading along…</div>
                ) : (
                  <div data-glance className="absolute bottom-4 right-4 z-10 max-h-[85%] w-80 overflow-y-auto rounded-2xl border border-black/10 bg-white p-4 text-sm shadow-2xl">
                    <div className="flex items-start justify-between">
                      <p className="font-medium">✦ The gist</p>
                      <button aria-label="Dismiss" onClick={g.dismiss} className="text-black/40 hover:text-black">✕</button>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-black/80">
                      {gl.gist.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {gl.questions.length > 0 && (
                      <>
                        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-black/40">Curious about…</p>
                        <div className="mt-1 flex flex-col gap-1.5">
                          {gl.questions.map((q) => (
                            <div key={q}>
                              <button onClick={() => g.ask(q)} className="w-full rounded-lg border border-black/10 px-3 py-1.5 text-left hover:bg-black/[0.03]">{q}</button>
                              {gl.answers[q] && <p className="mt-1 px-1 text-black/70">{gl.answers[q]}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="mt-3 text-xs text-black/40">
                      Why you see this: {gl.why || "you stayed on this page"} Make it quieter in ✦.{!gl.live && " · cached"}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex h-full w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
              <div className="flex items-center gap-2 bg-[#ece7e1] px-3 py-2">
                <div className="flex gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <i className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="mx-auto text-sm text-black/60">New Message</span>
              </div>
              <div onInput={onFormInput} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 text-sm">
                <p className="text-black/50">From: {fromName} {fromEmail && `<${fromEmail}>`}</p>
                <label className="block">To<input name="to" value={mail.to} onChange={(e) => setMail((m) => ({ ...m, to: e.target.value }))} placeholder="club@esports.example" className={inp("to")} /></label>
                <label className="block">Subject{tag("subject")}<input name="subject" value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} className={inp("subject")} /></label>
                <label className="block">Message{tag("body")}<textarea name="body" rows={7} value={mail.body} onChange={(e) => setMail((m) => ({ ...m, body: e.target.value }))} className={inp("body")} /></label>
                {mailUsed.length > 0 && (
                  <p className="text-xs text-black/50">Drafted from: {mailUsed.map((id) => facts.find((f) => f.id === id)?.value).filter(Boolean).join(", ") || "what you just read"}</p>
                )}
                <button onClick={() => setToast("Sent (demo)")} className="rounded-lg bg-black px-5 py-2 text-white">Send</button>
              </div>
            </div>
          )}
        </div>

        {/* HUD */}
        {hud && (
          <div className="pointer-events-none absolute bottom-[5.5rem] left-1/2 z-30 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/90 px-4 py-2 text-sm text-white shadow-lg">{hud}</div>
          </div>
        )}

        <a href="#how" className="absolute bottom-4 right-4 z-20 hidden rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur sm:block">
          How it works ↓
        </a>

        {/* Dock */}
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-end gap-2 rounded-2xl bg-white/40 p-2 backdrop-blur">
          {([["browser", "🌐", "Browser"], ["mail", "✉️", "Mail"]] as const).map(([id, icon, name]) => (
            <button key={id} aria-label={name} onClick={() => openApp(id)} className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl text-2xl ${app === id ? "bg-white shadow" : "hover:bg-white/60"}`}>
              {icon}
            </button>
          ))}
          <button data-toggle aria-label="Alter" onClick={toggleMenu} className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-xl text-white">✦</button>
        </div>

        {/* Raycast-style palette: ⌘E with nothing selected */}
        {palette && (
          <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={() => setPalette(false)}>
            <div className="w-[min(92%,520px)] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-black/5 px-4 py-3 text-black/40">✦ What do you need?</div>
              <ul className="p-2">
                {actions.map((a, i) => (
                  <li key={a.id}>
                    <button onMouseEnter={() => setPaletteIdx(i)} onClick={() => runAction(a.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${i === paletteIdx ? "bg-black text-white" : ""}`}>
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-black/5 px-4 py-2 text-xs text-black/40">↑↓ move · ↵ run · esc close</div>
            </div>
          </div>
        )}
      </div>

      {showPhone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPhone(false)}>
          <div className="rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium">Scan with your phone</p>
            <p className="mt-1 text-sm text-black/50">It opens the same Alter, with what you just did.</p>
            <div className="my-4 flex justify-center">{phoneUrl && <QRCodeSVG value={phoneUrl} size={180} />}</div>
            <p className="font-mono text-sm tracking-widest">{code}</p>
            <button onClick={() => setShowPhone(false)} className="mt-4 rounded-full border border-black/20 px-4 py-1.5 text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

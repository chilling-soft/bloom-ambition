"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { askStream, FAIL_TEXT, postJson } from "@/lib/api";
import { ARTICLE, ARTICLE_TEXT } from "@/lib/article";
import { collectFields, isDeniedHost, setValue } from "@/lib/core";
import { upsert } from "@/lib/facts";
import { INTERESTS, isClosed, PICKS, remaining, START_DONE, type Done, type RingId } from "@/lib/rings";
import type { Fact, Handoff } from "@/lib/types";
import { dayContext, type ResumeAction } from "@/lib/work";
import { Dashboard, type AskResult } from "./Dashboard";
import { GuideSetup } from "./GuideSetup";
import { Rings } from "./Rings";
import { Vault } from "./Vault";
import { useGlance, type Proactivity } from "./useGlance";

type Tab = "article" | "signup" | "bank";
type AppId = "browser" | "mail" | "alter";

const TABS: { id: Tab; title: string; host: string }[] = [
  { id: "article", title: "Nature", host: "nature.com/articles/s41586-024-07487-w" },
  { id: "signup", title: "세미나 신청", host: "seminar.example" },
  { id: "bank", title: "카드사", host: "mybank.example" },
];

const SEED: Fact[] = [
  { id: "f1", kind: "identity", key: "name", label: "이름", value: "김하늘", source: "이전 신청서", confidence: 0.9 },
  { id: "f2", kind: "identity", key: "email", label: "이메일", value: "haneul.kim@example.com", source: "이전 신청서", confidence: 0.9 },
  { id: "f3", kind: "identity", key: "affiliation", label: "소속", value: "김 교수 연구실 · 생명과학과", source: "이전 신청서", confidence: 0.8 },
  { id: "f4", kind: "interest", key: "interest:bio", label: "관심사", value: "바이오 (단백질 구조)", source: "읽기 기록", confidence: 0.7 },
  { id: "f5", kind: "interest", key: "interest:ai", label: "관심사", value: "AI·개발 (diffusion 모델)", source: "읽기 기록", confidence: 0.6 },
];

const KEY_LABEL: Record<string, string> = { name: "이름", email: "이메일", affiliation: "소속" };
const EASY_Q = "이 문단을 이미지 생성 예로 쉽게 다시 설명해줘";

// still explained, but not worth remembering as something the user "looked up"
const STOPWORDS = new Set(["그리고", "하지만", "이", "그", "은", "는", "을", "를"]);

type Sel = { x: number; y: number; text: string; context: string };
type Card = { term: string; text: string; live: boolean; retry?: Sel };
type Draft = { used: string[]; live: boolean };

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 text-xs">
      <span className="px-1 font-mono tracking-wide text-black/40">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-2.5 py-1 ${value === v ? "bg-black text-white" : "text-black/70 hover:bg-black/5"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

// words worth selecting get a dotted underline, so a first-time visitor knows what to try
const HINT_WORDS = /(diffusion module|pairformer|evoformer|diffusion-based)/gi;
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
  const [noteUndo, setNoteUndo] = useState<(() => void) | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [detected, setDetected] = useState(0);
  const [filled, setFilled] = useState(false);
  const [fillMode, setFillMode] = useState<"auto" | "ask" | "off">("auto");
  const [marks, setMarks] = useState<Record<string, string>>({}); // field name -> where the value came from
  const [draft, setDraft] = useState<Draft | null>(null);
  const [joined, setJoined] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [vault, setVault] = useState(false);
  const [vaultAuto, setVaultAuto] = useState(false); // opened from the suggestion: fill as soon as it unlocks
  const [welcome, setWelcome] = useState(false); // first visit: one card that says what to try
  const [caption, setCaption] = useState(""); // what the guided tour is showing right now
  const [mailDraft, setMailDraft] = useState(""); // what Alter wrote, to compare with what the person actually sends
  const [guide, setGuide] = useState(false);
  const [popover, setPopover] = useState(false); // menu-bar window: rings, what Alter knows, settings
  const [palette, setPalette] = useState(false); // Raycast-style command palette (⌘E with no selection)
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [paletteQ, setPaletteQ] = useState("");
  const [paletteA, setPaletteA] = useState<AskResult | null>(null);
  const [cardPos, setCardPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [app, setApp] = useState<AppId>("browser"); // the "OS": three apps, Alter sits above all of them
  const [mail, setMail] = useState({ to: "", subject: "", body: "" });
  const [mailUsed, setMailUsed] = useState<string[]>([]);
  const [mailDrafting, setMailDrafting] = useState(false);
  const [proactivity, setProactivity] = useState<Proactivity>("balanced");
  const [done, setDone] = useState<Done>(START_DONE);
  const [rings, setRings] = useState<"on" | "off">("on");
  const [focusQ, setFocusQ] = useState<string | null>(null); // the question open in the Alter panel
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
  const tourLive = useRef(false); // the guided tour is running; any touch or Esc stops it
  const osRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const undoRef = useRef<Map<HTMLInputElement | HTMLTextAreaElement, string>>(new Map());
  const autoFilledRef = useRef(false);

  const host = TABS.find((t) => t.id === tab)!.host;
  const denied = app === "browser" && isDeniedHost(host);
  const canLearn = learning === "on" && !denied;
  const optedOut = optOut.includes(host.split("/")[0]);

  // finishing a task fills its ring; a closed ring says so. Nothing is ever taken away
  const addDone = useCallback(
    (id: RingId) => {
      if (rings === "off") return;
      const i = INTERESTS.find((x) => x.id === id)!;
      if (done[id] >= i.goal) return;
      setDone((d) => ({ ...d, [id]: d[id] + 1 }));
      if (done[id] + 1 >= i.goal) setToast(`✦ ${i.short} ${i.goal}/${i.goal} 완료`);
    },
    [rings, done],
  );

  const g = useGlance({
    code,
    facts,
    setFacts,
    learning: canLearn,
    watching: app === "browser" && tab === "article",
    proactivity,
    onEngage: () => addDone("bio"),
  });

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

  const shareFacts = () => facts.filter((f) => f.kind !== "identity").map(({ id, label, value }) => ({ id, label, value }));

  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => {
      fetch(`/api/store/${code}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: facts.filter((f) => f.kind !== "identity"), handoff, done, updatedAt: Date.now() }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [code, facts, handoff, done]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast("");
      setNoteUndo(null);
    }, noteUndo ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [toast, noteUndo]);

  const explain = useCallback(
    async (s: Sel) => {
      if (!code) return;
      setSel(null);
      setCard(null);
      setCardPos({ x: s.x, y: s.y + 46 });
      setLoading(true);
      const r = await postJson<{ text: string; live?: boolean }>("/api/explain", { code, term: s.text, context: s.context });
      setLoading(false);
      if (!r.ok) {
        setCard({ term: s.text, text: FAIL_TEXT[r.reason], live: true, retry: s });
        return;
      }
      const text = r.data.text;
      setCard({ term: s.text, text, live: !!r.data.live });
      setTour((t) => (t.explained ? t : { ...t, explained: true }));
      setHandoff({ title: ARTICLE.title, term: s.text, explanation: text, ts: Date.now() });
      if (learning === "on" && s.text.length >= 2 && !STOPWORDS.has(s.text)) {
        setFacts((f) => {
          let n = upsert(f, { kind: "interest", key: "interest:bio", label: "관심사", value: "바이오 (단백질 구조)", source: "읽기 기록", confidence: 0.8 });
          n = upsert(n, { kind: "activity", key: `activity:${s.text.toLowerCase().slice(0, 40)}`, label: "찾아본 말", value: s.text.slice(0, 120), source: "Protein Notes", confidence: 0.5 });
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
    // a word outside any paragraph (the title) still gets the whole article as context
    const para = s.anchorNode?.parentElement?.closest("p")?.textContent ?? ARTICLE_TEXT;
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
      const r = await postJson<{ text: string; usedFactIds?: string[]; live?: boolean }>("/api/fill", { code, label: ft.label, facts: share });
      if (r.ok && r.data.text) {
        undoRef.current.set(ft.el, "");
        setValue(ft.el, r.data.text);
        setMarks((x) => ({ ...x, [ft.el.name]: "Alter가 아는 것으로 초안" }));
        setDraft({ used: r.data.usedFactIds ?? [], live: !!r.data.live });
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
    const share = shareFacts();
    share.push({ id: "just-read", label: "방금 읽은 글", value: handoff?.title ?? ARTICLE.title });
    const r = await postJson<{ text: string; usedFactIds?: string[] }>("/api/fill", { code, label: "교수님께 보내는 짧은 답장: 방금 읽은 글을 바탕으로 발표에서 다룰 방향 한 줄", facts: share });
    setMailDrafting(false);
    if (!r.ok || !r.data.text) return setToast(`✦ ${r.ok ? FAIL_TEXT.error : FAIL_TEXT[r.reason]}`);
    setMail((m) => ({ ...m, to: m.to || "kim.prof@lab.example", subject: m.subject || "Re: 다음 주 저널클럽 발표 순서", body: r.data.text }));
    setMailUsed(r.data.usedFactIds ?? []);
    setMailDraft(r.data.text);
    setMarks({ body: "방금 읽은 글로 초안", subject: "방금 읽은 글로 초안", to: "받은 편지에서" });
    setFilled(true);
    setTour((t) => (t.mailed ? t : { ...t, mailed: true }));
  };

  // sending an edited draft is the clearest signal of taste: Alter reads the difference and keeps one rule
  const sendMail = async () => {
    const edited = mail.body.trim();
    if (!mailDraft || !edited || edited === mailDraft) return setToast("✦ 보냈어요 (데모)");
    setToast("✦ 고친 곳에서 배우는 중…");
    const a = await askAnything(
      `AI가 쓴 초안과 사람이 고쳐 보낸 글을 비교해서, 이 사람의 글쓰기 취향 규칙을 25자 이내 한 줄로만 답해줘. 예: 교수님께는 결론부터 짧게. 규칙만 출력.\n\n초안: ${mailDraft}\n\n보낸 글: ${edited}`,
      true,
    );
    if (!a.ok) return setToast("✦ 보냈어요 (데모)");
    const rule = a.text.replace(/^[\s"'“”]+|[\s"'“”.]+$/g, "").slice(0, 60);
    const prev = facts;
    setFacts((f) => upsert(f, { kind: "habit", key: "habit:mail-style", label: "글쓰기 취향", value: rule, source: "고쳐 보낸 메일에서 배움", confidence: 0.7 }));
    setMailDraft("");
    setNoteUndo(() => () => setFacts(prev));
    setToast(`✦ 배웠어요: ${rule}`);
  };

  const undoMail = () => {
    setMail({ to: "", subject: "", body: "" });
    setMailUsed([]);
    setMarks({});
    setFilled(false);
  };

  const openApp = (a: AppId) => {
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
    setFocusQ(null);
    g.reset();
    if (a === "alter") markDone("menu");
  };

  const stopTour = () => {
    tourLive.current = false;
    setCaption("");
  };

  // a guided run of the same actions a visitor would take; touching the screen or Esc hands control back at once
  const startTour = async () => {
    tourLive.current = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const scenes: [string, () => void | Promise<void>, number][] = [
      ["① 글을 읽고 있으면 Alter가 먼저 말을 걸어요", () => { openApp("browser"); setTab("article"); void g.load(false); }, 5500],
      ["② 단어를 고르면 한국어로 바로 설명해요", () => explain({ x: 260, y: 330, text: "pairformer", context: ARTICLE_TEXT }), 5000],
      ["③ 양식은 알아서 채워요. 되돌리기는 한 번이에요", () => { openApp("browser"); setTab("signup"); }, 5000],
      ["④ 카드·비밀번호는 Alter가 읽지 않고, 보관함에서 채워요", () => { openApp("browser"); setTab("bank"); }, 5000],
      ["⑤ 메일을 열면 읽은 글로 답장 초안을 써요", async () => { openApp("mail"); await wait(1200); await draftMail(); }, 5000],
      ["⑥ 대시보드에서 오늘 뭘 해야 하는지 물어보세요", () => openApp("alter"), 4000],
    ];
    for (const [text, act, ms] of scenes) {
      if (!tourLive.current) return;
      setCaption(text);
      await act();
      await wait(ms);
    }
    if (tourLive.current) {
      setCaption("이제 직접 해 보세요. 왼쪽 ‘다음’을 따라가면 돼요");
      await wait(4500);
    }
    stopTour();
  };

  // "이어서": jump to where the unfinished thing lives
  const resume = (a: ResumeAction) => {
    if (a.type === "note") return setToast(`✦ ${a.text}`);
    if (a.type === "app") return openApp(a.app);
    openApp("browser");
    setTab(a.tab);
  };

  // Alter answers from the person's whole day, not just the question: that is what makes "what should I do now?" answerable
  const askAnything = async (q: string, loose = false, onText?: (soFar: string) => void): Promise<AskResult> => {
    if (!code) return { ok: false, text: FAIL_TEXT.network };
    const reading = app === "browser" && tab === "article";
    const place = reading ? `브라우저에서 「${ARTICLE.title}」을 읽는 중` : app === "mail" ? "메일 앱" : app === "alter" ? "Alter 대시보드" : "브라우저";
    const context = dayContext({ done, place, read: handoff ? { title: handoff.title, term: handoff.term } : reading ? { title: ARTICLE.title } : null }) + (reading ? `\n\n지금 읽고 있는 글:\n${ARTICLE_TEXT}` : "");
    const r = await askStream({ code, q, context, facts: shareFacts().slice(0, 15).map(({ label, value }) => ({ label, value })) }, onText ?? (() => {}), loose);
    if (!r.ok) return { ok: false, text: FAIL_TEXT[r.reason] };
    if (learning === "on" && !loose) setFacts((f) => upsert(f, { kind: "activity", key: `activity:asked:${q.slice(0, 40)}`, label: "물어본 것", value: q.slice(0, 120), source: "Alter", confidence: 0.5 }));
    return { ok: true, text: r.data.text };
  };

  // HUD choices on the stuck-reading offer: each ends as one short line you can undo, never a growing card
  const easier = async () => {
    g.accept();
    setToast("✦ 쉽게 풀어 쓰는 중…");
    const a = await askAnything(EASY_Q);
    if (!a.ok) return setToast(`✦ ${a.text}`);
    const prev = handoff;
    setHandoff({ title: ARTICLE.title, term: "쉽게 다시", explanation: a.text, ts: Date.now() });
    addDone("ai");
    setNoteUndo(() => () => setHandoff(prev));
    setToast("✦ 이미지 생성 예로 풀어서 폰으로 보냈어요 · AI·개발 링에도 들어가요");
  };

  const nextTask = () => {
    g.accept();
    const next = PICKS.find((p) => p.ring === "bio") ?? PICKS[0];
    setToast(`✦ 다음 · ${next.title} (${next.meta.split(" · ").pop()})`);
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
    // forms fill themselves (standard fields are low-risk and Undo is one tap); only "explain" is gated by the toggle
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
          next = upsert(next, { kind: "identity", key: f.key, label: KEY_LABEL[f.key] ?? f.key, value, source: "이번 신청서", confidence: 0.8 });
          n++;
        }
      }
      setFacts(next);
      setToast(n ? `✦ 새로 배운 것 ${n}개` : "✦ 새로 배울 게 없어요");
    }
    setJoined(true);
  };

  const saveEdit = () => {
    if (!editing) return;
    setFacts((f) => f.map((x) => (x.id === editing.id ? { ...x, value: editing.value, source: "직접 고침", userEdited: true, isNew: false } : x)));
    setEditing(null);
  };

  // render only describes the actions (plain data); the work happens in runAction, called from handlers
  type ActionId = "fill" | "undo" | "draft" | "undoDraft" | "glance" | "settings" | "dashboard" | "phone" | "vault" | "guide";
  const actions: { id: ActionId; label: string }[] = [];
  if (app === "browser" && tab === "article") actions.push({ id: "glance", label: "이 글 요약하기" });
  if (app === "browser" && tab === "signup" && !joined && !denied) actions.push(filled ? { id: "undo", label: "자동 입력 되돌리기" } : { id: "fill", label: "이 양식 채우기" });
  if (app === "mail") actions.push(filled ? { id: "undoDraft", label: "초안 되돌리기" } : { id: "draft", label: "방금 읽은 내용으로 답장 초안 쓰기" });
  actions.push(
    { id: "dashboard", label: "진행중인 일 보기" },
    { id: "guide", label: "하루 가이드 말로 정하기" },
    { id: "vault", label: "보관함 열기" },
    { id: "settings", label: "Alter 메뉴 열기" },
    { id: "phone", label: "폰 연결하기" },
  );

  const runAction = (id: ActionId) => {
    setPalette(false);
    if (id === "fill") fill();
    else if (id === "undo") undo();
    else if (id === "draft") draftMail();
    else if (id === "undoDraft") undoMail();
    else if (id === "glance") {
      if (g.glance && g.glance.status !== "loading") g.open();
      else g.load(true);
    } else if (id === "dashboard") openApp("alter");
    else if (id === "vault") setVault(true);
    else if (id === "guide") setGuide(true);
    else if (id === "settings") openMenu();
    else openPhone();
  };

  const submitPalette = async () => {
    const q = paletteQ.trim();
    if (!q) return;
    setPaletteA({ ok: true, text: "…" });
    setPaletteA(await askAnything(q, false, (soFar) => setPaletteA({ ok: true, text: soFar })));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem("alter-welcome")) setWelcome(true);
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
          setPaletteQ("");
          setPaletteA(null);
        }
        return;
      }
      if (e.key === "Escape") {
        setPalette(false);
        setPopover(false);
        setCard(null);
        setSel(null);
        stopTour();
        g.minimize();
        return;
      }
      if (!palette) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, actions.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (paletteQ.trim()) void submitPalette();
        else if (actions[paletteIdx]) runAction(actions[paletteIdx].id);
      }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => kbRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const stopRef = useRef(() => {});
  useEffect(() => {
    stopRef.current = () => {
      if (tourLive.current) stopTour();
    };
  });
  useEffect(() => {
    const h = () => stopRef.current();
    window.addEventListener("pointerdown", h, true);
    return () => window.removeEventListener("pointerdown", h, true);
  }, []);

  // anything Alter opened closes itself when you click somewhere else (the docked panel stays until you close it)
  const outsideRef = useRef<(e: MouseEvent) => void>(() => {});
  useEffect(() => {
    outsideRef.current = (e) => {
      const t = e.target as Element;
      if (popover && !t.closest("[data-popover], [data-toggle]")) setPopover(false);
      if (card && !t.closest("[data-bubble]")) setCard(null);
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
  const gl = g.glance;
  const closedNames = INTERESTS.filter((i) => isClosed(done, i)).map((i) => i.short);
  const panelOpen = app === "browser" && tab === "article" && (gl?.status === "open" || gl?.status === "loading");
  const vaultOffer = app === "browser" && !vault && (tab === "bank" || (tab === "signup" && !joined));
  const closePanel = () => {
    g.dismiss();
    setFocusQ(null);
  };

  // the only thing Alter shows by itself: one short-lived line above the Dock
  const hud: React.ReactNode =
    denied ? (
      <span className="text-white/70">✦ 여기서는 멈춰 있어요. 아무것도 읽거나 배우지 않아요.</span>
    ) : toast ? (
      <>
        <span>{toast.startsWith("✦") ? toast : `✦ ${toast}`}</span>
        {noteUndo && (
          <button onClick={() => { noteUndo(); setToast(""); setNoteUndo(null); }} className="rounded-full border border-white/30 px-4 py-1.5 text-base">되돌리기</button>
        )}
      </>
    ) : app === "browser" && tab === "article" && gl?.status === "ready" && !gl.counted ? (
      <>
        <span>✦ 이 문단에서 한참 머물렀어요. 다음은?</span>
        <button onClick={easier} className="rounded-full bg-white px-4 py-1.5 text-base text-black">쉽게 다시</button>
        <button onClick={g.open} className="rounded-full border border-white/30 px-4 py-1.5 text-base">3줄 요약</button>
        <button onClick={nextTask} className="rounded-full border border-white/30 px-4 py-1.5 text-base">다음 태스크</button>
        <button aria-label="넘기기" onClick={g.dismiss} className="text-white/50 hover:text-white">✕</button>
      </>
    ) : app === "browser" && tab === "signup" && !joined && filled ? (
      <>
        <span>✦ 알아서 채웠어요</span>
        <button onClick={undo} className="rounded-full border border-white/30 px-4 py-1.5 text-base">되돌리기</button>
      </>
    ) : app === "browser" && tab === "signup" && !joined && fillMode === "ask" && !optedOut && detected ? (
      <>
        <span>✦ 이 양식을 채울까요?</span>
        <button onClick={fill} className="rounded-full bg-white px-4 py-1.5 text-base text-black">채우기</button>
      </>
    ) : app === "mail" && mailDrafting ? (
      <span>✦ 초안을 쓰는 중…</span>
    ) : app === "mail" && filled ? (
      <>
        <span>✦ 방금 읽은 글로 초안을 썼어요 · 채팅이었다면 복사 → 전환 → 붙여넣기 → 질문</span>
        <button onClick={undoMail} className="rounded-full border border-white/30 px-4 py-1.5 text-base">되돌리기</button>
      </>
    ) : app === "mail" && !mail.body ? (
      <>
        <span>✦ 방금 읽은 글로 답장 초안을 쓸까요?</span>
        <button onClick={draftMail} className="rounded-full bg-white px-4 py-1.5 text-base text-black">초안 쓰기</button>
      </>
    ) : null;

  const steps = [
    { done: tour.explained || g.nudges.opened > 0, text: "잠시 읽거나, 단어를 선택하고 ⌘E를 눌러 보세요", go: () => { openApp("browser"); setTab("article"); } },
    { done: tour.filled, text: "「세미나 신청」을 열어 보세요. 양식이 알아서 채워져요", go: () => { openApp("browser"); setTab("signup"); } },
    { done: tour.mailed, text: "메일을 열어 보세요. 답장 초안을 제안해요", go: () => openApp("mail") },
    { done: tour.menu, text: "✦로 링과 진행중인 일을 보세요", go: () => openMenu() },
    { done: tour.phone, text: "폰으로 QR을 찍어 보세요", go: () => openPhone() },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.findIndex((s) => !s.done);
  const styleRule = facts.find((f) => f.key === "habit:mail-style")?.value; // what Alter learned from edited drafts
  const closeWelcome = (mode: "tour" | "self") => {
    setWelcome(false);
    try {
      localStorage.setItem("alter-welcome", "1");
    } catch {}
    if (mode === "tour") void startTour();
    else steps[0].go();
  };
  const fromName = facts.find((f) => f.key === "name")?.value ?? "나";
  const fromEmail = facts.find((f) => f.key === "email")?.value ?? "";
  const appName = app === "browser" ? "브라우저" : app === "mail" ? "메일" : "Alter";

  return (
    <div className="h-full">
      {/* a tiny OS that fills its container: menu bar, windows, Dock. Alter lives at the OS layer above every app */}
      <div ref={osRef} className="relative h-full overflow-hidden bg-gradient-to-br from-[#d9cfe8] via-[#ead9d2] to-[#cfe0e8]">
        <div className="relative z-20 flex h-9 items-center justify-between bg-white/45 px-4 text-[13px] text-black/70 backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{appName}</span>
            <button onClick={() => void startTour()} className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">▶ 자동 안내</button>
            <span className="hidden gap-4 text-black/50 sm:flex"><span>파일</span><span>편집</span><span>보기</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">토 15:20</span>
            <button data-toggle aria-label="Alter 메뉴" onClick={toggleMenu} className={`rounded px-2.5 py-0.5 text-sm ${popover ? "bg-black text-white" : "hover:bg-black/10"}`}>
              ✦
            </button>
          </div>
        </div>

        {/* the page's title is wallpaper text, so there is no frame around the OS */}
        {app !== "alter" && (
          <div className="pointer-events-none absolute inset-x-0 top-9 px-4 pt-5 text-center [@media(max-height:700px)]:hidden">
            <h1 className="text-4xl font-semibold tracking-tight">Alter</h1>
            <p className="mt-1 text-base text-black/60">조용히 나를 배우고, 필요할 때 먼저 돕고, 나를 닮아 가요.</p>
            <p className="mt-1 text-xs text-black/40">녹화가 아니에요. 단어를 선택하고 ⌘E를 누르거나, 메뉴바의 ✦를 눌러 보세요.</p>
          </div>
        )}

        {/* first-run guide, styled like an OS notification; shown only where it fits beside the window.
            It hugs the browser window's left edge (window is 860px centered; the side panel shifts it 176px left) */}
        {app !== "alter" &&
          (coach === "open" ? (
            <div
              className="absolute top-44 z-10 hidden w-60 rounded-2xl border border-black/10 bg-white/85 p-4 text-sm shadow-xl backdrop-blur min-[1360px]:block"
              style={{ left: `max(1rem, calc(50% - ${panelOpen ? 858 : 682}px))` }}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  Alter 써 보기 <span className="text-black/40">{doneCount}/{steps.length}</span>
                </p>
                <button aria-label="가이드 숨기기" onClick={() => foldCoach("folded")} className="text-black/40 hover:text-black">✕</button>
              </div>
              <ul className="mt-2 space-y-2">
                {steps.map((s, i) => (
                  <li key={s.text}>
                    <button onClick={s.go} className={`flex w-full gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-black/5 ${s.done ? "text-black/40" : i === nextStep ? "bg-indigo-50 font-medium text-black" : "text-black/80"}`}>
                      <span className={s.done ? "text-green-600" : i === nextStep ? "text-indigo-600" : "text-black/30"}>{s.done ? "✓" : i === nextStep ? "→" : "○"}</span>
                      <span className={s.done ? "line-through" : ""}>{s.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {doneCount === steps.length && (
                <p className="mt-3 text-xs text-black/60">
                  이게 한 바퀴예요. Alter가 배우고, 돕고, 통제는 계속 내가 해요. <a href="#how" className="underline">어떻게 동작하나요</a>
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => foldCoach("open")}
              className="absolute top-44 z-10 hidden rounded-full bg-white/85 px-3 py-1.5 text-xs shadow backdrop-blur min-[1360px]:block"
              style={{ left: `max(1rem, calc(50% - ${panelOpen ? 858 : 682}px))` }}
            >
              가이드
            </button>
          ))}

        {/* menu-bar window: rings, picks, what Alter knows, settings */}
        {popover && (
          <div data-popover className="absolute right-3 top-10 z-30 max-h-[80%] w-[22rem] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <b className="text-base">Alter</b>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50">{denied ? "여기서는 멈춤" : learning === "on" ? "learning" : "학습 꺼짐"}</span>
            </div>

            {rings === "on" && (
              <section aria-label="오늘의 링" className="mt-3 rounded-xl bg-black/[0.03] p-3">
                <p className="text-sm font-semibold">{closedNames.length ? `${closedNames.join(", ")} 링을 완료했어요` : "오늘의 링"}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Rings done={done} size={96} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    {INTERESTS.map((i) => (
                      <div key={i.id} className="text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
                          <span className="flex-1 font-medium">{i.name}</span>
                          {isClosed(done, i) ? <span className="font-semibold text-rose-700">닫힘</span> : <span><b>{done[i.id]}</b><span className="text-black/50"> /{i.goal}</span></span>}
                        </div>
                        {!isClosed(done, i) && i.next && <p className="truncate pl-4 text-[11px] text-black/45">다음 · {i.next}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <p className="mb-1.5 mt-4 text-xs font-medium text-black/40">오늘 태스크 · {remaining(done)}개 남음</p>
            <ul className="space-y-1.5">
              {PICKS.map((p) => (
                <li key={p.title} className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.title}</span>
                    <span className="block text-xs text-black/50">{p.meta}</span>
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">✦ 브리핑</span>
                </li>
              ))}
            </ul>

            <p className="mb-1.5 mt-4 text-xs font-medium text-black/40">Alter가 아는 것</p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {shown.map((f) => (
                <li key={f.id} className="rounded-lg bg-black/[0.03] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-black/40">
                        {f.label} · {f.source}
                        {f.isNew && <span className="ml-1 rounded bg-black px-1 text-[10px] text-white">새로</span>}
                      </p>
                      {editing?.id === f.id ? (
                        <div className="mt-1 flex gap-1">
                          <input autoFocus value={editing.value} onChange={(e) => setEditing({ id: f.id, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveEdit()} className="min-w-0 flex-1 rounded border border-black/20 px-2 py-0.5" />
                          <button onClick={saveEdit} className="text-xs underline">저장</button>
                        </div>
                      ) : (
                        <p className="break-words">{f.value}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1 text-black/40">
                      <button aria-label="고치기" onClick={() => setEditing({ id: f.id, value: f.value })} className="hover:text-black">✎</button>
                      <button aria-label="지우기" onClick={() => setFacts((x) => x.filter((y) => y.id !== f.id))} className="hover:text-black">✕</button>
                    </div>
                  </div>
                  <div className="mt-1 h-1 rounded bg-black/5"><div className="h-1 rounded bg-black/40" style={{ width: `${Math.round(f.confidence * 100)}%` }} /></div>
                </li>
              ))}
            </ul>

            <p className="mb-1.5 mt-4 text-xs font-medium text-black/40">설정</p>
            <div className="flex flex-wrap gap-2">
              <Chips label="링" value={rings} options={[["on", "켬"], ["off", "끔"]]} onChange={setRings} />
              <Chips label="설명" value={trigger} options={[["manual", "직접"], ["auto", "자동"]]} onChange={setTrigger} />
              <Chips label="양식" value={fillMode} options={[["auto", "자동"], ["ask", "물어보기"], ["off", "끔"]]} onChange={setFillMode} />
              <Chips label="먼저 도와주기" value={proactivity} options={[["quiet", "조용히"], ["balanced", "보통"], ["eager", "적극"]]} onChange={setProactivity} />
              <Chips label="학습" value={learning} options={[["on", "켬"], ["off", "끔"]]} onChange={setLearning} />
            </div>
            {optOut.length > 0 && (
              <div className="mt-3 text-xs text-black/60">
                <p className="mb-1 font-medium text-black/40">양식을 채우지 않는 사이트</p>
                {optOut.map((h) => (
                  <p key={h} className="flex items-center justify-between">
                    <span className="font-mono">{h}</span>
                    <button onClick={() => saveOptOut(optOut.filter((x) => x !== h))} className="underline">다시 허용</button>
                  </p>
                ))}
              </div>
            )}
            {g.nudges.opened + g.nudges.dismissed > 0 && (
              <p className="mt-3 text-xs text-black/60">
                먼저 건넨 도움: 받음 {g.nudges.opened}, 넘김 {g.nudges.dismissed}.{!g.autoOffer && proactivity !== "quiet" && " 이제 ⌘E로 부를 때만 보여줘요."}
              </p>
            )}
            <p className="mt-3 text-xs text-black/50">읽지도 배우지도 않는 것: 비밀번호, 결제 칸, 은행 사이트.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setVault(true); setPopover(false); }} className="flex-1 rounded-full border border-black/15 py-1.5 text-xs">보관함</button>
              <button onClick={() => { setGuide(true); setPopover(false); }} className="flex-1 rounded-full border border-black/15 py-1.5 text-xs">하루 가이드</button>
            </div>
            <button onClick={() => { openPhone(); setPopover(false); }} className="mt-4 w-full rounded-full bg-black py-2 text-xs text-white">폰으로 이어서 보기</button>
          </div>
        )}

        {/* app windows: the Alter panel opens as its own window beside the browser, so the article is never covered */}
        <div className={`absolute inset-x-0 bottom-36 flex justify-center gap-3 px-4 ${app === "alter" ? "top-12" : "top-40 [@media(max-height:700px)]:top-12"}`}>
          {app === "browser" ? (
            <>
              <div className="relative flex h-full min-w-0 max-w-[860px] flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                <div className="flex items-center gap-2 bg-[#ece7e1] px-3 pt-2">
                  <div className="mr-2 flex gap-1.5 pb-2">
                    <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <i className="h-3 w-3 rounded-full bg-[#28c840]" />
                  </div>
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setSel(null); setCard(null); setJoined(false); setFilled(false); setDraft(null); setMarks({}); setDeclined(false); setFocusAsk(null); setFocusQ(null); g.reset(); }}
                      className={`rounded-t-lg px-4 py-1.5 text-sm ${tab === t.id ? "bg-white font-medium" : "text-black/60 hover:bg-white/50"}`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
                <div className="truncate border-b border-black/5 bg-black/[0.03] px-4 py-1.5 font-mono text-xs text-black/50">{host}</div>

                <div ref={contentRef} className="relative min-h-0 flex-1 overflow-y-auto p-6">
                  {/* trigger: a small chip next to a selection */}
                  {sel && (
                    <button data-chip onClick={() => explain(sel)} style={{ left: sel.x, top: sel.y }} className="absolute z-10 -translate-x-1/2 rounded-full bg-black px-3 py-1.5 text-xs text-white shadow-lg">
                      ✦ 설명 <span className="ml-1 opacity-50">⌘E</span>
                    </button>
                  )}

                  {/* after Undo: a small offer above the field you just focused, like an autofill dropdown */}
                  {focusAsk && tab === "signup" && (
                    <div data-askfill style={{ left: focusAsk.x, top: focusAsk.y }} className="absolute z-10 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-xl">
                      <span>✦ 아는 걸로 채울까요?</span>
                      <button onClick={() => fill()} className="rounded-full bg-black px-3 py-1 text-xs text-white">채우기</button>
                      <button
                        onClick={() => { saveOptOut([...optOut, host.split("/")[0]]); setFocusAsk(null); setToast("여기서는 다시 묻지 않을게요. ✦ 설정에서 바꿀 수 있어요."); }}
                        className="rounded-full border border-black/20 px-3 py-1 text-xs"
                      >
                        이 사이트에서는 그만
                      </button>
                    </div>
                  )}

                  {/* answer: a small bubble next to the word, gone on Esc */}
                  {(loading || card) && tab === "article" && (
                    <div data-bubble style={{ left: Math.max(8, Math.min(cardPos.x - 150, 420)), top: cardPos.y }} className="absolute z-10 w-72 rounded-xl border border-black/10 bg-white p-3 text-sm shadow-2xl">
                      {loading || !card ? (
                        <p className="text-black/50">✦ 찾는 중…</p>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <p className="font-medium">{card.term}</p>
                            <button aria-label="닫기" onClick={() => setCard(null)} className="text-black/40 hover:text-black">✕</button>
                          </div>
                          <p className={`mt-1 ${card.retry ? "text-amber-800" : "text-black/70"}`}>{card.text}</p>
                          {card.retry && (
                            <button onClick={() => explain(card.retry!)} className="mt-2 rounded-full bg-black px-3 py-1 text-xs text-white">다시 시도</button>
                          )}
                          {!card.live && !card.retry && <p className="mt-1 text-xs text-black/40">저장된 답변</p>}
                          {!card.retry && <p className="mt-2 text-[11px] text-black/40">채팅이었다면: 복사 → 앱 전환 → 붙여넣기 → 질문</p>}
                        </>
                      )}
                    </div>
                  )}

                  {tab === "article" && (
                    <article ref={articleRef} onMouseUp={onArticleMouseUp} className="mx-auto max-w-prose">
                      <p className="text-xs tracking-wide text-black/40">{ARTICLE.kicker}</p>
                      <h3 className="mt-1 text-2xl font-semibold">{ARTICLE.title}</h3>
                      {ARTICLE.paras.map((p, i) => (
                        <p key={i} className={`${i === 0 ? "mt-4" : "mt-3"} leading-relaxed text-black/80`}>{withHints(p)}</p>
                      ))}
                      <p className="mt-4 text-xs text-black/40">{ARTICLE.source}</p>
                      <p className="mt-4 rounded-lg bg-black/[0.04] px-3 py-2 text-sm text-black/50">영어 원문 그대로예요. 설명은 한국어로 나와요. 잠시 읽으면 Alter가 먼저 말을 걸고, 점선 단어를 선택하고 ⌘E를 눌러도 돼요.</p>
                    </article>
                  )}

                  {tab === "signup" && (
                    <form ref={formRef} onSubmit={onSubmit} onInput={onFormInput} onFocus={onFormFocus} className="mx-auto max-w-sm space-y-3">
                      <h3 className="text-xl font-semibold">단백질 설계 세미나 신청</h3>
                      {joined ? (
                        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">신청이 접수됐어요.</p>
                      ) : (
                        <>
                          <label className="block text-sm">이름{tag("name")}<input name="name" autoComplete="name" className={inp("name")} /></label>
                          <label className="block text-sm">이메일{tag("email")}<input name="email" type="email" autoComplete="email" className={inp("email")} /></label>
                          <label className="block text-sm">소속{tag("affiliation")}<input name="affiliation" autoComplete="organization" className={inp("affiliation")} /></label>
                          <label className="block text-sm">비밀번호<span className="ml-2 text-[11px] text-black/40">Alter는 건드리지 않아요. 보관함에서 직접 채워요</span><input name="password" type="password" autoComplete="new-password" className={inp("password")} /></label>
                          <label className="block text-sm">신청 이유{tag("motivation")}<textarea name="motivation" rows={3} className={inp("motivation")} /></label>
                          {draft && (
                            <p className="text-xs text-black/50">
                              근거: {draft.used.map((id) => facts.find((f) => f.id === id)?.value).filter(Boolean).join(", ") || "저장된 맥락"}
                              {!draft.live && " · 저장된 답변"}
                            </p>
                          )}
                          <button className="w-full rounded-lg bg-black py-2.5 text-white">신청하기</button>
                        </>
                      )}
                    </form>
                  )}

                  {tab === "bank" && (
                    <form onSubmit={(e) => e.preventDefault()} className="mx-auto max-w-sm space-y-3">
                      <h3 className="text-xl font-semibold">카드사 로그인</h3>
                      <label className="block text-sm">아이디<input name="userid" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
                      <label className="block text-sm">카드번호<input name="cardno" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
                      <label className="block text-sm">비밀번호<input name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" /></label>
                      <button className="w-full rounded-lg bg-black py-2.5 text-white">로그인</button>
                    </form>
                  )}
                </div>
              </div>

              {/* the Alter panel: its own window to the side. Summary first; a question navigates to its answer and back */}
              {vaultOffer && (
                <aside data-vault-offer className="flex h-full w-[260px] flex-none flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                  <div className="flex h-10 flex-none items-center gap-2 bg-[#ece7e1] px-3">
                    <span className="text-sm font-medium">✦ Alter</span>
                    <span className="text-xs text-black/40">· 보관함</span>
                  </div>
                  <div className="p-4 text-sm">
                    <p className="font-medium">이 양식을 보관함으로 채울 수 있어요</p>
                    <p className="mt-2 text-black/60">아이디·카드번호·비밀번호는 Alter가 읽지 않아요. 암호화된 보관함에서 가져와 채워요.</p>
                    <button onClick={() => { setVaultAuto(true); setVault(true); }} className="mt-4 w-full rounded-full bg-black py-2 text-xs text-white">보관함으로 채우기</button>
                    <p className="mt-2 text-[11px] text-black/40">데모 암호는 alter예요.</p>
                  </div>
                </aside>
              )}

              {panelOpen && (
                <aside data-glance className="flex h-full w-[340px] flex-none flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                  <div className="flex h-10 flex-none items-center gap-2 bg-[#ece7e1] px-3">
                    <span className="text-sm font-medium">✦ Alter</span>
                    <span className="text-xs text-black/40">· 이 글</span>
                    <button aria-label="닫기" onClick={closePanel} className="ml-auto text-black/40 hover:text-black">✕</button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
                    {!gl || gl.status === "loading" ? (
                      <div className="space-y-2" aria-label="불러오는 중">
                        <p className="text-black/50">✦ 같이 읽는 중…</p>
                        <div className="h-3 w-4/5 rounded bg-black/5" />
                        <div className="h-3 w-full rounded bg-black/5" />
                        <div className="h-3 w-3/5 rounded bg-black/5" />
                      </div>
                    ) : focusQ ? (
                      <div>
                        <button onClick={() => setFocusQ(null)} className="text-xs text-black/50 hover:text-black">← 요약</button>
                        <p className="mt-2 font-medium">{focusQ}</p>
                        {gl.answers[focusQ] ? (
                          <p className="mt-2 leading-relaxed text-black/80">{gl.answers[focusQ] === "…" ? "✦ 생각하는 중…" : gl.answers[focusQ]}</p>
                        ) : gl.errors[focusQ] ? (
                          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                            <p>{gl.errors[focusQ]}</p>
                            <button onClick={() => g.ask(focusQ)} className="mt-2 rounded-full bg-black px-3 py-1 text-xs text-white">다시 시도</button>
                          </div>
                        ) : null}
                        {gl.questions.filter((q) => q !== focusQ).length > 0 && (
                          <>
                            <p className="mb-1.5 mt-5 text-xs text-black/40">다른 질문</p>
                            <div className="flex flex-col gap-1.5">
                              {gl.questions.filter((q) => q !== focusQ).map((q) => (
                                <button key={q} onClick={() => { setFocusQ(q); if (!gl.answers[q]) void g.ask(q); }} className="rounded-lg border border-black/10 px-3 py-1.5 text-left hover:bg-black/[0.03]">{q}</button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-black/40">3줄 요약</p>
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-black/80">
                          {gl.gist.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                        {gl.questions.length > 0 && (
                          <>
                            <p className="mb-1.5 mt-5 text-xs font-medium text-black/40">이런 게 궁금할 수 있어요</p>
                            <div className="flex flex-col gap-1.5">
                              {gl.questions.map((q) => (
                                <button key={q} onClick={() => { setFocusQ(q); if (!gl.answers[q]) void g.ask(q); }} className="rounded-lg border border-black/10 px-3 py-2 text-left hover:bg-black/[0.03]">{q}</button>
                              ))}
                            </div>
                          </>
                        )}
                        <p className="mt-5 text-xs text-black/40" title={gl.why}>
                          이 문단에 머물러서 제안했어요 · ✦ 설정에서 더 조용하게{!gl.live && " · 저장된 답변"}
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </>
          ) : app === "mail" ? (
            <div className="flex h-full w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
              <div className="flex items-center gap-2 bg-[#ece7e1] px-3 py-2">
                <div className="flex gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <i className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="mx-auto text-sm text-black/60">새 메시지 · 김 교수님께 답장</span>
              </div>
              <div onInput={onFormInput} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 text-sm">
                <p className="text-black/50">보내는 사람: {fromName} {fromEmail && `<${fromEmail}>`}</p>
                <p className="rounded-lg bg-black/[0.04] p-3 text-black/60">
                  <span className="text-xs text-black/40">받은 편지 · 김 교수님 · 10월 22일</span>
                  <br />
                  다음 주 화요일(28일) 저널클럽은 AlphaFold 3 논문을 발표합니다. diffusion 모듈이 기존 구조 모듈과 어떻게 다른지 중심으로 정리해 주세요.
                </p>
                <label className="block">받는 사람{tag("to")}<input name="to" value={mail.to} onChange={(e) => setMail((m) => ({ ...m, to: e.target.value }))} placeholder="kim.prof@lab.example" className={inp("to")} /></label>
                <label className="block">제목{tag("subject")}<input name="subject" value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} className={inp("subject")} /></label>
                <label className="block">내용{tag("body")}<textarea name="body" rows={6} value={mail.body} onChange={(e) => setMail((m) => ({ ...m, body: e.target.value }))} className={inp("body")} /></label>
                {filled && styleRule && <p className="text-xs text-indigo-700">✦ 고쳐 보낸 메일에서 배운 취향을 참고했어요: {styleRule}</p>}
                {mailUsed.length > 0 && (
                  <p className="text-xs text-black/50">근거: {mailUsed.map((id) => facts.find((f) => f.id === id)?.value).filter(Boolean).join(", ") || "방금 읽은 글"}</p>
                )}
                <button onClick={() => void sendMail()} className="rounded-lg bg-black px-5 py-2 text-white">보내기</button>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border border-black/10 bg-[#faf8f5] shadow-lg">
              <div className="flex h-10 flex-none items-center gap-2 bg-[#ece7e1] px-3">
                <div className="flex gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <i className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="flex-1 text-center font-mono text-xs tracking-[0.14em] text-black/50">ALTER · 10월 24일 토</span>
              </div>
              <div className="min-h-0 flex-1">
                <Dashboard done={done} onResume={resume} onAsk={(q, onText) => askAnything(q, false, onText)} />
              </div>
            </div>
          )}
        </div>

        {caption && (
          <div className="pointer-events-none absolute left-1/2 top-12 z-40 -translate-x-1/2">
            <div className="flex max-w-[92vw] flex-wrap items-center justify-center gap-3 rounded-full bg-indigo-600 px-6 py-3 text-base text-white shadow-2xl">
              <span>▶ {caption}</span>
              <span className="text-sm text-white/70">화면을 누르거나 Esc로 멈춰요</span>
            </div>
          </div>
        )}

        {/* HUD */}
        {hud && (
          <div className="pointer-events-none absolute bottom-[5.5rem] left-1/2 z-30 -translate-x-1/2">
            <div className="pointer-events-auto flex max-w-[92vw] flex-wrap items-center justify-center gap-3 rounded-full bg-black/90 px-6 py-3.5 text-lg text-white shadow-2xl">{hud}</div>
          </div>
        )}

        {app !== "alter" && nextStep >= 0 && !welcome && (
          <button onClick={steps[nextStep].go} className="absolute bottom-5 left-5 z-20 max-w-[19rem] rounded-full bg-white/90 px-5 py-2.5 text-left text-sm shadow-lg backdrop-blur min-[1360px]:hidden">
            <span className="text-indigo-600">다음 →</span> {steps[nextStep].text}
          </button>
        )}

        <a href="#how" className="absolute bottom-5 right-5 z-20 hidden rounded-full bg-black/80 px-5 py-2.5 text-base font-medium text-white shadow-lg backdrop-blur sm:block">
          아래로 스크롤해서 어떻게 동작하는지 확인해보세요 ↓
        </a>

        {/* Dock: the last icon is the Alter app itself (the dashboard) */}
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-end gap-2 rounded-2xl bg-white/40 p-2 backdrop-blur">
          {([["browser", "🌐", "브라우저"], ["mail", "✉️", "메일"]] as const).map(([id, icon, name]) => (
            <button key={id} aria-label={name} onClick={() => openApp(id)} className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl text-2xl ${app === id ? "bg-white shadow" : "hover:bg-white/60"}`}>
              {icon}
            </button>
          ))}
          <button aria-label="Alter" onClick={() => openApp("alter")} className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl text-white ${app === "alter" ? "bg-indigo-600 shadow-md" : "bg-black"}`}>✦</button>
        </div>

        {welcome && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 p-4">
            <div className="w-[min(92%,460px)] rounded-2xl bg-white p-6 shadow-2xl">
              <p className="font-mono text-xs text-black/40">60초 체험</p>
              <h2 className="mt-1 text-xl font-semibold">직접 써 보세요. 설명서는 없어요</h2>
              <ol className="mt-4 space-y-2 text-sm text-black/75">
                <li>1. 글을 3초 읽어요. Alter가 먼저 말을 걸어요.</li>
                <li>2. 「세미나 신청」과 「카드사」 탭을 열어요. 양식을 채워 줘요.</li>
                <li>3. 메일을 열어요. 읽은 글로 답장 초안을 쓰고, 고쳐서 보내면 내 취향을 배워요.</li>
              </ol>
              <p className="mt-4 text-xs text-black/50">채팅창에 복사해 붙여넣지 않아도, 지금 보는 화면에서 바로 도와요.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => closeWelcome("tour")} className="flex-1 rounded-full bg-black py-2.5 text-sm text-white">▶ 자동으로 보기 (60초)</button>
                <button onClick={() => closeWelcome("self")} className="rounded-full border border-black/15 px-4 py-2.5 text-sm">직접 해 볼게요</button>
              </div>
            </div>
          </div>
        )}

        {/* Raycast-style palette: ⌘E with nothing selected. Type anything, or pick what fits right now */}
        {palette && (
          <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={() => setPalette(false)}>
            <div className="w-[min(92%,560px)] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
                <span className="text-black/40">✦</span>
                <input
                  autoFocus
                  value={paletteQ}
                  onChange={(e) => { setPaletteQ(e.target.value); setPaletteA(null); }}
                  placeholder="Alter에게 적기… 무엇이든 물어보세요"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-black/40"
                />
              </div>
              {paletteA ? (
                <div className={`p-4 text-sm ${paletteA.ok ? "text-black/80" : "bg-amber-50 text-amber-900"}`}>
                  <p className="whitespace-pre-line">{paletteA.text === "…" ? "✦ 오늘 하루를 보고 있어요…" : paletteA.text}</p>
                  {!paletteA.ok && <button onClick={() => void submitPalette()} className="mt-2 rounded-full bg-black px-3 py-1 text-xs text-white">다시 시도</button>}
                </div>
              ) : (
                <ul className="p-2">
                  {actions.map((a, i) => (
                    <li key={a.id}>
                      <button onMouseEnter={() => setPaletteIdx(i)} onClick={() => runAction(a.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${i === paletteIdx ? "bg-black text-white" : ""}`}>
                        {a.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-black/5 px-4 py-2 text-xs text-black/40">적고 ↵ 물어보기 · ↑↓ 고르기 · esc 닫기</div>
            </div>
          </div>
        )}
      </div>

      {vault && (
        <Vault
          autoFill={vaultAuto}
          onClose={() => { setVault(false); setVaultAuto(false); }}
          canFill={app === "browser" && (tab === "bank" || tab === "signup")}
          onFill={(values) => {
            // only the item the person tapped arrives here; the bank page itself is never read
            const byName: Record<string, string | undefined> = { userid: values.account, cardno: values.card?.split(" · ")[0], password: values.password };
            for (const [n, v] of Object.entries(byName)) {
              const el = v ? contentRef.current?.querySelector<HTMLInputElement>(`input[name=${n}]`) : null;
              if (el && v) setValue(el, v);
            }
            setVault(false);
            setVaultAuto(false);
            setToast("✦ 보관함에서 채웠어요. 기록에 남아요");
          }}
        />
      )}
      {guide && (
        <GuideSetup
          onClose={() => setGuide(false)}
          ask={(q) => askAnything(q, true)}
          onSave={(ring, summary) => {
            const name = INTERESTS.find((i) => i.id === ring)?.short ?? ring;
            setFacts((f) => upsert(f, { kind: "habit", key: `habit:guide:${ring}`, label: "하루 가이드", value: `${name}: ${summary}`.slice(0, 280), source: "말로 정함", confidence: 0.9 }));
          }}
        />
      )}
      {showPhone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPhone(false)}>
          <div className="rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium">폰으로 QR을 찍어 보세요</p>
            <p className="mt-1 text-sm text-black/50">방금 한 일이 그대로 이어져요.</p>
            <div className="my-4 flex justify-center">{phoneUrl && <QRCodeSVG value={phoneUrl} size={180} />}</div>
            <p className="font-mono text-sm tracking-widest">{code}</p>
            <button onClick={() => setShowPhone(false)} className="mt-4 rounded-full border border-black/20 px-4 py-1.5 text-sm">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

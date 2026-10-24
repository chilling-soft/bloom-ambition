"use client";

import { useRef, useState } from "react";
import { INTERESTS, isClosed, PICKS, remaining, WEEK, type Done } from "@/lib/rings";
import { WORK, type ResumeAction } from "@/lib/work";
import { MiniRings, Rings } from "./Rings";

const mono = "font-mono text-[11px] tracking-[0.08em] text-black/50";
const FOLLOW = ["화요일 발표 개요 만들어줘", "오늘 남은 걸 우선순위로 정리해줘"];
const STARTERS = ["나 이제 뭘 해야 돼?", "오늘 뭐 남았어?", "화요일 발표 준비, 어디부터 할까?"];
const TAG: Record<string, string> = { life: "bg-amber-700/10 text-amber-800", ai: "bg-indigo-600/10 text-indigo-700", bio: "bg-emerald-600/10 text-emerald-700", esports: "bg-rose-600/10 text-rose-700" };
const TAG_NAME: Record<string, string> = { life: "생활", ai: "AI·개발", bio: "바이오", esports: "이스포츠" };

type SR = { new (): { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; start: () => void } };
export type AskResult = { ok: boolean; text: string };

export function Dashboard({ done, onResume, onAsk }: { done: Done; onResume: (a: ResumeAction) => void; onAsk: (q: string, onText?: (soFar: string) => void) => Promise<AskResult> }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const closed = INTERESTS.filter((i) => isClosed(done, i));
  const headline = closed.length ? `${closed.map((i) => i.short).join(", ")} 링을 완료했어요` : "오늘의 링";

  const submit = async (text: string, speak = false) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    setBusy(true);
    setAnswer(null);
    // words appear as they are written; the box replaces the spinner at the first word
    const a = await onAsk(t, (soFar) => {
      setBusy(false);
      setAnswer({ q: t, text: soFar, ok: true });
    });
    setAnswer({ q: t, text: a.text, ok: a.ok });
    setBusy(false);
    if (a.ok && speak && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(a.text);
      u.lang = "ko-KR";
      window.speechSynthesis.speak(u);
    }
  };

  // voice uses the browser's own speech recognition; no extra service
  const talk = () => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setAnswer({ q: "", text: "이 브라우저는 음성 인식을 지원하지 않아요. 적어서 물어봐 주세요.", ok: false });
      inputRef.current?.focus();
      return;
    }
    const rec = new Rec();
    rec.lang = "ko-KR";
    setListening(true);
    rec.onresult = (e) => void submit(e.results[0][0].transcript, true);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[#faf8f5] p-5">
      <div className="flex gap-2.5">
        <button onClick={talk} className="flex h-14 w-56 flex-none items-center justify-center gap-2 rounded-full bg-black text-base font-semibold text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
          {listening ? "듣고 있어요…" : "✦ 말하기"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(q);
          }}
          className="flex h-14 flex-1 items-center gap-2 rounded-full border border-black/10 bg-white px-5"
        >
          <label htmlFor="ask-dash" className="sr-only">Alter에게 적기</label>
          <input ref={inputRef} id="ask-dash" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Alter에게 적기…" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-black/40" />
          <span className="font-mono text-xs text-black/40">⌘E</span>
        </form>
      </div>

      {/* starter questions: a first-time visitor sees what to try, and each one has a good answer */}
      {!answer && !busy && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-black/40">이렇게 물어보세요</span>
          {STARTERS.map((s) => (
            <button key={s} onClick={() => void submit(s)} className="rounded-full border border-black/10 bg-white px-3 py-1 text-black/70 hover:bg-black/[0.03]">{s}</button>
          ))}
        </div>
      )}

      {busy && <div className="rounded-2xl bg-white p-4 text-sm text-black/50 shadow-sm">✦ 오늘 하루를 보고 있어요…</div>}
      {answer && (
        <div className={`rounded-2xl p-4 text-sm shadow-sm ${answer.ok ? "bg-white" : "bg-amber-50"}`}>
          {answer.q && <p className="text-xs text-black/40">{answer.q}</p>}
          <p className={`mt-1 whitespace-pre-line ${answer.ok ? "text-black/80" : "text-amber-900"}`}>{answer.text}</p>
          {answer.ok && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {FOLLOW.filter((f) => f !== answer.q).map((f) => (
                <button key={f} onClick={() => void submit(f)} className="rounded-full border border-black/10 px-3 py-1 text-black/70 hover:bg-black/[0.03]">{f}</button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2 text-xs">
            {!answer.ok && answer.q && <button onClick={() => void submit(answer.q)} className="rounded-full bg-black px-3 py-1 text-white">다시 시도</button>}
            <button onClick={() => { setAnswer(null); setQ(""); }} className="rounded-full border border-black/15 px-3 py-1 text-black/60">닫기</button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <section aria-label="오늘의 링" className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">{headline}</h2>
          <div className="flex justify-center">
            <Rings done={done} size={170} />
          </div>
          <div className="flex flex-col gap-2">
            {INTERESTS.map((i) => (
              <div key={i.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
                  <span className="flex-1 font-medium">{i.name}</span>
                  {isClosed(done, i) ? <span className="font-semibold text-rose-700">닫힘</span> : <span><b>{done[i.id]}</b><span className="text-black/50"> /{i.goal}</span></span>}
                </div>
                <span className="pl-4 text-xs text-black/50">오늘 {i.goal}개 · {i.why}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto grid grid-cols-7 gap-1.5 border-t border-black/5 pt-3">
            {WEEK.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-1">
                <MiniRings fill={d.fill} />
                <span className={`text-[11px] ${d.today ? "font-semibold text-black" : "text-black/45"}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="진행중인 일" className="flex min-w-0 flex-col gap-2.5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 text-base font-semibold">진행중인 일</h2>
            <span className={mono}>누르면 그 창으로</span>
          </div>
          {WORK.map((w) => (
            <button key={w.title} onClick={() => onResume(w.action)} className="flex min-h-16 items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2 text-left hover:bg-black/[0.06]">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-black/10 bg-white text-[13px] font-semibold" style={{ color: w.iconColor }}>{w.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{w.title}</span>
                <span className="block text-xs text-black/50">{w.where}</span>
              </span>
              <span className={`flex-none rounded-full px-2 py-0.5 text-xs ${TAG[w.ring]}`}>{TAG_NAME[w.ring]}</span>
              <span className="flex-none rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-black/60">{w.device}</span>
              <span className="flex-none rounded-full bg-black px-3.5 py-1.5 text-[13px] font-medium text-white">이어서</span>
            </button>
          ))}
        </section>

        <section aria-label="오늘 태스크" className="flex flex-col gap-2.5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 text-base font-semibold">오늘 태스크</h2>
            <span className={mono}>{remaining(done)}개 남음</span>
          </div>
          {PICKS.map((p) => (
            <div key={p.title} className="flex flex-col gap-1.5 rounded-xl bg-black/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <span className="flex-1 text-xs text-black/50">{p.meta}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">✦ 브리핑</span>
              </div>
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-1.5 border-t border-black/5 pt-3">
            <span className={mono}>오늘 긁어온 것</span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-emerald-700">논문 6</span>
              <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-indigo-700">릴리스 4</span>
              <span className="rounded-full bg-rose-600/10 px-2.5 py-0.5 text-rose-700">경기 1 · 뉴스 9</span>
              <span className="rounded-full bg-amber-700/10 px-2.5 py-0.5 text-amber-800">납부일 1 · 장보기 1</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

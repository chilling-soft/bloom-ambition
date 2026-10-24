"use client";

import { useRef, useState } from "react";
import { INTERESTS, isClosed, PICKS, WEEK, type Minutes } from "@/lib/rings";
import { MiniRings, Rings } from "./Rings";

export type ResumeAction = { type: "tab"; tab: "article" | "signup" | "bank" } | { type: "app"; app: "browser" | "mail" } | { type: "note"; text: string };

type Work = { icon: string; iconColor: string; title: string; where: string; device: string; action: ResumeAction };

// what Alter picked up from your screens: app, device, when, and how far you got
const WORK: Work[] = [
  { icon: "카드", iconColor: "#111111", title: "카드 자동납부 계좌 변경", where: "카드사 사이트 · 어제 22:10 · 2/3단계", device: "노트북", action: { type: "tab", tab: "bank" } },
  { icon: "{ }", iconColor: "#4338CA", title: "diffusion-toy / train.py", where: "VS Code · 11:40 · 에러에서 멈춤", device: "노트북", action: { type: "note", text: "VS Code는 데스크톱 센서가 있어야 이어갈 수 있어요. 다음 단계에서 지원해요." } },
  { icon: "PDF", iconColor: "#047857", title: "AlphaFold 3 — diffusion 모듈", where: "브라우저 · 12:45 · 62% 읽음", device: "폰", action: { type: "tab", tab: "article" } },
  { icon: "▶", iconColor: "#BE123C", title: "T1 vs GEN 3세트 시청중", where: "유튜브 · 12:50 · 14분 남음", device: "폰", action: { type: "note", text: "유튜브는 폰에서 이어서 볼 수 있어요. (데모에서는 연결하지 않았어요)" } },
  { icon: "메일", iconColor: "#111111", title: "교수님께 답장 — 발표 자료 형식", where: "Mail · 09:12 · 초안 저장됨", device: "노트북", action: { type: "app", app: "mail" } },
];

const mono = "font-mono text-[11px] tracking-[0.08em] text-black/50";

type SR = { new (): { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; start: () => void } };

export function Dashboard({ minutes, onResume, onAsk }: { minutes: Minutes; onResume: (a: ResumeAction) => void; onAsk: (q: string) => Promise<string> }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const closed = INTERESTS.filter((i) => isClosed(minutes, i));
  const headline = closed.length ? `${closed.map((i) => i.name.split(" ")[0]).join(", ")} 링을 완료했어요` : "오늘의 링";

  const submit = async (text: string, speak = false) => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setAnswer({ q: t, text: "…" });
    const a = await onAsk(t);
    setAnswer({ q: t, text: a });
    setBusy(false);
    if (speak && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(a);
      u.lang = "ko-KR";
      window.speechSynthesis.speak(u);
    }
  };

  // voice uses the browser's own speech recognition; no extra service
  const talk = () => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setAnswer({ q: "", text: "이 브라우저는 음성 인식을 지원하지 않아요. 적어서 물어봐 주세요." });
      inputRef.current?.focus();
      return;
    }
    const rec = new Rec();
    rec.lang = "ko-KR";
    setListening(true);
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setQ(said);
      void submit(said, true);
    };
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

      {answer && (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          {answer.q && <p className="text-xs text-black/40">{answer.q}</p>}
          <p className="mt-1 text-black/80">{busy ? "…" : answer.text}</p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <section aria-label="오늘의 링" className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">{headline}</h2>
          <div className="flex justify-center">
            <Rings minutes={minutes} size={176} />
          </div>
          <div className="flex flex-col gap-2.5">
            {INTERESTS.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
                <span className="flex-1 font-medium">{i.name}</span>
                {isClosed(minutes, i) ? (
                  <span className="font-semibold text-rose-700">닫힘</span>
                ) : (
                  <span>
                    <b>{minutes[i.id]}</b>
                    <span className="text-black/50">/{i.goal}분</span>
                  </span>
                )}
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
              <span className="flex-none rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-black/60">{w.device}</span>
              <span className="flex-none rounded-full bg-black px-3.5 py-1.5 text-[13px] font-medium text-white">이어서</span>
            </button>
          ))}
        </section>

        <section aria-label="오늘 볼 것" className="flex flex-col gap-2.5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-baseline gap-2">
            <h2 className="flex-1 text-base font-semibold">오늘 볼 것</h2>
            <span className={mono}>3개 · 약 35분</span>
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
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

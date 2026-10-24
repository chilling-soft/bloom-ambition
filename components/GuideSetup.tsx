"use client";

import { useState } from "react";
import { INTERESTS, type RingId } from "@/lib/rings";

type Reply = { ok: boolean; text: string };
type Props = { onClose: () => void; onSave: (ring: RingId, summary: string) => void; ask: (q: string) => Promise<Reply> };
type SR = { new (): { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; start: () => void } };

const STEPS: { id: RingId; prompt: string }[] = [
  { id: "bio", prompt: "바이오는 하루에 몇 개쯤, 어떻게 챙겨 드릴까요?" },
  { id: "ai", prompt: "AI·개발은요?" },
];
const EXAMPLE = "2~3개. 본업 바쁠 땐 1개만. AlphaFold 쪽에 새 논문 나오면 꼭 알려줘";
const CANNED = { similar: "하루 2개 / 바쁠 땐 1개 / 바이오와 같은 방식", fewer: "하루 1개 / 바쁠 땐 건너뛰기 / 꼭 릴리스 소식만" };

// First run: say (or type) how many tasks a day you want per interest; Alter folds it into three short pieces to confirm.
export function GuideSetup({ onClose, onSave, ask }: Props) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"input" | "busy" | "summary" | "choices" | "done">("input");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const cur = STEPS[step];
  const interest = INTERESTS.find((i) => i.id === cur.id)!;
  const last = step === STEPS.length - 1;

  const submit = async (said: string) => {
    const t = said.trim();
    if (!t) return;
    setText(t);
    setError("");
    setPhase("busy");
    const r = await ask(`다음 말을 정확히 세 조각으로 짧게 요약해줘. 형식: 하루 N개 / 바쁠 땐 … / 꼭 …. 말: ${t}`);
    if (r.ok) {
      setSummary(r.text);
      setPhase("summary");
    } else {
      setError(r.text);
      setPhase("input");
    }
  };

  // voice uses the browser's own speech recognition; typing always works
  const talk = () => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) return setError("이 브라우저는 음성 인식을 지원하지 않아요. 적어서 알려 주세요.");
    const rec = new Rec();
    rec.lang = "ko-KR";
    setListening(true);
    rec.onresult = (e) => void submit(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const next = () => {
    if (last) return setPhase("done");
    setStep(step + 1);
    setText("");
    setPhase("choices");
  };

  const accept = () => {
    onSave(cur.id, summary);
    next();
  };

  const canned = (s: string) => {
    onSave(cur.id, s);
    setPhase("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Alter 가이드 정하기" className="w-[min(92vw,440px)] rounded-2xl bg-white p-5 text-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-medium text-black/50">
            <span className="h-2 w-2 rounded-full" style={{ background: interest.color }} />✦ 처음 한 번, 말로 정하기 · {step + 1}/{STEPS.length}
          </p>
          <button aria-label="닫기" onClick={onClose} className="text-black/40 hover:text-black">✕</button>
        </div>

        {phase === "done" ? (
          <div className="mt-4">
            <p className="text-base font-semibold">가이드가 저장됐어요.</p>
            <p className="mt-1 text-black/60">언제든 ✦ 메뉴에서 고칠 수 있어요.</p>
            <button onClick={onClose} className="mt-4 w-full rounded-full bg-black py-2.5 text-white">닫기</button>
          </div>
        ) : phase === "choices" ? (
          <div className="mt-4">
            <p className="text-base font-semibold">{cur.prompt}</p>
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={() => canned(CANNED.similar)} className="rounded-full border border-black/15 px-4 py-2 text-left hover:bg-black/[0.03]">바이오랑 비슷하게</button>
              <button onClick={() => canned(CANNED.fewer)} className="rounded-full border border-black/15 px-4 py-2 text-left hover:bg-black/[0.03]">더 적게</button>
              <button onClick={() => setPhase("input")} className="rounded-full bg-black px-4 py-2 text-left text-white">말로 할게요</button>
            </div>
          </div>
        ) : phase === "summary" ? (
          <div className="mt-4">
            <p className="text-xs text-black/40">{text}</p>
            <p className="mt-2 rounded-xl bg-black/[0.04] p-3 text-base font-medium">{summary}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={accept} className="flex-1 rounded-full bg-black py-2 text-white">맞아요</button>
              <button onClick={() => setPhase("input")} className="flex-1 rounded-full border border-black/15 py-2">고칠게요</button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-base font-semibold">{cur.prompt}</p>
            <button onClick={talk} disabled={phase === "busy"} className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-black text-base font-semibold text-white disabled:opacity-60">
              {phase === "busy" ? "✦ 정리하는 중…" : listening ? "듣고 있어요…" : "✦ 말하기"}
            </button>
            <form onSubmit={(e) => { e.preventDefault(); void submit(text); }} className="mt-2 flex gap-2">
              <label htmlFor="guide-text" className="sr-only">Alter에게 적기</label>
              <input id="guide-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="또는 적기…" className="min-w-0 flex-1 rounded-full border border-black/15 px-4 py-2 outline-none" />
              <button disabled={phase === "busy"} className="rounded-full border border-black/15 px-4 py-2">보내기</button>
            </form>
            <button onClick={() => setText(EXAMPLE)} className="mt-2 rounded-full bg-black/5 px-3 py-1 text-left text-xs text-black/60 hover:bg-black/10">{EXAMPLE}</button>
            {error && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                <p>{error}</p>
                <button onClick={() => void submit(text)} className="mt-2 rounded-full bg-black px-3 py-1 text-xs text-white">다시 시도</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

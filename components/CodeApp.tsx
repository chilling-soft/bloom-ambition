"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskResult } from "./Dashboard";

// A small VS Code-like window with one real bug. The traceback is derived from the code lines below,
// so the error line numbers can never drift from what is shown.
const BUG = "    a = alphas_bar[t]";
const FIX = "    a = alphas_bar[t].view(-1, 1, 1, 1)";
const CODE = [
  "import torch",
  "import torch.nn.functional as F",
  "from torch.utils.data import DataLoader",
  "from model import UNet",
  "from data import ds",
  "",
  "T = 1000",
  "betas = torch.linspace(1e-4, 0.02, T)",
  "alphas_bar = torch.cumprod(1.0 - betas, dim=0)  # (T,)",
  "",
  "def q_sample(x0, t, noise):",
  "    # x0: (B, 3, 32, 32), t: (B,)",
  BUG,
  "    return a.sqrt() * x0 + (1 - a).sqrt() * noise",
  "",
  "loader = DataLoader(ds, batch_size=16, shuffle=True)",
  "model = UNet(in_ch=3)",
  "opt = torch.optim.AdamW(model.parameters(), lr=2e-4)",
  "",
  "for step, x0 in enumerate(loader):",
  "    t = torch.randint(0, T, (x0.shape[0],))",
  "    noise = torch.randn_like(x0)",
  "    xt = q_sample(x0, t, noise)",
  "    pred = model(xt, t)",
  "    loss = F.mse_loss(pred, noise)",
  "    opt.zero_grad(); loss.backward(); opt.step()",
  '    if step % 100 == 0: print(f"step {step} loss {loss.item():.4f}")',
];
const lineOf = (s: string) => CODE.findIndex((l) => l.startsWith(s)) + 1;
const BUG_LINE = CODE.indexOf(BUG) + 1;

const TRACEBACK = [
  "$ python train.py",
  "Traceback (most recent call last):",
  `  File "train.py", line ${lineOf("    xt = q_sample")}, in <module>`,
  "    xt = q_sample(x0, t, noise)",
  `  File "train.py", line ${lineOf("    return a.sqrt()")}, in q_sample`,
  "    return a.sqrt() * x0 + (1 - a).sqrt() * noise",
  "RuntimeError: The size of tensor a (16) must match the size of tensor b (32) at non-singleton dimension 3",
].join("\n");

const PASS = ["$ python train.py", "step 0 loss 1.0214", "step 100 loss 0.3871", "step 200 loss 0.2415", "step 300 loss 0.1962"].join("\n");

const codeText = (fixed: boolean) => CODE.map((l) => (l === BUG && fixed ? FIX : l)).join("\n");

type Kind = "why" | "fix" | "sel";
type CardState = { kind: Kind; status: "loading" | "done" | "fail"; text: string };
type Ask = (q: string, extra: string, onText: (soFar: string) => void) => Promise<AskResult>;

const TITLE: Record<Kind, string> = { why: "원인", fix: "고칠 코드", sel: "선택한 코드" };

export function CodeApp({ ask }: { ask: Ask }) {
  const [fixed, setFixed] = useState(false);
  const [offer, setOffer] = useState(false);
  const [card, setCard] = useState<CardState | null>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const req = useRef(0); // only the newest question may write into the card
  const askRef = useRef(ask);
  const fixedRef = useRef(fixed);
  useEffect(() => {
    askRef.current = ask;
    fixedRef.current = fixed;
  });

  // stuck on an error: after a few seconds Alter offers help once
  useEffect(() => {
    const t = setTimeout(() => setOffer(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const run = useCallback(async (kind: Kind, q: string) => {
    const id = ++req.current;
    setOffer(false);
    setCard({ kind, status: "loading", text: "" });
    const extra = `열려 있는 파일 train.py:\n${codeText(fixedRef.current)}\n\n터미널:\n${fixedRef.current ? PASS : TRACEBACK}`;
    const r = await askRef.current(q, extra, (soFar) => {
      if (req.current === id) setCard({ kind, status: "loading", text: soFar });
    });
    if (req.current === id) setCard({ kind, status: r.ok ? "done" : "fail", text: r.text });
  }, []);

  const why = () => run("why", "이 에러가 왜 났는지, 코드의 어느 줄 때문인지 두세 문장으로 설명해줘. 터미널의 텐서 크기와 코드의 shape 주석을 근거로 써줘.");
  const fix = () =>
    run("fix", `train.py ${BUG_LINE}번째 줄 "a = alphas_bar[t]"를 "a = alphas_bar[t].view(-1, 1, 1, 1)"로 바꾸면 왜 이 에러가 사라지는지 두 문장으로 설명해줘.`);

  // select a line, press ⌘E: capture phase so the demo's own ⌘E (command palette) does not also open
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e")) return;
      const s = window.getSelection();
      const text = s?.toString().trim() ?? "";
      if (!text || !s?.anchorNode || !codeRef.current?.contains(s.anchorNode)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void run("sel", `train.py에서 사용자가 선택한 코드가 무엇을 하는지, 이 에러와 관계가 있는지 두 문장으로 설명해줘: ${text.slice(0, 150)}`);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [run]);

  const close = () => {
    req.current++;
    setCard(null);
    setOffer(true);
  };
  const setFix = (on: boolean) => {
    req.current++;
    setFixed(on);
    setCard(null);
    setOffer(false);
  };

  return (
    <>
      <div className="relative flex h-[calc(100%-4.5rem)] min-w-0 max-w-[860px] flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-[#1e1e1e] shadow-lg">
        <div className="flex items-center gap-2 bg-[#2b2b2b] px-3 pt-2">
          <div className="mr-2 flex gap-1.5 pb-2">
            <i className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <i className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <i className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="rounded-t-lg bg-[#1e1e1e] px-4 py-1.5 font-mono text-xs text-white/80">train.py</span>
          <span className="pb-1.5 text-xs text-white/40">diffusion-toy</span>
        </div>
        <pre ref={codeRef} data-code className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px] leading-5 text-[#d4d4d4]">
          {CODE.map((l, i) => {
            const text = fixed && l === BUG ? FIX : l;
            return (
              <div key={i} className={`flex px-2 ${i + 1 === BUG_LINE && !fixed ? "bg-red-500/20" : fixed && l === BUG ? "bg-emerald-500/15" : ""}`}>
                <span className="mr-4 w-6 flex-none select-none text-right text-white/30">{i + 1}</span>
                <span className="whitespace-pre">{text || " "}</span>
              </div>
            );
          })}
        </pre>
        <div className="h-44 flex-none overflow-auto border-t border-white/10 bg-[#181818] px-3 py-2">
          <p className="font-sans text-[11px] uppercase tracking-wide text-white/40">터미널</p>
          <pre data-terminal className={`mt-1 whitespace-pre-wrap break-words font-mono text-[12px] leading-5 ${fixed ? "text-emerald-300" : "text-red-300"}`}>{fixed ? PASS : TRACEBACK}</pre>
        </div>
      </div>

      {card && (
        <aside data-code-card className="flex h-[calc(100%-4.5rem)] w-[340px] flex-none flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
          <div className="flex h-10 flex-none items-center gap-2 bg-[#ece7e1] px-3">
            <span className="text-sm font-medium">✦ Alter</span>
            <span className="text-xs text-black/40">· {TITLE[card.kind]}</span>
            <button aria-label="닫기" onClick={close} className="ml-auto text-black/40 hover:text-black">✕</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
            {card.status === "loading" && !card.text && <p className="text-black/50">코드와 에러를 읽는 중…</p>}
            {card.status === "fail" ? (
              <>
                <p className="text-amber-800">{card.text}</p>
                <button onClick={card.kind === "why" ? why : fix} className="mt-2 rounded-full bg-black px-3 py-1 text-xs text-white">다시 시도</button>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-black/80">{card.text}</p>
            )}
            {card.kind === "fix" && card.status !== "fail" && (
              <div className="mt-4">
                <pre data-diff className="overflow-x-auto rounded-lg bg-[#1e1e1e] p-3 font-mono text-[11.5px] leading-5">
                  <div className="text-red-300">- {BUG.trim()}</div>
                  <div className="text-emerald-300">+ {FIX.trim()}</div>
                </pre>
                <button data-apply onClick={() => setFix(true)} className="mt-3 w-full rounded-full bg-black py-2 text-xs text-white">적용해 보기</button>
              </div>
            )}
          </div>
        </aside>
      )}

      {fixed && (
        <div className="absolute bottom-1 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 whitespace-nowrap rounded-full bg-black/90 px-6 py-3.5 text-lg text-white shadow-2xl">
            <span>✦ 고쳐서 돌려 봤어요. 학습이 시작됐어요</span>
            <button data-undo onClick={() => setFix(false)} className="rounded-full border border-white/30 px-4 py-1.5 text-base">되돌리기</button>
          </div>
        </div>
      )}
      {offer && !card && !fixed && (
        <div className="absolute bottom-1 left-1/2 z-30 -translate-x-1/2">
          <div data-code-offer className="flex max-w-[92vw] flex-wrap items-center justify-center gap-3 rounded-full bg-black/90 px-6 py-3.5 text-lg text-white shadow-2xl">
            <span>✦ 에러에서 멈춘 것 같아요</span>
            <button onClick={why} className="rounded-full bg-white px-4 py-1.5 text-base text-black">원인 설명</button>
            <button onClick={fix} className="rounded-full border border-white/30 px-4 py-1.5 text-base">고칠 코드 제안</button>
            <button aria-label="넘기기" onClick={() => setOffer(false)} className="text-white/50 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </>
  );
}

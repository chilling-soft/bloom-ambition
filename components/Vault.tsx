"use client";

import { useState } from "react";

type Item = { id: string; label: string; value: string; field: string; log: string[] };
type Stored = { salt: string; iv: string; data: string };

const STORE = "alter-vault";
const SEED: Item[] = [
  { id: "v1", label: "테스트 카드", value: "4242 4242 4242 4242 · 12/29 · 123", field: "card", log: [] },
  { id: "v2", label: "계정 아이디", value: "haneul.demo", field: "account", log: [] },
  { id: "v3", label: "주소", value: "서울시 중구 세종대로 110 (테스트)", field: "address", log: [] },
];

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// everything below runs in the browser only: nothing in this file calls fetch
async function deriveKey(pass: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function seal(items: Item[], key: CryptoKey, salt: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(items)));
  const out: Stored = { salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
  localStorage.setItem(STORE, JSON.stringify(out));
}

async function open(stored: Stored, key: CryptoKey): Promise<Item[]> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(stored.iv) }, key, unb64(stored.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

function readStored(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

const mask = (v: string) => {
  const m = v.match(/\d{4} \d{4} \d{4} (\d{4})/);
  return m ? `•••• ${m[1]}` : "••••••••";
};

// Demo-safe vault: fake values only, encrypted in this browser, filled only when you tap.
// onFill gets { [item.field]: item.value } for the one item you tapped.
export function Vault({ onClose, onFill, canFill }: { onClose: () => void; onFill: (values: Record<string, string>) => void; canFill: boolean }) {
  const [stored, setStored] = useState<Stored | null>(() => (typeof window === "undefined" ? null : readStored()));
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ key: CryptoKey; salt: Uint8Array<ArrayBuffer> } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [draft, setDraft] = useState({ label: "", value: "" });

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass) return;
    setBusy(true);
    setError("");
    try {
      if (stored) {
        const salt = unb64(stored.salt);
        const key = await deriveKey(pass, salt);
        setItems(await open(stored, key));
        setSession({ key, salt });
      } else {
        // first open: the passphrase you type now creates the vault, seeded with fake values
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(pass, salt);
        await seal(SEED, key, salt);
        setItems(SEED);
        setSession({ key, salt });
      }
      setPass("");
    } catch {
      setError("암호가 맞지 않아요.");
    }
    setBusy(false);
  };

  const reset = () => {
    localStorage.removeItem(STORE);
    setStored(null);
    setError("");
  };

  const save = (next: Item[]) => {
    setItems(next);
    if (session) void seal(next, session.key, session.salt);
  };

  const note = (id: string, what: string) => save(items.map((i) => (i.id === id ? { ...i, log: [...i.log.filter((l) => l !== what), what] } : i)));

  const reveal = (id: string) => {
    setRevealed(id);
    note(id, "보기");
    setTimeout(() => setRevealed((r) => (r === id ? null : r)), 5000);
  };

  const fill = (i: Item) => {
    note(i.id, "채우기");
    onFill({ [i.field]: i.value });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const label = draft.label.trim();
    const value = draft.value.trim();
    if (!label || !value) return;
    save([...items, { id: `v${Date.now().toString(36)}`, label, value, field: "custom", log: [] }]);
    setDraft({ label: "", value: "" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Alter 보관함" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <b className="text-base">보관함</b>
          <button aria-label="닫기" onClick={onClose} className="text-black/40 hover:text-black">✕</button>
        </div>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">데모용 가짜 값이에요. 실제 정보는 넣지 마세요.</p>
        <p className="mt-2 text-xs text-black/50">Alter는 보관함을 스스로 읽지 않고, 모델에도 보내지 않아요. 채우기는 항상 직접 눌러야 해요. 값은 이 브라우저 안에서만 암호화돼요.</p>

        {!session ? (
          <form onSubmit={unlock} className="mt-4">
            <label htmlFor="vault-pass" className="text-xs text-black/50">
              {stored ? "암호를 입력해 열어요" : "처음이에요. 입력한 암호로 보관함을 만들어요"}
            </label>
            <input id="vault-pass" type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} placeholder="데모 암호: alter" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
            <p className="mt-1 text-xs text-black/40">데모 암호는 <span className="font-mono">alter</span> 예요.</p>
            {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
            <button disabled={busy || !pass} className="mt-3 w-full rounded-full bg-black py-2 text-xs text-white disabled:opacity-40">{busy ? "여는 중…" : "열기"}</button>
            {stored && <button type="button" onClick={reset} className="mt-2 w-full text-xs text-black/40 underline">암호를 잊었어요. 보관함 초기화</button>}
          </form>
        ) : (
          <>
            {!canFill && <p className="mt-3 text-xs text-black/40">채우려면 입력 칸이 있는 양식을 먼저 열어 주세요.</p>}
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li key={i.id} className="rounded-xl bg-black/[0.03] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-black/40">{i.label}</p>
                      <p className="break-words font-mono text-[13px]">{revealed === i.id ? i.value : mask(i.value)}</p>
                      {i.log.length > 0 && <p className="mt-0.5 text-[11px] text-black/40">방금 {i.log.join(" · ")}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <div className="flex gap-1.5">
                        <button onClick={() => reveal(i.id)} className="rounded-full border border-black/15 px-2.5 py-0.5">보기</button>
                        <button disabled={!canFill} onClick={() => fill(i)} className="rounded-full bg-black px-2.5 py-0.5 text-white disabled:opacity-30">채우기</button>
                      </div>
                      <button onClick={() => save(items.filter((x) => x.id !== i.id))} className="text-black/40 hover:text-black">삭제</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <form onSubmit={add} className="mt-3 flex gap-1.5">
              <input aria-label="이름" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="이름" className="w-24 rounded-lg border border-black/15 px-2 py-1.5 text-xs" />
              <input aria-label="값" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="가짜 값" className="min-w-0 flex-1 rounded-lg border border-black/15 px-2 py-1.5 text-xs" />
              <button className="rounded-full bg-black px-3 text-xs text-white">추가</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

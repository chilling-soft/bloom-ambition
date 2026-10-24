import Demo from "@/components/Demo";

const LIVE = [
  ["Browser", "The demo above. The sensor reads your selection and forms, and skips passwords and banks."],
  ["Phone", "Scan the QR in the menu-bar window. Your phone shows the same Alter, with what you just did."],
];
const NEXT = ["macOS (Accessibility API)", "Windows (UI Automation)", "Android (Autofill + assistant)", "iOS (Safari extension + share)"];

const PRINCIPLES = [
  ["Quiet by default", "Alter appears only when you call it (⌘E) or when a small trigger shows up. Everything it does can be undone."],
  ["You can see what it knows", "Every fact has a source and a confidence. Edit it, delete it, or switch learning off."],
  ["Some things it never touches", "Passwords, payment fields and banking sites are never read, learned or filled. These rules run in code, not in a prompt."],
];

export default function Home() {
  return (
    <main>
      {/* the OS is pinned and fills the first screen; the rest of the page slides over it */}
      <section className="sticky top-0 h-svh">
        <Demo />
      </section>

      <div className="relative z-10 rounded-t-3xl bg-[#faf8f5] px-4 pb-24 pt-16 shadow-[0_-24px_60px_rgba(0,0,0,0.18)]">
        <div id="how" className="mx-auto max-w-5xl scroll-mt-8">
          <h2 className="text-3xl font-semibold tracking-tight">One brain, many sensors</h2>
          <p className="mt-2 max-w-2xl text-black/60">
            Memory and Claude run the same everywhere. Each device only adds a thin sensor, so the next OS is a small client, not a rewrite.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
              {LIVE.map(([t, d]) => (
                <div key={t} className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="font-mono text-xs uppercase text-green-700">Live now</p>
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm text-black/60">{d}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-black/40">Next sensors</p>
              <ul className="mt-2 space-y-1 text-sm text-black/70">
                {NEXT.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-black/40">Each through the platform’s sanctioned API.</p>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map(([t, d]) => (
              <div key={t}>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-black/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

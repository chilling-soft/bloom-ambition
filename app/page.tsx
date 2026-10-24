import Demo from "@/components/Demo";

const LIVE = [
  ["Browser", "This page. The sensor reads your selection and forms, and skips passwords and banks."],
  ["Phone", "Scan the QR. Your phone shows the same Alter, with what you just did."],
];
const NEXT = ["macOS (Accessibility API)", "Windows (UI Automation)", "Android (Autofill + assistant)", "iOS (Safari extension + share)"];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Alter</h1>
        <p className="mt-3 text-xl text-black/70">It quietly learns you, helps when it matters, and grows into a version of you.</p>
        <p className="mt-1 text-sm text-black/40">Not a recording. Go on, try it.</p>
      </header>

      <Demo />

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold">One brain, many sensors</h2>
          <p className="mt-1 text-sm text-black/60">Memory and Claude run the same everywhere. Each device only adds a thin sensor.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LIVE.map(([t, d]) => (
              <div key={t} className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs font-mono uppercase text-green-700">Live now</p>
                <p className="font-medium">{t}</p>
                <p className="mt-1 text-sm text-black/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Next sensors</h2>
          <ul className="mt-3 space-y-1 text-sm text-black/70">
            {NEXT.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-black/40">Each through the platform’s sanctioned API.</p>
        </div>
      </section>
    </main>
  );
}

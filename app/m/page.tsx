import { Suspense } from "react";
import Phone from "@/components/Phone";

async function Inner({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return <main className="p-6">Open this page by scanning the QR code in the demo.</main>;
  return <Phone code={code} />;
}

export default function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return (
    <Suspense fallback={<main className="p-6 text-black/50">Loading…</main>}>
      <Inner searchParams={searchParams} />
    </Suspense>
  );
}

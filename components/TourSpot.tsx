"use client";

import { useEffect, useState } from "react";

type Rect = { left: number; top: number; width: number; height: number };

function measure(os: HTMLElement, el: Element): Rect {
  const a = os.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return { left: b.left - a.left, top: b.top - a.top, width: b.width, height: b.height };
}
const same = (a: Rect | null, b: Rect) => !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

// Points at the element marked data-tour={target}: a pulsing ring around it and a short label.
// The label sits below targets in the top half and above those in the bottom half; with `beside`, it sits to the
// right of that element instead (used for the Dock, whose top side belongs to the HUD).
// Targets are re-measured every frame while the spot shows, so it follows tab switches, scrolling,
// and the Alter panel opening beside the browser. Everything is pointer-events-none: the click goes to the target.
export default function TourSpot({
  root,
  target,
  label,
  beside,
}: {
  root: React.RefObject<HTMLDivElement | null>;
  target: string;
  label: string;
  beside?: string;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [side, setSide] = useState<Rect | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const os = root.current;
      const el = os?.querySelector(`[data-tour="${target}"]`);
      const by = beside ? os?.querySelector(`[data-tour="${beside}"]`) : null;
      const r = os && el ? measure(os, el) : null;
      if (os && el && r && r.width > 0) {
        setRect((prev) => (same(prev, r) ? prev : r));
        const s = by ? measure(os, by) : null;
        setSide((prev) => (s ? (same(prev, s) ? prev : s) : null));
      } else {
        setRect(null);
        setSide(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [root, target, beside]);

  const os = root.current;
  if (!rect || !os) return null;

  const below = rect.top + rect.height / 2 < os.clientHeight / 2;
  const cx = Math.min(Math.max(rect.left + rect.width / 2, 160), os.clientWidth - 160);
  const pill = "absolute whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-xl";

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        className="absolute animate-pulse rounded-xl ring-2 ring-indigo-500 ring-offset-2 ring-offset-white/40"
      />
      {side ? (
        <div style={{ left: side.left + side.width + 14, top: side.top + side.height / 2 }} className={`${pill} -translate-y-1/2`}>
          ← {label}
        </div>
      ) : (
        <div
          style={{ left: cx, top: below ? rect.top + rect.height + 14 : rect.top - 14 }}
          className={`${pill} -translate-x-1/2 ${below ? "" : "-translate-y-full"}`}
        >
          {below ? "↑ " : "↓ "}
          {label}
        </div>
      )}
    </div>
  );
}

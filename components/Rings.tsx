import { arc, INTERESTS, type Minutes } from "@/lib/rings";

// three concentric rings, outer to inner: the interests in order
export function Rings({ minutes, size = 196, stroke = 20 }: { minutes: Minutes; size?: number; stroke?: number }) {
  const label = INTERESTS.map((i) => `${i.name} ${i.goal}분 중 ${Math.min(minutes[i.id], i.goal)}분`).join(", ");
  const step = stroke + 4;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={label}>
      {INTERESTS.map((i, k) => {
        const r = 86 - k * step;
        return (
          <g key={i.id} transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r={r} fill="none" stroke={i.color} strokeOpacity="0.14" strokeWidth={stroke} />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={i.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={arc(r, minutes[i.id] / i.goal)}
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

// one small day of the week strip
export function MiniRings({ fill }: { fill: [number, number, number] }) {
  const radii = [17, 12.5, 8];
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
      {INTERESTS.map((i, k) => (
        <g key={i.id} transform="rotate(-90 20 20)">
          <circle cx="20" cy="20" r={radii[k]} fill="none" stroke={i.color} strokeOpacity="0.14" strokeWidth="3.6" />
          <circle cx="20" cy="20" r={radii[k]} fill="none" stroke={i.color} strokeWidth="3.6" strokeLinecap="round" strokeDasharray={arc(radii[k], fill[k])} />
        </g>
      ))}
    </svg>
  );
}

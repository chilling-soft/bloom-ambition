// Daily rings, one per interest. Minutes come from real activity (reading, asking, briefings, watching).
// No penalties: a ring that is not filled today is simply empty.

export type RingId = "bio" | "ai" | "esports";

export type Interest = { id: RingId; name: string; color: string; goal: number };

export const INTERESTS: Interest[] = [
  { id: "bio", name: "바이오", color: "#059669", goal: 30 },
  { id: "ai", name: "AI·개발", color: "#4F46E5", goal: 30 },
  { id: "esports", name: "이스포츠 · T1", color: "#E11D48", goal: 20 },
];

export type Minutes = Record<RingId, number>;

// the day so far (13:00): the esports ring is already closed
export const START_MINUTES: Minutes = { bio: 24, ai: 21, esports: 20 };

// last week, filled share per interest [bio, ai, esports]
export const WEEK: { label: string; fill: [number, number, number]; today?: boolean }[] = [
  { label: "월", fill: [0.7, 0.6, 1] },
  { label: "화", fill: [0.5, 1, 0.4] },
  { label: "수", fill: [1, 0.8, 1] },
  { label: "목", fill: [0.3, 0.4, 0.7] },
  { label: "금", fill: [1, 0.6, 1] },
  { label: "토", fill: [0.6, 0.7, 1], today: true },
  { label: "일", fill: [0, 0, 0] },
];

// what Alter picked for today, with a short briefing for each
export const PICKS = [
  { color: "#4F46E5", title: "작은 diffusion 모델 직접 돌려보기", meta: "튜토리얼 · 20분" },
  { color: "#059669", title: "단백질 설계 연구 흐름 정리", meta: "리뷰 · 10분" },
  { color: "#E11D48", title: "월즈 결승 로스터 변화", meta: "뉴스 · 5분" },
];

// dash array for a ring of radius r filled by f (0..1)
export function arc(r: number, f: number) {
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, f));
  return `${(c * k).toFixed(2)} ${(2 * c).toFixed(2)}`;
}

export const isClosed = (m: Minutes, i: Interest) => m[i.id] >= i.goal;

// Daily rings, one per area of life. Each ring is "today's tasks" for that area, a count the person set
// by talking to Alter once (e.g. "2-3 a day, just 1 when I'm busy"). No penalties: an unfilled ring is just empty.

export type RingId = "life" | "bio" | "ai" | "esports";

export type Interest = { id: RingId; name: string; short: string; color: string; goal: number; why: string; next: string };

// outer ring first, as in the design
export const INTERESTS: Interest[] = [
  { id: "life", name: "생활", short: "생활", color: "#B45309", goal: 2, why: "카드 납부일 전", next: "카드 자동납부 계좌 변경" },
  { id: "bio", name: "바이오", short: "바이오", color: "#059669", goal: 3, why: "새 논문 2편 + 화요일 발표", next: "단백질 설계 연구 흐름" },
  { id: "ai", name: "AI·개발", short: "AI·개발", color: "#4F46E5", goal: 2, why: "릴리스 1건", next: "작은 diffusion 모델 돌려보기" },
  { id: "esports", name: "이스포츠 · T1", short: "이스포츠", color: "#E11D48", goal: 1, why: "경기 있는 날", next: "" },
];

export type Done = Record<RingId, number>;

// the day so far (13:00): the esports ring is already closed
export const START_DONE: Done = { life: 1, bio: 2, ai: 1, esports: 1 };

// last week, filled share per ring [life, bio, ai, esports]
export const WEEK: { label: string; fill: [number, number, number, number]; today?: boolean }[] = [
  { label: "월", fill: [1, 0.7, 0.6, 1] },
  { label: "화", fill: [0.5, 0.5, 1, 0.4] },
  { label: "수", fill: [1, 1, 0.8, 1] },
  { label: "목", fill: [0, 0.3, 0.4, 0.7] },
  { label: "금", fill: [1, 1, 0.6, 1] },
  { label: "토", fill: [0.5, 0.67, 0.5, 1], today: true },
  { label: "일", fill: [0, 0, 0, 0] },
];

// what Alter picked for today; each belongs to one ring
export const PICKS = [
  { ring: "ai" as RingId, color: "#4F46E5", title: "작은 diffusion 모델 직접 돌려보기", meta: "튜토리얼 · 20분" },
  { ring: "bio" as RingId, color: "#059669", title: "단백질 설계 연구 흐름 정리", meta: "리뷰 · 10분" },
  { ring: "life" as RingId, color: "#B45309", title: "카드 자동납부 계좌 변경 마무리", meta: "3단계 남음 · 5분" },
];

// dash array for a ring of radius r filled by f (0..1)
export function arc(r: number, f: number) {
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, f));
  return `${(c * k).toFixed(2)} ${(2 * c).toFixed(2)}`;
}

export const isClosed = (d: Done, i: Interest) => d[i.id] >= i.goal;
export const remaining = (d: Done) => INTERESTS.reduce((n, i) => n + Math.max(0, i.goal - d[i.id]), 0);

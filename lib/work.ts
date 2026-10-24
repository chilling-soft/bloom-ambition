import { INTERESTS, PICKS, remaining, type Done, type RingId } from "./rings";

export type ResumeAction =
  | { type: "tab"; tab: "article" | "signup" | "bank" }
  | { type: "app"; app: "browser" | "mail" | "code" }
  | { type: "note"; text: string };

export type Work = { icon: string; iconColor: string; title: string; where: string; device: string; ring: RingId; action: ResumeAction };

// what Alter picked up from your screens: app, device, when, and how far you got (sample data in this demo)
export const WORK: Work[] = [
  { icon: "카드", iconColor: "#111111", title: "카드 자동납부 계좌 변경", where: "카드사 사이트 · 어제 22:10 · 2/3단계", device: "노트북", ring: "life", action: { type: "tab", tab: "bank" } },
  { icon: "{ }", iconColor: "#4338CA", title: "diffusion-toy / train.py", where: "VS Code · 11:40 · 에러에서 멈춤", device: "노트북", ring: "ai", action: { type: "app", app: "code" } },
  { icon: "PDF", iconColor: "#047857", title: "AlphaFold 3 — diffusion 모듈", where: "브라우저 · 12:45 · 62% 읽음", device: "폰", ring: "bio", action: { type: "tab", tab: "article" } },
  { icon: "▶", iconColor: "#BE123C", title: "T1 vs GEN 3세트 시청중", where: "유튜브 · 12:50 · 14분 남음", device: "폰", ring: "esports", action: { type: "note", text: "유튜브는 폰에서 이어서 볼 수 있어요. (데모에서는 연결하지 않았어요)" } },
  { icon: "메일", iconColor: "#111111", title: "교수님께 답장 — 발표 자료 형식", where: "Mail · 09:12 · 초안 저장됨", device: "노트북", ring: "bio", action: { type: "app", app: "mail" } },
];

// everything Alter knows about the person's day, as plain text for the model.
// Without this, "what should I do now?" has no answer, and an assistant that says "I can't know" breaks the demo.
export function dayContext(o: { done: Done; place: string; read?: { title: string; term?: string } | null }): string {
  const rings = INTERESTS.map((i) => `${i.name} ${Math.min(o.done[i.id], i.goal)}/${i.goal}개${o.done[i.id] >= i.goal ? " (완료)" : ` (${i.why}${i.next ? `, 다음: ${i.next}` : ""})`}`).join("; ");
  return [
    `지금: 토요일 15:20, ${o.place}`,
    `오늘의 링(할 일 개수, ${remaining(o.done)}개 남음): ${rings}`,
    `진행중인 일:\n${WORK.map((w) => `- ${w.title} (${w.where}, ${w.device})`).join("\n")}`,
    `Alter가 고른 오늘 태스크:\n${PICKS.map((p) => `- ${p.title} (${p.meta})`).join("\n")}`,
    `방금 읽은 글: ${o.read ? `${o.read.title}${o.read.term ? ` (찾아본 말: ${o.read.term})` : ""}` : "없음"}`,
    "일정: 다음 주 화요일(28일) 저널클럽에서 AlphaFold 3 논문 발표 (diffusion 모듈 중심, 발표 20분·토론 20분). 김 교수님 메일은 10월 22일에 받았고 답장 초안이 저장되어 있음. 카드 납부일이 가까움.",
  ].join("\n");
}

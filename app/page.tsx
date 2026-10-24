import Demo from "@/components/Demo";

const LIVE = [
  ["브라우저", "위의 데모예요. 센서가 선택한 글과 양식을 읽고, 비밀번호와 은행은 건너뛰어요."],
  ["폰", "메뉴바 창의 QR을 찍어 보세요. 폰의 Alter가 방금 한 일과 오늘의 링을 그대로 이어받아요."],
  ["보관함", "메뉴의 ‘보관함’은 이 브라우저 안에서만 암호화돼요(데모 암호 alter, 가짜 값만). 채우기는 항상 직접 눌러야 하고 모델로는 보내지 않아요."],
  ["하루 가이드", "메뉴의 ‘하루 가이드’에서 말로 관심사별 목표를 정하면, 요약해서 Alter가 기억해요."],
];
const NEXT = ["macOS (접근성 API)", "Windows (UI Automation)", "Android (자동 완성 서비스 + 어시스턴트)", "iOS (Safari 확장 + 공유)"];

const PRINCIPLES = [
  ["조용한 게 기본", "Alter는 부를 때(⌘E)나 작은 신호가 있을 때만 나타나요. 한 일은 모두 되돌릴 수 있어요."],
  ["아는 것을 내가 봐요", "모든 사실에 출처와 확신도가 붙어요. 고치고, 지우고, 학습을 끌 수 있어요."],
  ["절대 건드리지 않는 것", "비밀번호, 결제 칸, 은행 사이트는 읽지도, 배우지도, 채우지도 않아요. 이 규칙은 프롬프트가 아니라 코드로 지켜요."],
  ["링은 벌점이 없어요", "관심사마다 오늘 할 일의 개수를 채우는 링이에요. 못 채운 날은 그냥 비어 있을 뿐, 깎이는 건 없어요."],
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
          <h2 className="text-3xl font-semibold tracking-tight">하나의 두뇌, 여러 센서</h2>
          <p className="mt-2 max-w-2xl text-black/60">
            기억과 Claude는 어디서나 똑같이 돌아요. 기기마다 얇은 센서만 더하면 되니, 다음 OS는 새로 만드는 게 아니라 작은 클라이언트 하나예요.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
              {LIVE.map(([t, d]) => (
                <div key={t} className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="font-mono text-xs text-green-700">지금 동작</p>
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm text-black/60">{d}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="font-mono text-xs text-black/40">다음 센서</p>
              <ul className="mt-2 space-y-1 text-sm text-black/70">
                {NEXT.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-black/40">각 플랫폼이 공식으로 허용하는 API로만 붙어요.</p>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-4">
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

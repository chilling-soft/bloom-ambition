import Demo from "@/components/Demo";

// "live" = you can try it in the demo above. "next" = designed, not built in this submission.
type Status = "live" | "next";

const PAINS = [
  ["매번 처음부터 설명해요", "AI 채팅은 창을 열 때마다 나를 모릅니다. 읽던 글, 하던 일, 내 소속과 관심사를 다시 붙여넣어야 답이 쓸 만해져요."],
  ["같은 칸을 계속 다시 써요", "세미나 신청, 회원가입, 답장. 이름·이메일·소속은 한 번이면 충분한데 사이트마다 다시 칩니다."],
  ["기기를 바꾸면 흐름이 끊겨요", "노트북에서 읽던 논문을 폰으로 열면 처음부터예요. 앱과 기기 사이에 나를 기억하는 곳이 없어요."],
];

const DIFF: [string, string][] = [
  ["화면을 이미 알아요", "채팅형 비서는 복사해 붙여넣어야 상황을 알아요. Alter는 지금 보는 글, 선택한 단어, 열린 양식을 센서로 읽어서 같은 자리에서 도와요."],
  ["앱을 넘어 이어져요", "브라우저에서 읽은 글이 메일의 답장 초안이 되고 폰에서 이어져요. 대화 기록이 아니라 출처가 붙은 기억이 따라다녀요."],
  ["고친 만큼 나를 닮아요", "초안을 고쳐 보내면 고친 곳에서 취향 규칙 한 줄을 배우고(예: ‘교수님께는 결론부터’), 다음 초안을 쓸 때 참고해요. 배운 것은 보고 고치고 지울 수 있어요."],
  ["허락한 만큼만 해요", "비밀번호·결제는 읽지도 배우지도 않고, 필요하면 암호화된 보관함에서 내가 직접 눌러 채워요. 한 일은 되돌릴 수 있어요."],
];

const LAYERS: [string, string, Status][] = [
  ["센서", "화면에서 무엇을 읽고 있는지(선택한 단어, 머문 문단, 열린 양식 칸)만 가져옵니다. 데모는 이 웹 페이지 안의 미니 OS가 센서 역할을 해요. 실제 제품에서는 브라우저 확장과 OS별 접근성 API가 같은 일을 합니다.", "live"],
  ["규칙 (코드)", "무엇을 읽고 배우고 채울지의 한계는 프롬프트가 아니라 코드에 있어요. 비밀번호·결제 칸과 은행·결제 사이트는 센서 단계에서 걸러서 모델에는 도달하지 않습니다.", "live"],
  ["기억", "쓰는 동안 사실을 쌓습니다. 이름이나 이메일 같은 신원 정보, 관심사, 찾아본 말, 도움을 받아들인 방식. 모든 항목에 출처와 확신도가 붙고, 직접 고치거나 지울 수 있어요.", "live"],
  ["모델 (Claude)", "Claude Haiku 5.5가 설명, 3줄 요약, 답장 초안, 하루 질문 답변을 맡아요. 기억에 없는 사실은 지어내지 않도록 제공된 사실만 쓰게 했고, 모를 땐 모른다고 답합니다.", "live"],
];

const CONTEXT: [string, string][] = [
  ["저장되는 것", "신원(이름·이메일·소속), 관심사, 찾아본 말, 물어본 것, 먼저 건넨 도움에 대한 반응. 전부 ✦ 메뉴의 ‘Alter가 아는 것’에서 출처와 함께 보이고, 고치거나 지울 수 있고, 학습을 통째로 끌 수 있어요."],
  ["모델에게 가는 것", "지금 읽는 글, 질문, 그리고 신원을 뺀 최근 사실 15개 안팎. 이름·이메일은 양식을 채울 때 브라우저 안에서만 쓰고 모델 요청에는 싣지 않아요."],
  ["스스로 건드리지 않는 것", "비밀번호, 결제 칸, 은행 사이트는 Alter가 읽지도, 배우지도, 알아서 채우지도 않아요. 필요하면 암호화된 보관함에서 내가 직접 눌러 채웁니다. 은행 사이트에서는 메뉴바의 ✦가 ‘여기서는 멈춤’으로 바뀝니다."],
  ["기기 사이에서", "노트북이 4자리 코드로 세션을 만들면 폰이 QR로 같은 세션을 열어요. 방금 읽은 글, 오늘의 링, 기억이 2초 간격으로 이어지고, 서버에는 24시간만 남아요."],
];

const AUTO: [string, string][] = [
  ["글을 읽을 때", "한 문단에 3초쯤 머물면 Alter가 뒤에서 요약을 미리 만들어 두고, 화면 아래에 작은 한 줄로만 물어봐요. 열어 보면 ‘요약부터 보여주는 걸 좋아한다’고 배우고, 두 번 넘기면 스스로 조용해져서 ⌘E로 부를 때만 나타납니다."],
  ["양식을 만났을 때", "표준 칸(이름·이메일·소속)은 알아서 채우고, 채운 값은 보라색으로 표시해 내가 쓴 값과 구분해요. 되돌리기는 한 번이고, 되돌린 뒤에는 칸을 누를 때만 다시 묻거나 이 사이트에서는 그만하라고 할 수 있어요. ‘자동·물어보기·끔’ 중에 고릅니다."],
  ["앱을 오갈 때", "브라우저에서 읽은 글이 메일에서 답장 초안의 재료가 돼요. 근거로 쓴 기억이 초안 아래에 함께 보여서, 초안이 어디서 왔는지 확인할 수 있어요."],
  ["하루를 물어볼 때", "‘나 이제 뭘 해야 돼?’에는 오늘의 링과 진행중인 일, 일정에서 다음 한 가지를 골라 말해요. 목소리로 물어도 됩니다."],
];

const VAULT_LIVE = ["브라우저 안에서만 AES-GCM으로 암호화하고, 열쇠는 암호에서 PBKDF2로 만들어요. 서버와 모델로는 아무것도 보내지 않아요.", "비밀번호·카드·아이디는 여기에 두고 양식에서 직접 눌러 채워요. 채우기는 항상 직접 눌러야 하고, 보고 채운 기록이 항목마다 남아요. Alter는 보관함을 스스로 열지 않아요.", "데모에는 가짜 값만 들어 있어요(데모 암호 alter). 실제 정보는 넣지 마세요."];
const VAULT_NEXT = "제품에서는 OS 키체인(macOS Keychain, Android Keystore)과 패스키로 열쇠를 옮기고, 신원 확인 뒤에만 열리게 합니다. 이 부분은 이번 제출에 없어요.";

const MATRIX: [string, string, Status][] = [
  ["읽는 중 설명·3줄 요약·질문", "Claude Haiku 5.5, 선택한 글과 신원을 뺀 기억만 사용", "live"],
  ["양식 자동 채움 + 되돌리기", "코드 규칙으로 칸을 판별하고, 비밀번호·결제는 제외", "live"],
  ["메일 답장 초안", "방금 읽은 글과 기억으로 작성하고 근거를 함께 표시", "live"],
  ["고쳐 보낸 메일에서 취향 배우기", "초안과 보낸 글의 차이에서 규칙 한 줄을 기억하고 되돌릴 수 있음", "live"],
  ["하루 링·대시보드·질문", "오늘 할 일의 개수를 채우는 링, 진행중인 일, 하루 질문", "live"],
  ["폰으로 이어받기", "4자리 코드와 QR, 24시간 보관", "live"],
  ["암호화 보관함 (가짜 값)", "브라우저 안에서만 암호화, 채우기는 직접 탭", "live"],
  ["말로 정하는 하루 가이드", "관심사별 목표를 말하면 세 조각으로 요약해 기억", "live"],
  ["브라우저 확장 센서", "실제 웹 페이지의 선택·양식을 읽는 Chrome·Safari 확장", "next"],
  ["macOS 메뉴바 앱", "접근성 API로 앱 전반의 화면 맥락을 읽는 센서", "next"],
  ["기기 내 모델 단계", "간단한 판단은 기기에서, 어려운 것만 Claude로. 이번 제출에는 쓰지 않아요", "next"],
  ["여러 에이전트로 나눠 일하기", "읽기·양식·일정 담당을 나누고 큰 Claude가 조율. 데모에는 없고, 지금은 하나의 두뇌가 모든 걸 처리해요", "next"],
  ["키체인 기반 보관함", "OS 키체인과 패스키로 열쇠 보관, 신원 확인 후 열림", "next"],
];

const PLAN = [
  ["1~2일", "Chrome 확장으로 센서를 실제 웹으로 옮겨요. 지금의 규칙(비밀번호·결제 제외)을 그대로 쓰고, 첫 사용자 5명에게 자동 채움과 요약만 시켜 봅니다."],
  ["3~4일", "macOS 메뉴바 앱. 접근성 권한 하나로 브라우저 밖(메일, 문서)까지 읽고, 같은 기억을 공유해요."],
  ["5~7일", "기기 내 모델 단계와 키체인 보관함. 쉬운 판단은 기기에서 끝내서 지연과 비용을 줄이고, 어려운 것만 Claude로 올립니다."],
];

function Chip({ s }: { s: Status }) {
  return s === "live" ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 font-mono text-[11px] text-green-800">데모 동작</span>
  ) : (
    <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[11px] text-black/50">다음 단계</span>
  );
}

export default function Home() {
  return (
    <main>
      {/* the OS is pinned and fills the first screen; the rest of the page slides over it */}
      <section className="sticky top-0 h-svh">
        <Demo />
      </section>

      <div className="relative z-10 rounded-t-3xl bg-[#faf8f5] px-4 pb-28 pt-16 shadow-[0_-24px_60px_rgba(0,0,0,0.18)]">
        <div id="how" className="mx-auto max-w-5xl scroll-mt-8 text-[15px] leading-relaxed text-black/75">
          <h2 className="text-3xl font-semibold tracking-tight text-black">Alter가 푸는 문제</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PAINS.map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-black/10 bg-white p-5">
                <h3 className="font-semibold text-black">{t}</h3>
                <p className="mt-2 text-sm">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-3xl">
            해법은 더 똑똑한 채팅창이 아니라, 내가 이미 쓰고 있는 앱 위에서 조용히 나를 배우고 필요할 때만 나서는 계층이에요. 부르면 오고(⌘E), 작은 신호가 있을 때만 스스로 말을 걸고, 한 일은 모두 되돌릴 수 있어요.
          </p>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">채팅형 비서와 다른 점</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {DIFF.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-black">{t}</dt>
                <dd className="mt-1 text-sm">{d}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">네 겹으로 동작해요</h2>
          <p className="mt-2 max-w-3xl">센서가 보고, 코드 규칙이 걸러내고, 기억이 쌓이고, 모델이 마지막에 말합니다. 모델이 맨 끝에 있다는 점이 중요해요. 지켜야 할 선은 모델이 아니라 앞단의 코드가 지킵니다.</p>
          <ol className="mt-6 grid gap-3 md:grid-cols-2">
            {LAYERS.map(([t, d], i) => (
              <li key={t} className="flex gap-4 rounded-2xl border border-black/10 bg-white p-5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-black font-mono text-sm text-white">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-black">{t}</h3>
                  <p className="mt-1 text-sm">{d}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">컨텍스트는 이렇게 다뤄요</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {CONTEXT.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-black">{t}</dt>
                <dd className="mt-1 text-sm">{d}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">먼저 돕는 방식</h2>
          <p className="mt-2 max-w-3xl">끼어들기가 늘어날수록 쓰기 싫어지니까, Alter는 받아들여진 만큼만 말을 겁니다. 설정은 ‘조용히·보통·적극’ 중에 고를 수 있어요.</p>
          <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {AUTO.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-black">{t}</dt>
                <dd className="mt-1 text-sm">{d}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">민감한 정보는 보관함에</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center gap-2"><Chip s="live" /><h3 className="font-semibold text-black">지금 데모에서</h3></div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {VAULT_LIVE.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed border-black/20 p-5">
              <div className="flex items-center gap-2"><Chip s="next" /><h3 className="font-semibold text-black">제품에서는</h3></div>
              <p className="mt-3 text-sm">{VAULT_NEXT}</p>
            </div>
          </div>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">지금 되는 것, 다음에 할 것</h2>
          <p className="mt-2 max-w-3xl">오늘 만든 데모에 들어 있는 것과 설계만 한 것을 나눠서 적었어요. ‘다음 단계’에 있는 것은 이번 제출에 들어 있지 않습니다.</p>
          <ul className="mt-6 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
            {MATRIX.map(([t, d, s]) => (
              <li key={t} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="sm:w-56 sm:flex-none"><span className="font-medium text-black">{t}</span></span>
                <span className="flex-1 text-sm">{d}</span>
                <span className="sm:flex-none"><Chip s={s} /></span>
              </li>
            ))}
          </ul>

          <h2 className="mt-20 text-3xl font-semibold tracking-tight text-black">다음 7일</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {PLAN.map(([d, t]) => (
              <li key={d} className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="font-mono text-xs text-black/40">{d}</p>
                <p className="mt-2 text-sm">{t}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm text-black/55">각 플랫폼이 공식으로 허용하는 API로만 붙여요. 이번 제출에서 AI는 Claude만 사용했습니다.</p>
        </div>
      </div>
    </main>
  );
}

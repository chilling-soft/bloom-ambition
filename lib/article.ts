// the page the demo user is "reading": rendered in the browser window and sent to Claude as context
export const ARTICLE = {
  kicker: "Protein Notes · Oct 20",
  title: "AlphaFold 3 읽기: diffusion 모듈은 무엇을 하나",
  paras: [
    "AlphaFold 3는 단백질 하나의 구조를 넘어 단백질·DNA·RNA·작은 분자(리간드)·이온이 함께 붙은 복합체의 구조를 예측한다. 큰 변화는 두 가지다. MSA 처리를 줄인 Pairformer가 중심이 되고, 구조를 만드는 마지막 단계가 diffusion 모듈로 바뀌었다.",
    "diffusion 모듈은 원자 좌표에 잡음을 섞은 상태에서 출발해, 잡음을 조금씩 걷어내며 실제 좌표에 가까워지도록 학습된다. 예측할 때는 무작위 좌표에서 시작해 이 과정을 여러 번 반복해 최종 구조를 얻는다. 아미노산 단위의 틀(frame)과 각도를 다루던 AlphaFold 2의 구조 모듈과 달리, 원자 좌표를 직접 다룬다.",
    "이 방식 덕분에 여러 종류의 분자를 같은 방식으로 다룰 수 있지만, 구조가 정해지지 않은 영역에서 그럴듯해 보이는 가짜 구조를 만드는 문제가 생길 수 있다. 논문은 이를 줄이는 학습 방법도 함께 설명한다.",
  ],
};

export const ARTICLE_TEXT = ARTICLE.paras.join("\n\n");

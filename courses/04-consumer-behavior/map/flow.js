/**
 * 소비자 행동 모델 · 전체 과목의 지도
 *
 * 열일곱 장을 한 장의 그림으로 본다. 학기 내내 "지금 어디쯤인가"를 짚는 데
 * 쓰는 지도라, 진도와 상관없이 언제든 펼쳐 볼 수 있게 따로 한 쪽을 준다.
 *
 * 그리는 방식은 마케팅의 그림 1-1(CBBE)과 같다. 위는 그림, 아래는 설명이다.
 * 도형은 짚는 것이고 읽는 것은 아래에 있어, 도형이 작아도 글씨는 줄지 않는다.
 *
 * 다만 뼈대가 다르다. CBBE 는 나무라 좌표로 앉혔지만 이쪽은 띠와 줄이다.
 * 띠와 줄은 CSS 가 알아서 접어 주므로 좌표를 잡지 않는다. 그래서 좁은
 * 화면에서 줄이거나 옆으로 밀 것 없이, 여섯 칸이 두 칸으로 접힌다.
 *
 * 얼개를 이렇게 잡은 까닭:
 *
 *   아래에서 위로 쌓는다. M·A·O 는 첫 칸이 아니기 때문이다. 동기·능력·기회는
 *   "그 다음에 노출이 온다"는 순서가 아니라, 나머지 전부를 얼마나 애써서
 *   처리할지를 정한다. 그 증거가 교재 차례에 그대로 있다 — 태도가 5장(고노력)과
 *   6장(저노력)으로, 판단과 의사결정이 8장(고노력)과 9장(저노력)으로 갈린다.
 *   같은 갈림이 두 번 나오고, 그 갈림을 만드는 것이 M·A·O 다. 한 줄로
 *   늘어놓으면 이것이 안 보인다.
 *
 *   사회·문화(11~14장)도 뒤에 오는 단계가 아니다. 앞의 모든 단계에 스며든다.
 *   M·A·O 와 짝이다 — 하나는 내 안의 조건이고 하나는 내 밖의 조건이다.
 *   그래서 둘을 나란히 바닥에 깔았다. 밖의 조건 → 안의 조건 → 흐름 → 결과.
 *
 *   위에서 아래로 읽는 버릇과는 반대라, 층마다 번호를 붙이고 어디서
 *   시작하는지 적어 두었다. 화살표도 모두 위를 가리킨다.
 */

const INTRO = {
  id: "c1", ab: "1장", t: "소비자 행동 이해", tone: 0,
  say: "이 과목이 무엇을 다루는지 여는 장. 아래 지도의 어느 칸에도 들어가지 않는 들머리다.",
};

const SWITCH = {
  id: "mao", ab: "M·A·O", t: "동기 · 능력 · 기회", ch: "2장", tone: 0,
  en: "motivation · ability · opportunity",
  say: "얼마나 애써서 처리할 것인가를 정한다. 이 하나가 뒤의 모든 단계의 결을 바꾼다. "
     + "관심이 있고(동기), 알 만하고(능력), 여유가 있으면(기회) 고노력으로 간다. "
     + "셋 중 하나라도 모자라면 저노력으로 흐른다.",
};

/* 메인 줄. 마음(심리)에서 선택(의사결정)으로 흐른다. */
const MAIN = [
  { id: "c3", ab: "3장", t: "노출 · 주의 · 지각 · 이해", tone: 1,
    say: "자극이 눈에 들기까지. 세상에 널린 것 가운데 무엇이 나에게 닿고, 닿은 것 중 "
       + "무엇에 눈길이 머물며, 머문 것을 어떻게 받아들이는가." },

  { id: "c4", ab: "4장", t: "사전지식 · 장기기억 · 인출", tone: 1,
    say: "머릿속에 이미 있던 것과 만난다. 새로 들어온 것은 늘 옛것에 견주어 자리를 잡고, "
       + "필요할 때 다시 꺼내진다. 꺼내지지 않는 기억은 없는 것과 같다." },

  { id: "c56", ab: "5·6장", t: "태도 형성과 변화", tone: 1, split: true,
    hi: "5장 고노력", lo: "6장 저노력",
    say: "좋다 싫다가 생기고 바뀐다. 여기서 M·A·O 의 갈림이 처음 드러난다 — "
       + "따져 가며 만드는 태도(5장)와 그냥 익숙해서 생기는 태도(6장)는 다른 길을 탄다." },

  { id: "c7", ab: "7장", t: "문제인식과 정보탐색", tone: 2,
    say: "여기서부터 '선택'이다. 지금과 바라는 바가 벌어져 있음을 알아채고, 그 틈을 "
       + "메울 것을 찾아 나선다. 안에서 꺼내 보고(기억), 모자라면 밖에서 찾는다." },

  { id: "c89", ab: "8·9장", t: "판단과 의사결정", tone: 2, split: true,
    hi: "8장 고노력", lo: "9장 저노력",
    say: "고르는 자리. M·A·O 의 갈림이 두 번째로 드러난다 — 견주어 따져 고르기(8장)와 "
       + "어림으로 집기(9장)는 아주 다르게 움직인다. 장바구니의 대부분은 뒤쪽이다." },

  { id: "c10", ab: "10장", t: "구매 후 과정", tone: 2,
    say: "사고 난 뒤가 끝이 아니다. 잘 샀나 되짚고, 쓰면서 겪고, 그 겪음이 다시 기억에 "
       + "쌓여 다음 선택의 밑돌이 된다. 지도가 한 바퀴 도는 자리다." },
];

/* 아래 띠. 앞의 전 과정에 스며든다. */
const CULTURE = {
  id: "cul", t: "소비자 문화", ch: "11~14장", tone: 3,
  say: "사람은 진공에서 고르지 않는다. 누구와 사는지, 어떤 무리에 속하는지, 무엇을 "
     + "값지다 여기는지가 위의 모든 단계에 스며든다. 뒤에 오는 단계가 아니라 밑에 깔린 바탕이다.",
  kids: [
    { id: "c11", ab: "11장", t: "소비자행동의 사회적 요인", tone: 3,
      say: "둘레 사람들이 미치는 힘. 준거집단, 입소문, 남의 눈." },
    { id: "c12", ab: "12장", t: "소비자 다양성", tone: 3,
      say: "나이·지역·소득·문화가 다르면 같은 물건도 다르게 보인다." },
    { id: "c13", ab: "13장", t: "가족 및 사회계층의 영향", tone: 3,
      say: "가장 가까운 무리와, 태어나며 얹히는 자리." },
    { id: "c14", ab: "14장", t: "가치 · 개성 · 라이프스타일", tone: 3,
      say: "사이코그래픽스. 무엇을 값지게 여기고 어떻게 살고 싶은가." },
  ],
};

/* 맨 아래 띠. 앞의 모든 것이 낳는 것. */
const RESULT = {
  id: "res", t: "소비자 행동 결과와 쟁점", ch: "15~17장", tone: 4,
  say: "위의 모든 것이 모여 무엇을 낳는가. 새것이 퍼지는 모습, 물건에 담기는 뜻, "
     + "그리고 그 모두가 사회에 지우는 몫.",
  kids: [
    { id: "c15", ab: "15장", t: "혁신 · 채택 · 저항 · 확산", tone: 4,
      say: "새것은 어떻게 퍼지고, 왜 밀려나는가." },
    { id: "c16", ab: "16장", t: "상징적 소비자 행동", tone: 4,
      say: "물건이 쓸모를 넘어 뜻을 지닐 때. 선물, 소장, 의례." },
    { id: "c17", ab: "17장", t: "마케팅 · 윤리 · 사회적 책임", tone: 4,
      say: "아는 것을 어디까지 써도 되는가. 이 과목이 마지막에 묻는 것." },
  ],
};

const ALL = [INTRO, SWITCH, ...MAIN, CULTURE, ...CULTURE.kids, RESULT, ...RESULT.kids];

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const at = (n, extra) =>
  ' data-id="' + n.id + '" class="' + (extra || "") + " tone" + n.tone + '"';

function stepHtml(n) {
  return '<button type="button"' + at(n, "fw-step") + ">" +
    '<span class="fw-ch">' + esc(n.ab) + "</span>" +
    '<span class="fw-t">' + esc(n.t) + "</span>" +
    (n.split
      ? '<span class="fw-split"><i>' + esc(n.hi) + "</i><i>" + esc(n.lo) + "</i></span>"
      : "") +
    "</button>";
}

function chipHtml(n) {
  return '<button type="button"' + at(n, "fw-chip") + ">" +
    '<span class="fw-ch">' + esc(n.ab) + "</span>" +
    '<span class="fw-t">' + esc(n.t) + "</span>" +
    "</button>";
}

function bandHtml(b) {
  return '<div class="fw-band tone' + b.tone + '">' +
    '<button type="button"' + at(b, "fw-btitle") + ">" +
      "<b>" + esc(b.t) + "</b><span>" + esc(b.ch) + "</span>" +
    "</button>" +
    '<div class="fw-chips">' + b.kids.map(chipHtml).join("") + "</div>" +
  "</div>";
}

function cardHtml(n) {
  return '<button type="button"' + at(n, "fc") + ">" +
    '<span class="fc-ab">' + esc(n.ab || n.ch) + "</span>" +
    '<span class="fc-body">' +
      "<b>" + esc(n.t) + "</b>" +
      (n.en ? '<i class="fc-en">' + esc(n.en) + "</i>" : "") +
      (n.split ? '<i class="fc-sp">' + esc(n.hi) + " · " + esc(n.lo) + "</i>" : "") +
      "<span>" + esc(n.say) + "</span>" +
    "</span></button>";
}

export function drawFlow(box) {
  box.innerHTML =
    '<div class="fw-top">' +
      '<button class="fw-fold" id="fw-fold" type="button" aria-expanded="true">' +
        "<span>그림 접기</span><i></i></button>" +

      /* 아래에서 위로 쌓는다. 그래서 글로 적는 차례는 거꾸로다 —
         맨 위에 결과, 맨 아래에 사회·문화. */
      '<div class="fw-map">' +
        '<p class="fw-step-no">4 · 낳는 것</p>' +
        bandHtml(RESULT) +
        '<p class="fw-riser">그래서 이런 결과가 나온다</p>' +

        '<p class="fw-step-no">3 · 흐름</p>' +
        '<div class="fw-row">' +
          MAIN.map((n, i) =>
            (i ? '<span class="fw-arw" aria-hidden="true"></span>' : "") + stepHtml(n)
          ).join("") +
        "</div>" +
        '<div class="fw-drop"><i></i><i></i></div>' +

        '<p class="fw-step-no">2 · 내 안의 조건</p>' +
        '<div class="fw-sw">' +
          '<button type="button"' + at(SWITCH, "fw-swbox") + ">" +
            '<span class="fw-ch">' + esc(SWITCH.ch) + "</span>" +
            '<span class="fw-ab">' + esc(SWITCH.ab) + "</span>" +
            '<span class="fw-t">' + esc(SWITCH.t) + "</span>" +
          "</button>" +
          '<p class="fw-swsay">얼마나 애쓸 것인가 — 위의 <b>태도</b>와 <b>판단·의사결정</b>이 ' +
            "여기서 고노력과 저노력으로 갈린다</p>" +
        "</div>" +
        '<p class="fw-riser">이것이 위의 모든 단계의 결을 정한다</p>' +

        '<p class="fw-step-no">1 · 내 밖의 조건</p>' +
        bandHtml(CULTURE) +

        '<div class="fw-intro">' + chipHtml(INTRO) + "</div>" +
      "</div>" +
    "</div>" +

    '<div class="fw-cards" id="fw-cards">' + ALL.map(cardHtml).join("") + "</div>";

  const byId = {};
  ALL.forEach((n) => { byId[n.id] = n; });

  let locked = null;
  const put = (n, move) => {
    box.classList.toggle("picked", Boolean(n));
    box.querySelectorAll("[data-id]").forEach((el) => {
      el.classList.toggle("on", Boolean(n) && el.dataset.id === n.id);
    });
    if (move && n) {
      const c = box.querySelector('.fc[data-id="' + n.id + '"]');
      if (c) {
        const slow = matchMedia("(prefers-reduced-motion: reduce)").matches;
        c.scrollIntoView({ behavior: slow ? "auto" : "smooth", block: "nearest" });
      }
    }
  };
  put(null);

  box.querySelectorAll(".fw-map [data-id]").forEach((el) => {
    const n = byId[el.dataset.id];
    const peek = () => { if (!locked) put(n); };
    el.addEventListener("mouseenter", peek);
    el.addEventListener("focus", peek);
    el.addEventListener("click", () => {
      locked = locked === n ? null : n;
      put(locked, Boolean(locked));
    });
  });

  /* 카드에서도 거슬러 짚을 수 있어야 '이게 어디 붙은 것인지'가 양쪽으로 이어진다. */
  box.querySelectorAll(".fc").forEach((c) => {
    const n = byId[c.dataset.id];
    c.addEventListener("click", () => {
      locked = locked === n ? null : n;
      put(locked, false);
    });
  });

  box.querySelector(".fw-map").addEventListener("mouseleave", () => put(locked));

  const fold = box.querySelector("#fw-fold");
  fold.addEventListener("click", () => {
    const off = box.classList.toggle("folded");
    fold.setAttribute("aria-expanded", String(!off));
    fold.querySelector("span").textContent = off ? "그림 펴기" : "그림 접기";
  });
}

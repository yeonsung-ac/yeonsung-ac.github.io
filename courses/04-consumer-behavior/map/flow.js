/**
 * 소비자 행동 모델 · 전체 과목의 지도
 *
 * 열일곱 장을 한 장의 그림으로 본다. 학기 내내 "지금 어디쯤인가"를 짚는 데
 * 쓰는 지도라, 진도와 상관없이 언제든 펼쳐 볼 수 있게 따로 한 쪽을 준다.
 *
 * 마케팅의 그림 1-1(CBBE)과 같은 방식이다. 위는 그림, 아래는 설명이다.
 * 마디에는 약어만 크게 적고 읽을 글은 아래 카드에 모은다. 그래야 마디가
 * 좁아져 다섯 칸이 한 화면에 들어오고, 그러면서도 설명 글씨는 줄지 않는다.
 *
 * 얼개:
 *
 *   가운데 줄은 교수가 그린 다섯 칸 그대로다.
 *   M·A·O → 노출·주의·지각·이해 → 지식·기억·인출 → 구매 → 구매후행동.
 *   태도(5·6장)는 따로 칸을 주지 않고 구매 안에 넣었다. 좋다 싫다가 정해지는
 *   것이 곧 고르는 일의 앞머리이기 때문이다.
 *
 *   M·A·O 는 첫 칸이면서 동시에 스위치다. 동기·능력·기회는 뒤의 모든 단계를
 *   얼마나 애써서 처리할지를 정한다. 그 증거가 교재 차례에 있다 — 태도가
 *   5장(고노력)과 6장(저노력)으로, 판단이 8장(고노력)과 9장(저노력)으로
 *   갈린다. 같은 갈림이 두 번 나온다. 그래서 구매 칸에 갈림 표시를 달고,
 *   그 아래에 무엇이 무엇을 가르는지 한 줄 적었다.
 *
 *   11~14장(사회·문화)은 줄 끝에 붙이지 않는다. 뒤에 오는 단계가 아니라
 *   앞의 모든 단계에 스며드는 바탕이라, 줄 아래에서 받치는 띠로 두었다.
 *   15~17장(결과)은 그 모두가 낳는 것이라 맨 아래에 둔다.
 */

/* 가운데 줄. ab 는 마디에 크게 적을 약어, s 는 그 밑에 작게 적을 우리말. */
const MAIN = [
  { id: "mao", ab: "M·A·O", s: "동기·능력·기회", ch: "2장", tone: 1,
    en: "motivation · ability · opportunity",
    say: "얼마나 애써서 처리할 것인가를 정한다. 이 하나가 뒤의 모든 단계의 결을 바꾼다. "
       + "관심이 있고(동기), 알 만하고(능력), 여유가 있으면(기회) 고노력으로 간다. "
       + "셋 중 하나라도 모자라면 저노력으로 흐른다.",
    note: "첫 칸이면서 스위치다. BUY 안의 태도(5·6장)와 의사결정(8·9장)이 "
        + "여기서 고노력과 저노력으로 갈린다." },

  { id: "eapc", ab: "E·A·P·C", s: "노출·주의·지각·이해", ch: "3장", tone: 1,
    en: "exposure · attention · perception · comprehension",
    say: "자극이 눈에 들기까지. 세상에 널린 것 가운데 무엇이 나에게 닿고(노출), "
       + "닿은 것 중 무엇에 눈길이 머물며(주의), 머문 것을 어떻게 받아들이는가(지각·이해)." },

  { id: "kmr", ab: "K·M·R", s: "지식·기억·인출", ch: "4장", tone: 1,
    en: "knowledge · memory · retrieval",
    say: "머릿속에 이미 있던 것과 만난다. 새로 들어온 것은 늘 옛것에 견주어 자리를 잡고, "
       + "필요할 때 다시 꺼내진다. 꺼내지지 않는 기억은 없는 것과 같다.",
    /* 이 기억에 담긴 것이 브랜드에서 어떤 모습을 띠는지가 CBBE 그림이다.
       마케팅 교안 보관함 밖의 낱장이라 암호 없이 열린다. */
    go: { href: "../../02-marketing/cbbe/",
          t: "브랜드 지식은 어떤 모습인가 — CBBE 그림 보기" } },

  { id: "buy", ab: "BUY", s: "구매", ch: "5~9장", tone: 2,
    en: "attitude · search · judgment · decision",
    hi: "고노력 5·8장", lo: "저노력 6·9장",
    say: "고르기까지. 좋다 싫다가 생기고(5·6장 태도), 지금과 바라는 바의 틈을 알아채 "
       + "찾아 나선 뒤(7장), 고른다(8·9장). M·A·O 의 갈림이 여기서 드러난다 — 견주어 "
       + "따져 고르기와 어림으로 집기는 아주 다르게 움직인다. 장바구니의 대부분은 뒤쪽이다." },

  { id: "post", ab: "POST", s: "구매후행동", ch: "10장", tone: 2,
    en: "post-decision processes",
    say: "사고 난 뒤가 끝이 아니다. 잘 샀나 되짚고, 쓰면서 겪고, 그 겪음이 다시 기억에 "
       + "쌓여 다음 선택의 밑돌이 된다. 지도가 한 바퀴 도는 자리다." },
];

/* 줄 아래에서 받치는 띠. 앞의 전 과정에 스며든다. */
const CULTURE = {
  id: "cul", ab: "CUL", t: "소비자 문화", ch: "11~14장", tone: 3,
  en: "consumer culture",
  say: "사람은 진공에서 고르지 않는다. 누구와 사는지, 어떤 무리에 속하는지, 무엇을 값지다 "
     + "여기는지가 위의 모든 단계에 스며든다. 뒤에 오는 단계가 아니라 밑에 깔린 바탕이다.",
  kids: [
    { id: "c11", ab: "11장", t: "사회적 요인", tone: 3,
      say: "둘레 사람들이 미치는 힘. 준거집단, 입소문, 남의 눈." },
    { id: "c12", ab: "12장", t: "소비자 다양성", tone: 3,
      say: "나이·지역·소득·문화가 다르면 같은 물건도 다르게 보인다." },
    { id: "c13", ab: "13장", t: "가족 · 사회계층", tone: 3,
      say: "가장 가까운 무리와, 태어나며 얹히는 자리." },
    { id: "c14", ab: "14장", t: "가치·개성·라이프스타일", tone: 3,
      say: "사이코그래픽스. 무엇을 값지게 여기고 어떻게 살고 싶은가." },
  ],
};

/* 맨 아래. 위의 모든 것이 낳는 것. */
const RESULT = {
  id: "out", ab: "OUT", t: "결과와 쟁점", ch: "15~17장", tone: 4,
  en: "outcomes & issues",
  say: "위의 모든 것이 모여 무엇을 낳는가. 새것이 퍼지는 모습, 물건에 담기는 뜻, "
     + "그리고 그 모두가 사회에 지우는 몫.",
  kids: [
    { id: "c15", ab: "15장", t: "혁신·채택·저항·확산", tone: 4,
      say: "새것은 어떻게 퍼지고, 왜 밀려나는가." },
    { id: "c16", ab: "16장", t: "상징적 소비자 행동", tone: 4,
      say: "물건이 쓸모를 넘어 뜻을 지닐 때. 선물, 소장, 의례." },
    { id: "c17", ab: "17장", t: "마케팅·윤리·사회적 책임", tone: 4,
      say: "아는 것을 어디까지 써도 되는가. 이 과목이 마지막에 묻는 것." },
  ],
};

const INTRO = {
  id: "c1", ab: "1장", t: "소비자 행동 이해", tone: 0,
  say: "이 과목이 무엇을 다루는지 여는 장. 지도의 어느 칸에도 들어가지 않는 들머리다.",
};

const ALL = [...MAIN, CULTURE, ...CULTURE.kids, RESULT, ...RESULT.kids, INTRO];

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const tag = (n, cls) =>
  ' type="button" data-id="' + n.id + '" class="' + cls + " t" + n.tone + '"';

/* 가운데 줄의 마디. 약어가 크고 우리말이 작다. 여기서는 읽는 것이 아니라
   짚는 것이라, 우리말은 어느 것인지 알아보는 정도면 된다. */
function stepHtml(n) {
  return "<button" + tag(n, "st") + ">" +
    '<span class="st-ch">' + esc(n.ch) + "</span>" +
    '<span class="st-ab">' + esc(n.ab) + "</span>" +
    '<span class="st-s">' + esc(n.s) + "</span>" +
    (n.hi ? '<span class="st-sp"><i>고노력</i><i>저노력</i></span>' : "") +
    "</button>";
}

function chipHtml(n) {
  return "<button" + tag(n, "cp") + ">" +
    '<span class="cp-ch">' + esc(n.ab) + "</span>" +
    '<span class="cp-t">' + esc(n.t) + "</span>" +
    "</button>";
}

function bandHtml(b, sayIt) {
  return '<div class="bd t' + b.tone + '">' +
    "<button" + tag(b, "bd-h") + ">" +
      '<span class="bd-ab">' + esc(b.ab) + "</span>" +
      "<b>" + esc(b.t) + "</b><span class='bd-ch'>" + esc(b.ch) + "</span>" +
    "</button>" +
    '<div class="bd-k">' + b.kids.map(chipHtml).join("") + "</div>" +
    (sayIt ? '<p class="bd-say">' + sayIt + "</p>" : "") +
  "</div>";
}

/* 카드는 단추가 아니라 칸이다. 안에 다른 쪽으로 건너가는 링크가 들어가는데,
   단추 안에 링크를 넣으면 브라우저가 어느 쪽을 눌린 것으로 볼지 모른다.
   대신 칸에 역할과 차례를 매겨 자판으로도 눌리게 한다. */
function cardHtml(n) {
  return "<div" + tag(n, "fc") + ' role="button" tabindex="0">' +
    '<span class="fc-ab">' + esc(n.ab) + "</span>" +
    '<span class="fc-b">' +
      "<b>" + esc(n.t || n.s) + (n.ch ? " · " + esc(n.ch) : "") + "</b>" +
      (n.en ? '<i class="fc-en">' + esc(n.en) + "</i>" : "") +
      (n.hi ? '<i class="fc-sp">' + esc(n.hi) + " · " + esc(n.lo) + "</i>" : "") +
      "<span>" + esc(n.say) + "</span>" +
      (n.note ? '<span class="fc-note">' + esc(n.note) + "</span>" : "") +
      (n.go
        ? '<a class="fc-go" href="' + n.go.href + '" target="_blank" ' +
          'rel="noopener noreferrer">' + esc(n.go.t) + " ↗</a>"
        : "") +
    "</span></div>";
}

export function drawFlow(box) {
  box.innerHTML =
    '<div class="top">' +
      '<button class="fold" id="fold" type="button" aria-expanded="true">' +
        "<span>그림 접기</span><i></i></button>" +

      '<div class="map">' +
        /* 가운데 줄 */
        '<div class="row">' +
          MAIN.map((n, i) =>
            (i ? '<span class="arw" aria-hidden="true"></span>' : "") + stepHtml(n)
          ).join("") +
        "</div>" +

        /* 무엇이 무엇을 가르는지 한 줄로 적어 둔다 */
        '<p class="rule"><b>M·A·O</b> 가 <b>BUY</b> 안의 태도(5·6장)와 ' +
          "의사결정(8·9장)을 고노력 · 저노력으로 가른다</p>" +

        '<p class="up">위의 모든 단계에 스며든다</p>' +
        bandHtml(CULTURE) +
        '<p class="down">그 모두가 낳는 것</p>' +
        bandHtml(RESULT) +

        '<div class="intro">' + chipHtml(INTRO) +
          "<span>지도 밖 들머리</span></div>" +
      "</div>" +
    "</div>" +

    '<div class="cards">' + ALL.map(cardHtml).join("") + "</div>";

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

  box.querySelectorAll(".map [data-id]").forEach((el) => {
    const n = byId[el.dataset.id];
    const peek = () => { if (!locked) put(n); };
    el.addEventListener("mouseenter", peek);
    el.addEventListener("focus", peek);
    el.addEventListener("click", () => {
      locked = locked === n ? null : n;
      put(locked, Boolean(locked));
    });
  });

  /* 카드에서도 거슬러 짚을 수 있어야 어디 붙은 것인지가 양쪽으로 이어진다. */
  box.querySelectorAll(".fc").forEach((c) => {
    const n = byId[c.dataset.id];
    const hit = () => { locked = locked === n ? null : n; put(locked, false); };
    c.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;   // 건너가는 링크는 그대로 둔다
      hit();
    });
    c.addEventListener("keydown", (e) => {
      if (e.target.closest("a")) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(); }
    });
  });

  box.querySelector(".map").addEventListener("mouseleave", () => put(locked));

  const fold = box.querySelector("#fold");
  fold.addEventListener("click", () => {
    const off = box.classList.toggle("folded");
    fold.setAttribute("aria-expanded", String(!off));
    fold.querySelector("span").textContent = off ? "그림 펴기" : "그림 접기";
  });
}

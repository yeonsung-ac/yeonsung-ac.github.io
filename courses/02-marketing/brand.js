/**
 * 그림 1-1 · 소비자 관점에서 본 브랜드자산 형성과정
 *
 * 제1장 교안에서 네 번(9·12·15·24쪽) 되풀이해 나오는 지도다. 진도가 어디까지
 * 왔는지 짚어 주는 그림이라, 학생이 들어오자마자 보이는 자리에 둔다.
 *
 * 원문(Keller 1993, Figure 1)은 왼쪽에서 오른쪽으로 뻗는다. 처음에는 그것을
 * 위아래로 접었었다. 마디마다 우리말을 다 적으면 여섯 겹이 옆으로 늘어서서
 * 글씨를 개미만 하게 줄여야 했기 때문이다. 그런데 그렇게 접고 나니 그림이
 * 아니라 들여쓴 목록이 되어, 이 그림이 말하려는 '갈라짐'이 보이지 않았다.
 *
 * 영어 이니셜을 쓰면 그 문제가 사라진다. 마디는 작아도 되고, 읽을 글은 아래
 * 한 곳에 모아 크게 둔다. 눈으로 짚는 곳과 읽는 곳을 나누는 셈이다. 그래서
 * 도형이 작아도 설명 글씨는 작아지지 않는다 — 폰에서도 그대로다.
 *
 * 마우스를 얹으면 미리 보이고, 누르면 그 자리에 머문다. 수업 중에 스크린으로
 * 짚으실 때는 눌러 두는 편이 낫고, 폰에는 마우스가 없어 누르는 것뿐이다.
 */

const TREE = {
  ab: "CBBE", s: "브랜드자산",
  t: "브랜드자산", en: "customer-based brand equity",
  say: "소비자가 그 브랜드를 알기 때문에 생기는 값어치. 속이 같은 물건이라도 이름이 붙으면 값이 달라진다.",
  kids: [{
    ab: "BK", s: "브랜드 지식",
    t: "브랜드 지식", en: "brand knowledge",
    say: "소비자 머릿속에 그 브랜드에 대해 쌓여 있는 것 전부. 브랜드자산은 여기에서 나온다. 크게 둘로 갈라진다.",
    kids: [
      {
        ab: "BA", s: "인지도", fam: 1,
        t: "브랜드 인지도", en: "brand awareness",
        say: "그 브랜드를 알아보거나 떠올릴 수 있는가. 아는 것이 먼저다.",
        kids: [
          { ab: "RECOG", s: "재인", t: "브랜드 재인", en: "brand recognition · 보조상기",
            say: "보여 주면 “아, 이거” 하고 알아본다. 진열대 앞에서 고를 때 쓰인다." },
          { ab: "RECALL", s: "회상", t: "브랜드 회상", en: "brand recall · 비보조상기",
            say: "아무것도 안 보여 줘도 스스로 떠올린다. “커피 하면?” 하고 물었을 때 나오는 이름." },
        ],
      },
      {
        ab: "BI", s: "이미지", fam: 2,
        t: "브랜드 이미지", en: "brand image",
        say: "그 브랜드 하면 떠오르는 생각의 묶음. 무엇이 떠오르는가와 어떻게 떠오르는가로 나뉜다.",
        kids: [
          {
            ab: "TYPES", s: "연상 유형",
            t: "브랜드 연상 유형", en: "types of brand association",
            say: "무엇이 떠오르는가. 셋으로 나뉜다.",
            kids: [
              {
                ab: "ATTR", s: "속성", t: "속성", en: "attributes",
                say: "제품 그 자체에 관한 것.",
                kids: [
                  { ab: "PR", s: "제품 관련",
                    t: "제품과 관련된 속성", en: "product-related",
                    sub: "제품범주 · 제품속성 · 품질",
                    say: "그 물건이 무엇이고 어떻게 만들어졌는가." },
                  { ab: "NPR", s: "비제품",
                    t: "제품과 직접 관련이 없는 속성", en: "non-product-related",
                    sub: "브랜드 개성 · 사용자 · 제품용도 · 느낌과 경험",
                    say: "물건 자체와는 상관없지만 브랜드에 달라붙은 것들.",
                    note: "든 보기가 다릅니다 — 가격 · 포장 · 사용자 이미지 · 사용상황 이미지 "
                        + "(price · packaging · user imagery · usage imagery)." },
                ],
              },
              {
                ab: "BENEF", s: "편익", t: "편익", en: "benefits",
                say: "그 브랜드가 나에게 무엇을 해 주는가. 실용·과시·즐거움 셋으로 나뉜다.",
                kids: [
                  { ab: "FUNC", s: "기능적", t: "기능적 편익", en: "functional · utilitarian",
                    say: "문제를 해결해 준다. 실용의 잣대로 따진다 — 잘 지워지는가, 오래 가는가." },
                  { ab: "SYMB", s: "상징적", t: "상징적 편익", en: "symbolic",
                    say: "남에게 나를 보여 준다. 내가 어떤 사람인지, 어느 무리에 드는지를 말해 준다." },
                  { ab: "EXPER", s: "경험적", t: "경험적 편익", en: "experiential · hedonic",
                    say: "쓰는 동안의 즐거움 그 자체. 감각과 기분에 닿는 것이라 실용으로 따지지 않는다." },
                ],
              },
              { ab: "CORP", s: "기업 연상",
                t: "기업과 관련된 연상", en: "corporate associations",
                say: "만든 회사가 어떤 회사인가.",
                note: "이 자리는 태도(attitudes)입니다. 속성과 편익을 종합해 브랜드를 통틀어 "
                    + "어떻게 평가하는가를 뜻하고, 셋 가운데 구매 행동에 가장 가깝습니다." },
            ],
          },
          { ab: "U·F·S", s: "연상의 질",
            t: "브랜드 연상", en: "uniqueness · favorability · strength of brand associations",
            sub: "독특성 · 호의성 · 강도",
            say: "떠오르는 것이 좋은가, 뚜렷한가, 남과 다른가. 무엇이 떠오르느냐만큼 어떻게 떠오르느냐가 중요하다.",
            note: "셋이 한 상자가 아니라 연상 유형과 나란한 세 갈래입니다. 무엇이 떠오르는가(유형)와 "
                + "어떻게 떠오르는가(U·F·S)를 같은 층으로 봅니다." },
        ],
      },
    ],
  }],
};

/* 자리 잡기.
   가로가 겹(level), 세로가 줄(row)이다. 끝가지는 한 줄씩 차지하고, 부모는
   제 자식들의 한가운데에 선다. 그래서 줄 번호가 0.5 처럼 나올 수 있어
   격자에 못 앉히고 좌표로 앉힌다. 이음선을 그으려면 어차피 좌표가 필요하다. */
const COL = 134, ROW = 64, NW = 112, NH = 52;

let rowSeq = 0;
const all = [];

function place(n, level, parent) {
  n.level = level;
  n.parent = parent;
  n.id = "n" + all.length;
  all.push(n);
  if (!n.kids) { n.row = rowSeq++; return n.row; }
  const rs = n.kids.map((k) => place(k, level + 1, n));
  n.row = (rs[0] + rs[rs.length - 1]) / 2;
  return n.row;
}

/* 어느 집안(인지도 쪽인가 이미지 쪽인가)인지 위로 거슬러 찾는다.
   색이 끝가지까지 이어져야 어느 줄기에 매달렸는지 눈으로 따라갈 수 있다. */
function famOf(n) {
  for (let p = n; p; p = p.parent) if (p.fam) return p.fam;
  return 0;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const cx = (n) => n.level * COL;
const cy = (n) => n.row * ROW + (ROW - NH) / 2;

/* 이음선. 부모 오른쪽에서 나와 가운데서 한 번 꺾이고 자식 왼쪽에 붙는다.
   원문 그림이 이 모양이라 눈에 익다. 집안마다 따로 그려 색을 달리한다. */
function wire(fam) {
  let d = "";
  all.forEach((n) => {
    if (!n.parent || famOf(n) !== fam) return;
    const p = n.parent;
    const x1 = cx(p) + NW, y1 = cy(p) + NH / 2;
    const x2 = cx(n), y2 = cy(n) + NH / 2;
    const mid = Math.round(x1 + (x2 - x1) / 2);
    d += "M" + x1 + " " + y1 + "H" + mid + "V" + y2 + "H" + x2;
  });
  return d;
}

function nodeHtml(n) {
  const cls = ["nd", "lv" + Math.min(n.level, 2), "fam" + famOf(n)];
  if (n.note) cls.push("has-note");
  return '<button class="' + cls.join(" ") + '" type="button" data-id="' + n.id + '"' +
    ' style="left:' + cx(n) + "px;top:" + cy(n) + 'px">' +
    '<span class="nd-ab">' + esc(n.ab) + "</span>" +
    '<span class="nd-s">' + esc(n.s) + "</span>" +
    "</button>";
}

export function drawBrand(box) {
  rowSeq = 0;
  all.length = 0;
  place(TREE, 0, null);

  const w = COL * 5 + NW;
  const h = ROW * rowSeq;

  box.innerHTML =
    '<div class="bd-head">' +
      '<p class="bd-kick">그림 1-1 · 제1장 IMC와 브랜드자산</p>' +
      "<h2>소비자 관점에서 본 브랜드자산 형성과정</h2>" +
      '<p class="bd-lede">도형에 마우스를 얹거나 누르면 아래에 뜻이 나옵니다. ' +
        '<i class="nd-dot"></i> 가 붙은 곳은 교재가 옮기면서 원문과 달라진 자리입니다.</p>' +
    "</div>" +
    '<div class="bd-scroll"><div class="bd-fit"><div class="bd-map"' +
      ' style="width:' + w + "px;height:" + h + 'px">' +
      '<svg class="bd-wire" width="' + w + '" height="' + h + '" aria-hidden="true">' +
        '<path class="w0" d="' + wire(0) + '"/>' +
        '<path class="w1" d="' + wire(1) + '"/>' +
        '<path class="w2" d="' + wire(2) + '"/>' +
      "</svg>" +
      all.map(nodeHtml).join("") +
    "</div></div></div>" +
    '<p class="bd-hint">좁은 화면에서는 그림을 옆으로 밀어 보세요</p>' +
    '<div class="bd-panel" id="bd-panel">' + all.map(cardHtml).join("") + "</div>" +
    '<p class="bd-foot">교재 <b>촉진관리</b>(제4판) P011. 원문은 ' +
      "Keller, K. L. (1993), <i>Journal of Marketing</i> 57(1), p.7, " +
      "Figure 1 “Dimensions of Brand Knowledge”.</p>";

  const map = box.querySelector(".bd-map");
  const byId = {};
  all.forEach((n) => { byId[n.id] = n; });

  let locked = null;
  const put = (n, move) => { light(box, n); if (move) scrollTo(box, n); };
  put(null);

  /* 그림의 도형 */
  box.querySelectorAll(".nd").forEach((b) => {
    const n = byId[b.dataset.id];
    const peek = () => { if (!locked) put(n); };
    b.addEventListener("mouseenter", peek);
    b.addEventListener("focus", peek);
    b.addEventListener("click", () => {
      locked = locked === n ? null : n;
      put(locked, Boolean(locked));
    });
  });

  /* 아래 설명 카드도 눌리게 한다. 카드에서 그림으로 거슬러 볼 수 있어야
     '이게 어디 붙은 것인지'가 양쪽으로 이어진다. */
  box.querySelectorAll(".bp").forEach((c) => {
    const n = byId[c.dataset.id];
    c.addEventListener("click", () => {
      locked = locked === n ? null : n;
      put(locked, false);
    });
  });

  /* 그림 밖으로 나가면 눌러 둔 것으로 돌아간다. 눌러 둔 것이 없으면 처음으로. */
  map.addEventListener("mouseleave", () => put(locked));

  /* 좁은 화면에서는 그림을 줄여 담는다. 제 크기로 두면 위아래가 텅 비고
     옆으로만 밀려, 어디가 어딘지 가늠이 안 된다. 읽을 글은 아래 카드에
     있으니 도형은 줄여도 된다 — 여기서는 짚기만 하면 되기 때문이다.
     다만 0.58 아래로는 안 줄인다. 그보다 작으면 손가락으로 못 짚는다. */
  const fit = () => {
    const scroll = box.querySelector(".bd-scroll");
    const pad = box.querySelector(".bd-fit");
    if (!scroll.clientWidth) return;
    const k = Math.max(0.58, Math.min(1, scroll.clientWidth / w));
    map.style.transformOrigin = "0 0";
    map.style.transform = k < 1 ? "scale(" + k + ")" : "";
    pad.style.width = Math.ceil(w * k) + "px";
    pad.style.height = Math.ceil(h * k) + "px";
    box.querySelector(".bd-hint").hidden = Math.ceil(w * k) <= scroll.clientWidth + 1;
  };
  fit();
  window.addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
}

/* 설명 카드. 열셋을 한꺼번에 깔아 두고 흐려 놓는다. 누른 것만 살아난다.
   하나씩 갈아 끼우면 자리가 흔들려 어디를 봐야 할지 매번 다시 찾아야 하고,
   눌렀던 것이 사라져 견주어 볼 수도 없다. 이대로 두면 용어 사전도 된다. */
function cardHtml(n) {
  return '<button class="bp fam' + famOf(n) + '" type="button" data-id="' + n.id + '">' +
    '<span class="bp-ab">' + esc(n.ab) + "</span>" +
    '<span class="bp-body">' +
      "<b>" + esc(n.t) + "</b>" +
      '<i class="bp-en">' + esc(n.en) + "</i>" +
      (n.sub ? '<i class="bp-sub">' + esc(n.sub) + "</i>" : "") +
      "<span>" + esc(n.say) + "</span>" +
      (n.note ? '<span class="bp-note"><b>Keller 원문</b> ' + esc(n.note) + "</span>" : "") +
    "</span></button>";
}

/* 고른 마디에서 뿌리까지가 '길'이다. 길 위의 것만 살리고 나머지는 흐린다.
   여섯 겹까지 뻗으면 어느 줄기에 매달린 것인지 눈으로 놓치기 쉽다. */
function light(box, n) {
  const on = {};
  for (let p = n; p; p = p.parent) on[p.id] = true;

  box.querySelector(".bd-map").classList.toggle("picked", Boolean(n));
  box.querySelectorAll(".nd").forEach((b) => {
    b.classList.toggle("on", Boolean(on[b.dataset.id]));
    b.classList.toggle("off", Boolean(n) && !on[b.dataset.id]);
  });

  /* 카드는 길 전체가 아니라 고른 것 하나만 살린다. 길까지 살리면 여섯 장이
     한꺼번에 밝아져 정작 무엇을 눌렀는지가 묻힌다. */
  box.querySelectorAll(".bp").forEach((c) => {
    c.classList.toggle("on", Boolean(n) && c.dataset.id === n.id);
    c.classList.toggle("path", Boolean(n) && c.dataset.id !== n.id && Boolean(on[c.dataset.id]));
  });
}

/* 그림에서 누르면 그 카드가 눈에 들어와야 한다. 카드 쪽에서 누른 것은
   이미 보고 있는 자리라 옮기지 않는다. */
function scrollTo(box, n) {
  if (!n) return;
  const c = box.querySelector('.bp[data-id="' + n.id + '"]');
  if (!c) return;
  const slow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  c.scrollIntoView({ behavior: slow ? "auto" : "smooth", block: "nearest" });
}

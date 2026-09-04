/**
 * 그림 1-1 · 소비자 관점에서 본 브랜드자산 형성과정
 *
 * 제1장 교안에서 네 번(9·12·15·24쪽) 되풀이해 나오는 지도다. 진도가 어디까지
 * 왔는지 짚어 주는 그림이라, 학생이 들어오자마자 보이는 자리에 둔다.
 *
 * 교재 그림은 왼쪽에서 오른쪽으로 뻗는다. 그대로 옮기면 여섯 겹이 옆으로
 * 늘어서서, 폰에서는 글씨를 개미만 하게 줄여야 들어간다. 그래서 위에서
 * 아래로 세웠다. 세로는 스크롤로 얼마든지 쓸 수 있으니 글씨를 줄일 까닭이
 * 없다. 폰과 PC 가 같은 구조를 쓰되, 넓으면 두 갈래를 나란히 놓고 좁으면
 * 위아래로 쌓는다. 줄여서 보여 주는 것이 아니라 다시 접는 것이다.
 *
 * 설명 글은 교재 용어를 그대로 쓰되 한 줄로 풀었다. 학생이 그림만 보고도
 * 무슨 말인지 짐작할 수 있어야 첫 화면에 둘 값이 있다.
 */

const TREE = {
  t: "브랜드자산", sub: "customer-based brand equity",
  say: "소비자가 그 브랜드를 알기 때문에 생기는 값어치. 속이 같은 물건이라도 이름이 붙으면 값이 달라진다.",
  kids: [{
    t: "브랜드 지식", sub: "brand knowledge",
    say: "소비자 머릿속에 그 브랜드에 대해 쌓여 있는 것 전부. 브랜드자산은 여기에서 나온다.",
    kids: [
      {
        t: "브랜드 인지도", sub: "brand awareness",
        say: "그 브랜드를 알아보거나 떠올릴 수 있는가. 아는 것이 먼저다.",
        kids: [
          { t: "브랜드 재인", sub: "brand recognition · 보조상기",
            say: "보여 주면 “아, 이거” 하고 알아본다. 진열대 앞에서 고를 때 쓰인다." },
          { t: "브랜드 회상", sub: "brand recall · 비보조상기",
            say: "아무것도 안 보여 줘도 스스로 떠올린다. “커피 하면?” 하고 물었을 때 나오는 이름." },
        ],
      },
      {
        t: "브랜드 이미지", sub: "brand image",
        say: "그 브랜드 하면 떠오르는 생각의 묶음. 무엇이, 어떻게 떠오르는가로 나뉜다.",
        kids: [
          {
            t: "브랜드 연상 유형", sub: "types of brand association",
            say: "무엇이 떠오르는가.",
            kids: [
              {
                t: "속성", sub: "attributes",
                say: "제품 그 자체에 관한 것.",
                kids: [
                  { t: "제품과 관련된 속성", sub: "product-related · 제품범주 · 제품속성 · 품질",
                    say: "그 물건이 무엇이고 어떻게 만들어졌는가." },
                  { t: "제품과 직접 관련이 없는 속성",
                    sub: "non-product-related · 브랜드 개성 · 사용자 · 제품용도 · 느낌과 경험",
                    say: "물건 자체와는 상관없지만 브랜드에 달라붙은 것들." },
                ],
              },
              {
                t: "편익", sub: "benefits",
                say: "그 브랜드가 나에게 무엇을 해 주는가. 실용(기능)·과시(상징)·즐거움(경험) 셋으로 나뉜다.",
                kids: [
                  { t: "기능적 편익", sub: "functional · utilitarian",
                    say: "문제를 해결해 준다. 실용의 잣대로 따진다 — 잘 지워지는가, 오래 가는가." },
                  { t: "상징적 편익", sub: "symbolic",
                    say: "남에게 나를 보여 준다. 내가 어떤 사람인지, 어느 무리에 드는지를 말해 준다." },
                  { t: "경험적 편익", sub: "experiential · hedonic",
                    say: "쓰는 동안의 즐거움 그 자체. 감각과 기분에 닿는 것이라 실용으로 따지지 않는다." },
                ],
              },
              { t: "기업과 관련된 연상", sub: "corporate associations", say: "만든 회사가 어떤 회사인가." },
            ],
          },
          { t: "브랜드 연상", sub: "favorability · strength · uniqueness of brand associations",
            say: "떠오르는 것이 좋은가, 뚜렷한가, 남과 다른가. 무엇이 떠오르느냐만큼 어떻게 떠오르느냐가 중요하다." },
        ],
      },
    ],
  }],
};

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/* 마디마다 번호를 매겨 둔다. 눌렀을 때 뿌리까지 거슬러 올라가며 길을 밝히려면
   누가 누구의 부모인지 알아야 하는데, DOM 을 뒤지는 것보다 이쪽이 확실하다. */
let seq = 0;
const parentOf = {};

function draw(node, parentId, depth) {
  const id = "b" + (seq++);
  parentOf[id] = parentId;

  const head =
    '<button class="bn-box" type="button" data-id="' + id + '" data-d="' + depth + '">' +
      '<span class="bn-t">' + esc(node.t) + "</span>" +
      (node.sub ? '<span class="bn-sub">' + esc(node.sub) + "</span>" : "") +
    "</button>" +
    (node.say ? '<p class="bn-say" id="say-' + id + '" hidden>' + esc(node.say) + "</p>" : "");

  if (!node.kids) return '<li class="bn" data-d="' + depth + '">' + head + "</li>";

  /* 아래로 더 뻗지 않는 마디끼리는 넓은 화면에서 나란히 세운다. 재인·회상,
     기능적·상징적·경험적 편익처럼 '나란한 것들'이라 눈에도 그렇게 보여야 한다.
     반대로 자식이 또 가지를 치면 옆에 세워 봐야 한쪽만 길어져 빈칸이 남는다. */
  const flat = node.kids.every((k) => !k.kids);
  const wide = flat && node.kids.length > 1 ? " bn-row" : "";
  return '<li class="bn" data-d="' + depth + '">' + head +
    '<ul class="bn-kids' + wide + '">' +
      node.kids.map((k) => draw(k, id, depth + 1)).join("") +
    "</ul></li>";
}

export function drawBrand(box) {
  seq = 0;
  box.innerHTML =
    '<div class="bd-head">' +
      '<p class="bd-kick">그림 1-1 · 제1장 IMC와 브랜드자산</p>' +
      "<h2>소비자 관점에서 본 브랜드자산 형성과정</h2>" +
      '<p class="bd-lede">마디를 누르면 그 갈래가 살아나고 뜻이 함께 나옵니다.</p>' +
    "</div>" +
    '<ul class="bn-root">' + draw(TREE, null, 0) + "</ul>" +
    '<p class="bd-foot">교재 <b>촉진관리</b>(제4판) P011. 원문은 Keller, K. L. (1993), <i>Journal of Marketing</i> 57(1), p.7, Figure 1 “Dimensions of Brand Knowledge”.</p>';

  box.addEventListener("click", (e) => {
    const b = e.target.closest(".bn-box");
    if (!b) return;
    pick(box, b.dataset.id === box.dataset.on ? null : b.dataset.id);
  });
}

/* 고른 마디에서 뿌리까지가 '길'이다. 길 위의 것만 진하게 두고 나머지는
   흐린다. 넷째 겹까지 내려가면 어느 줄기에 매달린 것인지 눈으로 놓치기 쉽다. */
function pick(box, id) {
  box.dataset.on = id || "";
  const path = {};
  for (let p = id; p; p = parentOf[p]) path[p] = true;

  box.querySelectorAll(".bn-box").forEach((b) => {
    const on = path[b.dataset.id];
    b.classList.toggle("on", Boolean(on));
    b.classList.toggle("off", Boolean(id) && !on);
    const say = box.querySelector("#say-" + b.dataset.id);
    if (say) say.hidden = b.dataset.id !== id;
  });
  box.classList.toggle("picked", Boolean(id));
}

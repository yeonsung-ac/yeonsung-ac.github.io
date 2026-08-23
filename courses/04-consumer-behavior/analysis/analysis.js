/* 소비자행동론 - 수업 시연용 분석 결과
 * 저장소에 담아 둔 데이터셋을 읽어 차트를 그린다. 학생 입력은 받지 않는다.
 */
const DATA_DIR = "data/";
const view = { games: [], current: null, wordMode: "pos" };

/* ── 차트 기본 ─────────────────────────────────────────── */
const SVG_NS = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};

const tip = {
  node: null,
  show(html, ev) {
    if (!this.node) {
      this.node = document.createElement("div");
      this.node.className = "tooltip";
      document.body.appendChild(this.node);
    }
    this.node.innerHTML = html;
    this.node.classList.add("on");
    this.move(ev);
  },
  move(ev) {
    if (!this.node) return;
    const w = this.node.offsetWidth, h = this.node.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
    this.node.style.left = `${Math.max(8, x)}px`;
    this.node.style.top = `${Math.max(8, y)}px`;
  },
  hide() { this.node?.classList.remove("on"); },
};

function bindTip(node, html) {
  node.addEventListener("mouseenter", (e) => tip.show(html, e));
  node.addEventListener("mousemove", (e) => tip.move(e));
  node.addEventListener("mouseleave", () => tip.hide());
  node.addEventListener("focus", () => {
    const r = node.getBoundingClientRect();
    tip.show(html, { clientX: r.left + r.width / 2, clientY: r.top });
  });
  node.addEventListener("blur", () => tip.hide());
}

const PLAY_BUCKETS = [
  { label: "2시간\n미만", min: 0, max: 120 },
  { label: "2~10\n시간", min: 120, max: 600 },
  { label: "10~50\n시간", min: 600, max: 3000 },
  { label: "50~100\n시간", min: 3000, max: 6000 },
  { label: "100시간\n이상", min: 6000, max: Infinity },
];

const playtimeOf = (r) => r.author.playtime_at_review || r.author.playtime_forever;

function playtimeRows(reviews) {
  return PLAY_BUCKETS.map((b) => {
    const sub = reviews.filter((r) => {
      const p = playtimeOf(r);
      return p >= b.min && p < b.max;
    });
    const up = sub.filter((r) => r.voted_up).length;
    return { label: b.label, value: sub.length ? up / sub.length : 0, n: sub.length, up };
  });
}

/** 작은 세로막대 — 소형 다중(small multiples) 한 칸 */
function miniBars(host, rows, gameName) {
  const W = 300, H = 190, ML = 34, MR = 8, MT = 18, MB = 44;
  const iw = W - ML - MR, ih = H - MT - MB;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `${gameName} 플레이타임 구간별 추천률` });

  for (let t = 0; t <= 4; t++) {
    const y = MT + ih - (ih * t) / 4;
    svg.append(el("line", { class: "gridline", x1: ML, x2: ML + iw, y1: y, y2: y }));
    if (t % 2 === 0) svg.append(el("text", { class: "tick", x: ML - 6, y: y + 3, "text-anchor": "end" }, `${t * 25}%`));
  }

  const bw = iw / rows.length;
  rows.forEach((r, i) => {
    const cx = ML + bw * i + bw / 2;
    const empty = r.n === 0;
    // 표본이 이보다 적으면 비율을 그대로 믿을 수 없다. 흐리게 그리고 건수를 적는다.
    const thin = !empty && r.n < 10;
    const h = empty ? 0 : Math.max(2, ih * r.value);
    const y = MT + ih - h;
    const g = el("g", { tabindex: "0" });
    if (!empty) g.append(el("rect", { x: cx - bw * 0.3, y, width: bw * 0.6, height: h, rx: 3,
                                      fill: "var(--series-1)", "fill-opacity": thin ? 0.28 : 1 }));
    g.append(el("rect", { class: "hit", x: cx - bw / 2, y: MT, width: bw, height: ih }));
    g.append(el("text", { class: "mark-label", x: cx, y: y - 5, "text-anchor": "middle",
      style: (empty || thin) ? "fill:var(--muted);font-weight:400;font-size:9px" : "font-size:9.5px" },
      empty ? "없음" : thin ? `n=${r.n}` : `${Math.round(r.value * 100)}%`));
    r.label.split("\n").forEach((ln, k) =>
      svg.append(el("text", { class: "tick", x: cx, y: MT + ih + 14 + k * 11, "text-anchor": "middle", style: "font-size:9px" }, ln)));
    bindTip(g, `<div class="t-title">${esc(gameName)}</div>
      <div class="t-row"><span>${esc(r.label.replace("\n", ""))}</span><span>${r.n ? pct(r.value) : "표본 없음"}</span></div>
      <div class="t-row"><span>리뷰 수</span><span>${fmt(r.n)}건</span></div>`);
    svg.append(g);
  });
  svg.append(el("line", { class: "baseline", x1: ML, x2: ML + iw, y1: MT + ih, y2: MT + ih }));
  host.replaceChildren(svg);
}

/** 추천 vs 비추천 리뷰 길이 */
function lengthChart(host, reviews) {
  const pos = reviews.filter((r) => r.voted_up), neg = reviews.filter((r) => !r.voted_up);
  const rows = [
    { label: "추천", med: median(pos.map((r) => r.review_len)), n: pos.length, color: "var(--pos)" },
    { label: "비추천", med: median(neg.map((r) => r.review_len)), n: neg.length, color: "var(--neg)" },
  ];
  const max = Math.max(...rows.map((r) => r.med), 1) * 1.15;
  const W = 420, H = 210, ML = 50, MR = 12, MT = 18, MB = 36;
  const iw = W - ML - MR, ih = H - MT - MB;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "추천 리뷰와 비추천 리뷰의 길이 중앙값" });
  for (let t = 0; t <= 4; t++) {
    const y = MT + ih - (ih * t) / 4;
    svg.append(el("line", { class: "gridline", x1: ML, x2: ML + iw, y1: y, y2: y }));
    svg.append(el("text", { class: "tick", x: ML - 7, y: y + 3.5, "text-anchor": "end" }, fmt(Math.round((max * t) / 4))));
  }
  const bw = iw / rows.length;
  rows.forEach((r, i) => {
    const cx = ML + bw * i + bw / 2;
    const h = Math.max(2, ih * (r.med / max));
    const y = MT + ih - h;
    const g = el("g", { tabindex: "0" });
    g.append(el("rect", { x: cx - 40, y, width: 80, height: h, rx: 4, fill: r.color }));
    g.append(el("text", { class: "mark-label", x: cx, y: y - 6, "text-anchor": "middle" }, `${fmt(Math.round(r.med))}자`));
    svg.append(el("text", { class: "tick", x: cx, y: MT + ih + 16, "text-anchor": "middle" }, r.label));
    g.append(el("rect", { class: "hit", x: cx - bw / 2, y: MT, width: bw, height: ih }));
    bindTip(g, `<div class="t-title">${r.label} 리뷰</div>
      <div class="t-row"><span>길이 중앙값</span><span>${fmt(Math.round(r.med))}자</span></div>
      <div class="t-row"><span>리뷰 수</span><span>${fmt(r.n)}건</span></div>`);
    svg.append(g);
  });
  svg.append(el("line", { class: "baseline", x1: ML, x2: ML + iw, y1: MT + ih, y2: MT + ih }));
  host.replaceChildren(svg);
}

/* ── 단어 빈도 ─────────────────────────────────────────── */
const stripBB = (s) => String(s || "").replace(/\[\/?[a-z][^\]]{0,80}\]/gi, " ");
const JOSA = ["으로부터", "에게서", "이라고", "으로써", "으로서", "에서는", "에게는", "라고는",
              "까지", "부터", "에서", "에게", "으로", "이나", "이란", "라는", "처럼", "보다",
              "마다", "조차", "밖에", "한테", "이랑", "이며", "라도",
              "은", "는", "이", "가", "을", "를", "에", "의", "도", "로", "와", "과", "만", "랑"];
const STOP = new Set(["그리고", "그런데", "하지만", "그래서", "그냥", "진짜", "정말", "너무", "매우",
  "아주", "조금", "이거", "저거", "그거", "이건", "그건", "이게", "그게", "여기", "거기",
  "합니다", "입니다", "때문", "하지", "그래", "있는", "없는", "하는", "되는", "같은", "많이",
  "이런", "저런", "그런", "어떤", "무슨", "모든", "우리", "제가", "내가", "나는", "저는",
  "있습니다", "없습니다", "같습니다", "정도", "부분", "생각", "게임",
  "the", "and", "but", "for", "you", "this", "that", "with", "have", "not", "are", "was"]);

function stem(w) {
  if (!/[가-힣]$/.test(w)) return w;
  for (const j of JOSA) if (w.length > j.length + 1 && w.endsWith(j)) return w.slice(0, -j.length);
  return w;
}

const tokenize = (t) => stripBB(t)
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[^\p{Script=Hangul}\p{L}\p{N}]+/gu, " ")
  .split(/\s+/).map((w) => stem(w.trim().toLowerCase()))
  .filter((w) => w.length >= 2 && w.length <= 12 && !STOP.has(w) && !/^\d+$/.test(w));

function wordChart(host, reviews, want) {
  const subset = reviews.filter((r) => r.voted_up === want);
  const count = new Map(), docs = new Map();
  for (const r of subset) {
    const seen = new Set();
    for (const w of tokenize(r.review)) {
      count.set(w, (count.get(w) || 0) + 1);
      if (!seen.has(w)) { docs.set(w, (docs.get(w) || 0) + 1); seen.add(w); }
    }
  }
  const rows = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([w, n]) => ({ label: w, value: n, docs: docs.get(w) || 0 }));
  if (!rows.length) {
    host.replaceChildren(Object.assign(document.createElement("p"),
      { className: "sub", textContent: "해당 리뷰가 없습니다." }));
    return 0;
  }
  const rowH = 24, W = 420, ML = 84, MR = 40, MT = 4;
  const H = MT + rows.length * rowH + 4, iw = W - ML - MR;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `${want ? "추천" : "비추천"} 리뷰에서 자주 나온 단어 상위 ${rows.length}개` });
  rows.forEach((r, i) => {
    const y = MT + i * rowH, w = Math.max(2, (iw * r.value) / max);
    const g = el("g", { tabindex: "0" });
    g.append(el("text", { class: "tick", x: ML - 9, y: y + rowH / 2 + 3.5, "text-anchor": "end" }, r.label));
    g.append(el("rect", { x: ML, y: y + 4, width: w, height: rowH - 9, rx: 3,
                          fill: want ? "var(--pos)" : "var(--neg)" }));
    g.append(el("text", { class: "mark-label", x: ML + w + 7, y: y + rowH / 2 + 3.5 }, fmt(r.value)));
    g.append(el("rect", { class: "hit", x: 0, y, width: W, height: rowH }));
    bindTip(g, `<div class="t-title">${esc(r.label)}</div>
      <div class="t-row"><span>등장</span><span>${fmt(r.value)}회</span></div>
      <div class="t-row"><span>나온 리뷰</span><span>${fmt(r.docs)}건</span></div>`);
    svg.append(g);
  });
  host.replaceChildren(svg);
  return subset.length;
}

/* ── 화면 구성 ─────────────────────────────────────────── */

function renderOverview() {
  const host = $("#overview");
  host.innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>게임</th><th class="num">표본</th><th class="num">표본 추천률</th>
        <th class="num">전체 리뷰</th><th class="num">전체 추천률</th><th>스팀 평가</th>
      </tr></thead>
      <tbody>${view.games.map((g) => {
        const pos = g.reviews.filter((r) => r.voted_up).length;
        const s = g.summary || {};
        const allRate = s.total_reviews ? s.total_positive / s.total_reviews : null;
        return `<tr>
          <td><b>${esc(g.name)}</b></td>
          <td class="num">${fmt(g.reviews.length)}</td>
          <td class="num">${pct(pos / g.reviews.length)}</td>
          <td class="num">${s.total_reviews ? fmt(s.total_reviews) : "-"}</td>
          <td class="num">${allRate !== null ? pct(allRate) : "-"}</td>
          <td>${esc(s.review_score_desc || "-")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
}

function renderSmallMultiples() {
  const host = $("#small-multiples");
  host.innerHTML = "";
  view.games.forEach((g) => {
    const rows = playtimeRows(g.reviews);
    const first = rows.find((r) => r.n >= 10), last = [...rows].reverse().find((r) => r.n >= 10);
    const dir = first && last && first !== last
      ? (last.value - first.value > 0.05 ? ["오래 할수록 ↑", "var(--pos)"]
        : first.value - last.value > 0.05 ? ["오래 할수록 ↓", "var(--neg)"]
        : ["변화 작음", "var(--muted)"])
      : ["판단 보류", "var(--muted)"];
    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML = `<h3>${esc(g.name)}</h3>
      <p class="sub"><span class="verdict" style="background:color-mix(in srgb, ${dir[1]} 16%, transparent);color:${dir[1]}">${dir[0]}</span></p>
      <div class="mini"></div>`;
    host.appendChild(card);
    miniBars(card.querySelector(".mini"), rows, g.name);
  });
}

function renderTabs() {
  const host = $("#game-tabs");
  host.innerHTML = view.games.map((g, i) =>
    `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(g.name)}</button>`).join("");
  $$("#game-tabs button").forEach((b) => b.addEventListener("click", () => {
    $$("#game-tabs button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    view.current = view.games[Number(b.dataset.i)];
    renderDetail();
  }));
}

function renderDetail() {
  const g = view.current;
  const R = g.reviews;
  const pos = R.filter((r) => r.voted_up).length;
  const played = R.map(playtimeOf).filter(Boolean);

  $("#detail-note").textContent = g.note || "";
  $("#detail-tiles").innerHTML = `
    <div class="tile"><p class="k">표본</p><p class="v">${fmt(R.length)}</p><p class="s">${g.collected_at} 수집 · 유용성순</p></div>
    <div class="tile"><p class="k">표본 추천률</p><p class="v" style="color:var(--pos)">${pct(pos / R.length)}</p><p class="s">추천 ${fmt(pos)} · 비추천 ${fmt(R.length - pos)}</p></div>
    <div class="tile"><p class="k">플레이타임 중앙값</p><p class="v">${(median(played) / 60).toFixed(0)}<span style="font-size:.9rem"> 시간</span></p><p class="s">리뷰 작성 시점</p></div>
    <div class="tile"><p class="k">리뷰 길이 중앙값</p><p class="v">${fmt(Math.round(median(R.map((r) => r.review_len))))}<span style="font-size:.9rem"> 자</span></p><p class="s">공백 포함</p></div>`;

  lengthChart($("#chart-length"), R);
  const n = wordChart($("#chart-words"), R, view.wordMode === "pos");
  $("#words-sub").textContent = `${view.wordMode === "pos" ? "추천" : "비추천"} 리뷰 ${fmt(n)}건에서 추출`;
}

async function init() {
  initTheme();
  document.addEventListener("themechange", () => { renderSmallMultiples(); renderDetail(); });

  const idx = await (await fetch(DATA_DIR + "index.json")).json();
  $("#source-note").textContent =
    `${idx.collected_at} 수집 · ${langLabel(idx.language)} · ${sortLabel(idx.sort)} · 출처 ${idx.source}`;

  view.games = await Promise.all(idx.games.map(async (g) => {
    const d = await (await fetch(DATA_DIR + g.file)).json();
    return { ...d, reviews: d.reviews };
  }));
  view.current = view.games[0];

  renderOverview();
  renderSmallMultiples();
  renderTabs();
  renderDetail();

  $$("#words-toggle button").forEach((b) => b.addEventListener("click", () => {
    view.wordMode = b.dataset.mode;
    $$("#words-toggle button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderDetail();
  }));

  $("#loading").hidden = true;
  $("#content").hidden = false;
}

document.addEventListener("DOMContentLoaded", init);

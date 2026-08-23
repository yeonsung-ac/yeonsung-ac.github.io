/* 소비자행동론 - 스팀 리뷰 분석기
 *
 * PROXY_BASE 를 채우면 앱 번호로 실시간 수집이 열린다.
 * 비워 두면 샘플 데이터와 파일 업로드만으로 동작한다.
 * 프록시 배포 방법은 worker/README.md 참고.
 */
const CONFIG = {
  PROXY_BASE: "",
  PAGE_SIZE: 100,
  MAX_PAGES: 60, // 안전장치: 최대 6,000건
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const pct = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;

const state = {
  reviews: [],
  meta: null,
  wordMode: "pos",
};

/* ═══════════════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════════════ */

const hasProxy = () => Boolean(CONFIG.PROXY_BASE);

async function api(path, params = {}) {
  if (!hasProxy()) throw new Error("프록시가 설정되지 않았습니다.");
  const url = new URL(CONFIG.PROXY_BASE.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
    throw new Error(`요청 실패 (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
  }
  return res.json();
}

function readSettings() {
  return {
    appid: $("#appid").value.trim(),
    language: $("#language").value,
    review_type: $("#review_type").value,
    purchase_type: $("#purchase_type").value,
    filter: $("#sort").value,
    day_range: $("#day_range").value,
    limit: Number($("#limit").value),
  };
}

function reviewParams(s, cursor) {
  const p = {
    language: s.language,
    review_type: s.review_type,
    purchase_type: s.purchase_type,
    filter: s.filter,
    num_per_page: CONFIG.PAGE_SIZE,
    cursor: cursor || "*",
  };
  // day_range 는 filter=all(유용성순) 일 때만 의미가 있다.
  if (s.filter === "all" && s.day_range) p.day_range = s.day_range;
  return p;
}

/* ═══════════════════════════════════════════════════════
   사전 점검
   ═══════════════════════════════════════════════════════ */

async function runPrecheck() {
  const s = readSettings();
  if (!/^\d+$/.test(s.appid)) return notice("err", "앱 번호를 숫자로 입력하세요.", "입력 오류");
  if (!hasProxy()) return notice("warn", "프록시 주소가 비어 있어 실시간 조회를 할 수 없습니다. 아래에서 샘플 데이터를 고르거나 JSON 파일을 올려 주세요.", "실시간 조회 불가");

  setBusy(true, "상태를 확인하는 중…");
  try {
    const [rev, det] = await Promise.all([
      api(`/appreviews/${s.appid}`, reviewParams(s)),
      api("/appdetails", { appids: s.appid }).catch(() => null),
    ]);
    if (!rev || rev.success !== 1) throw new Error("스팀이 해당 앱 번호의 리뷰를 반환하지 않았습니다.");

    const q = rev.query_summary || {};
    const name = det?.[s.appid]?.data?.name || `앱 ${s.appid}`;
    const totalPos = q.total_positive ?? 0;
    const totalNeg = q.total_negative ?? 0;
    const total = q.total_reviews ?? (totalPos + totalNeg);
    if (!total) throw new Error("이 조건에 해당하는 리뷰가 없습니다. 언어나 필터를 바꿔 보세요.");

    const willFetch = Math.min(s.limit, total);
    const pages = Math.ceil(willFetch / CONFIG.PAGE_SIZE);
    renderPrecheck({ name, appid: s.appid, total, totalPos, totalNeg,
                     scoreDesc: q.review_score_desc, willFetch, pages, settings: s });
    $("#btn-collect").disabled = false;
    notice("info", `조건에 맞는 리뷰 ${fmt(total)}건을 찾았습니다. 아래 예상치를 확인하고 수집하세요.`, "확인 완료");
  } catch (err) {
    $("#precheck").classList.remove("on");
    $("#btn-collect").disabled = true;
    notice("err", err.message, "오류");
  } finally {
    setBusy(false);
  }
}

function renderPrecheck(d) {
  const posRate = d.total ? d.totalPos / d.total : 0;
  const seconds = Math.max(1, Math.round(d.pages * 0.9));
  const verdict = posRate >= 0.8 ? ["매우 긍정적", "var(--pos)"]
    : posRate >= 0.7 ? ["대체로 긍정적", "var(--pos)"]
    : posRate >= 0.4 ? ["복합적", "var(--warn)"]
    : ["부정적", "var(--neg)"];

  $("#precheck").innerHTML = `
    <div class="precheck-head">
      <h3>${esc(d.name)}</h3>
      <span class="appid">앱 번호 ${d.appid}</span>
      <span class="verdict" style="background:color-mix(in srgb, ${verdict[1]} 16%, transparent);color:${verdict[1]}">${verdict[0]}</span>
      ${d.scoreDesc ? `<span class="appid">스팀 평가: ${esc(d.scoreDesc)}</span>` : ""}
    </div>
    <div class="ratio-bar" role="img" aria-label="긍정 ${pct(posRate)}, 부정 ${pct(1 - posRate)}">
      <i style="width:${(posRate * 100).toFixed(2)}%;background:var(--pos)"></i>
      <i style="width:${((1 - posRate) * 100).toFixed(2)}%;background:var(--neg)"></i>
    </div>
    <p class="ratio-legend">
      <span><i class="swatch" style="background:var(--pos)"></i>추천 ${fmt(d.totalPos)}건 · ${pct(posRate)}</span>
      <span><i class="swatch" style="background:var(--neg)"></i>비추천 ${fmt(d.totalNeg)}건 · ${pct(1 - posRate)}</span>
    </p>
    <div class="tiles">
      <div class="tile"><p class="k">조건에 맞는 리뷰</p><p class="v">${fmt(d.total)}</p><p class="s">${langLabel(d.settings.language)} · ${typeLabel(d.settings.review_type)}</p></div>
      <div class="tile"><p class="k">이번에 수집할 양</p><p class="v">${fmt(d.willFetch)}</p><p class="s">${d.pages}회 요청 · 약 ${seconds}초</p></div>
      <div class="tile"><p class="k">전체 대비 표본</p><p class="v">${pct(d.willFetch / d.total, 1)}</p><p class="s">${d.willFetch < d.total ? "일부 표본" : "전수"}</p></div>
      <div class="tile"><p class="k">정렬 기준</p><p class="v" style="font-size:1.05rem">${sortLabel(d.settings.filter)}</p><p class="s">${d.settings.filter === "all" && d.settings.day_range ? `최근 ${d.settings.day_range}일` : "기간 제한 없음"}</p></div>
    </div>
    ${d.willFetch < d.total ? `<div class="notice info"><b>표본 안내</b><span>전체 ${fmt(d.total)}건 중 ${fmt(d.willFetch)}건만 가져옵니다. ${sortLabel(d.settings.filter)} 기준이라 표본이 한쪽으로 치우칠 수 있습니다. 수업에서 해석할 때 이 점을 짚어 주세요.</span></div>` : ""}
  `;
  $("#precheck").classList.add("on");
}

const langLabel = (v) => ({ koreana: "한국어", english: "영어", all: "전체 언어" }[v] || v);
const typeLabel = (v) => ({ all: "추천+비추천", positive: "추천만", negative: "비추천만" }[v] || v);
const sortLabel = (v) => ({ recent: "최신순", updated: "수정순", all: "유용성순" }[v] || v);

/* ═══════════════════════════════════════════════════════
   수집
   ═══════════════════════════════════════════════════════ */

async function collect() {
  const s = readSettings();
  const collected = [];
  const seen = new Set();
  let cursor = "*";

  $("#progress").classList.add("on");
  setBusy(true, "수집 중…");
  try {
    for (let page = 0; page < CONFIG.MAX_PAGES; page++) {
      if (collected.length >= s.limit) break;
      const data = await api(`/appreviews/${s.appid}`, reviewParams(s, cursor));
      if (data.success !== 1) throw new Error("스팀 응답이 올바르지 않습니다.");
      const batch = data.reviews || [];
      if (!batch.length) break;

      for (const r of batch) {
        if (seen.has(r.recommendationid)) continue;
        seen.add(r.recommendationid);
        collected.push(r);
      }
      progress(Math.min(collected.length / s.limit, 1),
               `${fmt(collected.length)} / ${fmt(s.limit)}건 수집`);

      const next = data.cursor;
      if (!next || next === cursor || batch.length < CONFIG.PAGE_SIZE) break;
      cursor = next;
    }

    if (!collected.length) throw new Error("수집된 리뷰가 없습니다.");
    const trimmed = collected.slice(0, s.limit);
    state.reviews = trimmed.map(normalize);
    state.meta = { name: $(".precheck-head h3")?.textContent || `앱 ${s.appid}`,
                   appid: s.appid, settings: s, source: "실시간 수집",
                   collected_at: new Date().toISOString().slice(0, 10) };
    progress(1, `${fmt(trimmed.length)}건 수집 완료`);
    $$(".dl").forEach((b) => (b.disabled = false));
    notice("info", `${fmt(trimmed.length)}건을 수집했습니다. 아래에서 내려받거나 바로 분석 결과를 확인하세요.`, "수집 완료");
    analyze();
  } catch (err) {
    notice("err", err.message, "수집 실패");
  } finally {
    setBusy(false);
  }
}

/** 스팀 원본 리뷰에서 분석에 쓰는 필드만 남긴다(개인 식별정보 제외). */
function normalize(r) {
  const a = r.author || {};
  const text = (r.review || "").trim();
  return {
    voted_up: !!r.voted_up,
    votes_up: r.votes_up || 0,
    votes_funny: r.votes_funny || 0,
    weighted_vote_score: Number(r.weighted_vote_score) || 0,
    comment_count: r.comment_count || 0,
    timestamp_created: r.timestamp_created || 0,
    steam_purchase: !!r.steam_purchase,
    received_for_free: !!r.received_for_free,
    written_during_early_access: !!r.written_during_early_access,
    primarily_steam_deck: !!r.primarily_steam_deck,
    author: {
      num_games_owned: a.num_games_owned || 0,
      num_reviews: a.num_reviews || 0,
      playtime_forever: a.playtime_forever || 0,
      playtime_at_review: a.playtime_at_review || 0,
    },
    review: text,
    review_len: text.length,
  };
}

/* ═══════════════════════════════════════════════════════
   내려받기
   ═══════════════════════════════════════════════════════ */

function download(format) {
  if (!state.reviews.length) return;
  const base = `steam-reviews-${state.meta?.appid || "data"}-${state.meta?.collected_at || "export"}`;
  if (format === "json") {
    const payload = { ...state.meta, sample_size: state.reviews.length, reviews: state.reviews };
    saveBlob(JSON.stringify(payload, null, 2), `${base}.json`, "application/json");
  } else {
    const cols = ["voted_up", "votes_up", "votes_funny", "weighted_vote_score", "comment_count",
                  "timestamp_created", "created_date", "steam_purchase", "received_for_free",
                  "playtime_forever_h", "playtime_at_review_h", "num_games_owned", "num_reviews",
                  "review_len", "review"];
    const rows = state.reviews.map((r) => [
      r.voted_up, r.votes_up, r.votes_funny, r.weighted_vote_score, r.comment_count,
      r.timestamp_created, new Date(r.timestamp_created * 1000).toISOString().slice(0, 10),
      r.steam_purchase, r.received_for_free,
      (r.author.playtime_forever / 60).toFixed(1), (r.author.playtime_at_review / 60).toFixed(1),
      r.author.num_games_owned, r.author.num_reviews, r.review_len, r.review,
    ]);
    const csv = [cols, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    // 엑셀이 한글을 깨지 않게 BOM 을 붙인다.
    saveBlob("﻿" + csv, `${base}.csv`, "text/csv;charset=utf-8");
  }
}

const csvCell = (v) => {
  const s = String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s}"` : s;
};

function saveBlob(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ═══════════════════════════════════════════════════════
   샘플 / 업로드
   ═══════════════════════════════════════════════════════ */

async function loadSample(file) {
  setBusy(true, "샘플을 불러오는 중…");
  try {
    const res = await fetch(`data/${file}`);
    if (!res.ok) throw new Error("샘플 파일을 찾지 못했습니다.");
    const d = await res.json();
    adoptDataset(d, `샘플 데이터 (${d.collected_at} 수집)`);
  } catch (err) {
    notice("err", err.message, "불러오기 실패");
  } finally {
    setBusy(false);
  }
}

async function loadUpload(file) {
  try {
    const d = JSON.parse(await file.text());
    adoptDataset(d, `업로드 파일 (${file.name})`);
  } catch {
    notice("err", "JSON 형식을 읽지 못했습니다. 스팀 API 응답이나 이 도구가 내려준 파일을 올려 주세요.", "불러오기 실패");
  }
}

function adoptDataset(d, sourceLabel) {
  const raw = d.reviews || [];
  if (!raw.length) throw new Error("리뷰가 들어 있지 않은 파일입니다.");
  // 스팀 원본이든 이 도구가 내려준 파일이든 모두 받는다.
  state.reviews = raw.map((r) => (r.author && "playtime_forever" in r.author && "review_len" in r ? r : normalize(r)));
  state.meta = { name: d.name || "업로드한 데이터", appid: d.appid || "-",
                 source: sourceLabel, collected_at: d.collected_at || "-",
                 summary: d.summary };
  $$(".dl").forEach((b) => (b.disabled = false));
  notice("info", `${fmt(state.reviews.length)}건을 불러왔습니다 — ${sourceLabel}`, "불러오기 완료");
  analyze();
}

/* ═══════════════════════════════════════════════════════
   분석
   ═══════════════════════════════════════════════════════ */

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const PLAY_BUCKETS = [
  { label: "2시간 미만", min: 0, max: 120 },
  { label: "2~10시간", min: 120, max: 600 },
  { label: "10~50시간", min: 600, max: 3000 },
  { label: "50~100시간", min: 3000, max: 6000 },
  { label: "100시간 이상", min: 6000, max: Infinity },
];

const STOPWORDS = new Set([
  "그리고", "그런데", "하지만", "그래서", "그냥", "진짜", "정말", "너무", "매우", "아주", "조금",
  "이거", "저거", "그거", "이건", "그건", "저건", "이게", "그게", "저게", "여기", "거기", "저기",
  "합니다", "입니다", "때문에", "있는", "없는", "하는", "되는", "같은", "많이", "좀더", "다시",
  "이런", "저런", "그런", "어떤", "무슨", "모든", "우리", "제가", "내가", "나는", "저는",
  "때문", "하지", "그래", "있습니다", "없습니다", "같습니다", "그리", "정도", "부분", "생각",
  "the", "and", "but", "for", "you", "this", "that", "with", "have", "not", "are", "was", "its",
  "game", "게임", "합니다만", "습니다", "됩니다", "것을", "것이", "수가", "수도",
]);

function analyze() {
  const R = state.reviews;
  if (!R.length) return;
  const pos = R.filter((r) => r.voted_up);
  const neg = R.filter((r) => !r.voted_up);
  const posRate = pos.length / R.length;

  renderTiles({ total: R.length, posRate, pos: pos.length, neg: neg.length,
    medPlay: median(R.map((r) => r.author.playtime_at_review || r.author.playtime_forever)) / 60,
    medLen: median(R.map((r) => r.review_len)) });

  drawPlaytimeChart(R);
  drawTrendChart(R);
  drawLengthChart(pos, neg);
  drawWordChart();
  renderTable(R);

  $("#results").hidden = false;
  $("#dataset-label").textContent = `${state.meta?.name || ""} · ${fmt(R.length)}건 · ${state.meta?.source || ""}`;
}

function renderTiles(d) {
  $("#tiles").innerHTML = `
    <div class="tile"><p class="k">분석 대상 리뷰</p><p class="v">${fmt(d.total)}</p><p class="s">추천 ${fmt(d.pos)} · 비추천 ${fmt(d.neg)}</p></div>
    <div class="tile"><p class="k">추천 비율</p><p class="v" style="color:var(--pos)">${pct(d.posRate)}</p><p class="s">이 표본 기준</p></div>
    <div class="tile"><p class="k">리뷰 작성 시점 플레이타임</p><p class="v">${d.medPlay.toFixed(1)}<span style="font-size:.9rem"> 시간</span></p><p class="s">중앙값</p></div>
    <div class="tile"><p class="k">리뷰 길이</p><p class="v">${fmt(Math.round(d.medLen))}<span style="font-size:.9rem"> 자</span></p><p class="s">중앙값</p></div>
  `;
}

/* ═══════════════════════════════════════════════════════
   차트 (의존 라이브러리 없이 SVG 직접 그림)
   ═══════════════════════════════════════════════════════ */

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
    const pad = 14;
    const w = this.node.offsetWidth, h = this.node.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    this.node.style.left = `${Math.max(8, x)}px`;
    this.node.style.top = `${Math.max(8, y)}px`;
  },
  hide() { this.node?.classList.remove("on"); },
};

function bindTip(node, html) {
  node.addEventListener("mouseenter", (e) => tip.show(html, e));
  node.addEventListener("mousemove", (e) => tip.move(e));
  node.addEventListener("mouseleave", () => tip.hide());
  node.addEventListener("focus", (e) => tip.show(html, { clientX: node.getBoundingClientRect().left, clientY: node.getBoundingClientRect().top }));
  node.addEventListener("blur", () => tip.hide());
}

/** 세로 막대 — 한 계열. 값은 0~1 비율. */
function vbar(host, rows, { yLabel, color = "var(--series-1)", fmtVal = (v) => pct(v, 0), tipHtml }) {
  const W = 560, H = 260, ML = 44, MR = 12, MT = 20, MB = 52;
  const iw = W - ML - MR, ih = H - MT - MB;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
                          "aria-label": `${yLabel}. 자세한 값은 아래 표 보기에서 확인할 수 있습니다.` });

  for (let t = 0; t <= 4; t++) {
    const y = MT + ih - (ih * t) / 4;
    svg.append(el("line", { class: "gridline", x1: ML, x2: ML + iw, y1: y, y2: y }));
    svg.append(el("text", { class: "tick", x: ML - 8, y: y + 3.5, "text-anchor": "end" }, `${t * 25}%`));
  }

  const bw = iw / rows.length;
  const barW = Math.min(56, bw * 0.56);
  rows.forEach((r, i) => {
    const cx = ML + bw * i + bw / 2;
    const empty = r.n === 0;
    const h = empty ? 0 : Math.max(2, ih * r.value);
    const y = MT + ih - h;
    const g = el("g", { tabindex: "0" });
    if (!empty) g.append(el("rect", { x: cx - barW / 2, y, width: barW, height: h, rx: 4, fill: color }));
    g.append(el("rect", { class: "hit", x: cx - bw / 2, y: MT, width: bw, height: ih }));
    g.append(el("text", { class: "mark-label", x: cx, y: y - 7, "text-anchor": "middle",
                          style: empty ? "fill:var(--muted);font-weight:400" : "" },
              empty ? "표본 없음" : fmtVal(r.value)));
    wrapTick(svg, r.label, cx, MT + ih + 17);
    bindTip(g, tipHtml(r));
    svg.append(g);
  });

  svg.append(el("line", { class: "baseline", x1: ML, x2: ML + iw, y1: MT + ih, y2: MT + ih }));
  host.replaceChildren(svg);
}

function wrapTick(svg, label, x, y) {
  const parts = label.length > 7 ? label.split(/(?<=~)|(?=이상|미만)/) : [label];
  parts.forEach((p, i) => svg.append(el("text", { class: "tick", x, y: y + i * 12, "text-anchor": "middle" }, p)));
}

/** 가로 막대 — 단어 빈도용. */
function hbar(host, rows, { color = "var(--series-1)", unit = "회" }) {
  const rowH = 26, W = 560, ML = 96, MR = 46, MT = 6;
  const H = MT + rows.length * rowH + 6;
  const iw = W - ML - MR;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
                          "aria-label": `단어별 등장 횟수 상위 ${rows.length}개` });

  rows.forEach((r, i) => {
    const y = MT + i * rowH;
    const w = Math.max(2, (iw * r.value) / max);
    const g = el("g", { tabindex: "0" });
    g.append(el("text", { class: "tick", x: ML - 10, y: y + rowH / 2 + 3.5, "text-anchor": "end" }, r.label));
    g.append(el("rect", { x: ML, y: y + 4, width: w, height: rowH - 10, rx: 4, fill: color }));
    g.append(el("text", { class: "mark-label", x: ML + w + 8, y: y + rowH / 2 + 3.5 }, fmt(r.value)));
    g.append(el("rect", { class: "hit", x: 0, y, width: W, height: rowH }));
    bindTip(g, `<div class="t-title">${esc(r.label)}</div><div class="t-row"><span>등장</span><span>${fmt(r.value)}${unit}</span></div><div class="t-row"><span>리뷰 수</span><span>${fmt(r.docs)}개</span></div>`);
    svg.append(g);
  });
  host.replaceChildren(svg);
}

function drawPlaytimeChart(R) {
  const rows = PLAY_BUCKETS.map((b) => {
    const inB = R.filter((r) => {
      const p = r.author.playtime_at_review || r.author.playtime_forever;
      return p >= b.min && p < b.max;
    });
    const up = inB.filter((r) => r.voted_up).length;
    return { label: b.label, value: inB.length ? up / inB.length : 0, n: inB.length, up };
  });
  vbar($("#chart-playtime"), rows, {
    yLabel: "플레이타임 구간별 추천률",
    tipHtml: (r) => `<div class="t-title">${esc(r.label)}</div>
      <div class="t-row"><span>추천률</span><span>${r.n ? pct(r.value) : "-"}</span></div>
      <div class="t-row"><span>리뷰 수</span><span>${fmt(r.n)}건</span></div>
      <div class="t-row"><span>추천</span><span>${fmt(r.up)}건</span></div>`,
  });
  state.playtimeRows = rows;
}

function drawTrendChart(R) {
  const byMonth = new Map();
  for (const r of R) {
    if (!r.timestamp_created) continue;
    const k = new Date(r.timestamp_created * 1000).toISOString().slice(0, 7);
    const m = byMonth.get(k) || { n: 0, up: 0 };
    m.n++; if (r.voted_up) m.up++;
    byMonth.set(k, m);
  }
  const rows = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ label: k, value: v.up / v.n, n: v.n }));
  state.trendRows = rows;

  const host = $("#chart-trend");
  if (rows.length < 2) {
    host.replaceChildren(Object.assign(document.createElement("p"),
      { className: "sub", textContent: "기간이 짧아 추이를 그릴 수 없습니다. 수집 기간을 늘려 보세요." }));
    return;
  }

  const W = 560, H = 260, ML = 44, MR = 14, MT = 20, MB = 44;
  const iw = W - ML - MR, ih = H - MT - MB;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `월별 추천률 추이, ${rows[0].label}부터 ${rows.at(-1).label}까지` });

  for (let t = 0; t <= 4; t++) {
    const y = MT + ih - (ih * t) / 4;
    svg.append(el("line", { class: "gridline", x1: ML, x2: ML + iw, y1: y, y2: y }));
    svg.append(el("text", { class: "tick", x: ML - 8, y: y + 3.5, "text-anchor": "end" }, `${t * 25}%`));
  }

  const X = (i) => ML + (rows.length === 1 ? iw / 2 : (iw * i) / (rows.length - 1));
  const Y = (v) => MT + ih - ih * v;
  svg.append(el("path", {
    d: rows.map((r, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(r.value).toFixed(1)}`).join(" "),
    fill: "none", stroke: "var(--series-1)", "stroke-width": 2,
    "stroke-linejoin": "round", "stroke-linecap": "round",
  }));

  const step = Math.ceil(rows.length / 7);
  rows.forEach((r, i) => {
    svg.append(el("circle", { cx: X(i), cy: Y(r.value), r: 4, fill: "var(--series-1)",
                              stroke: "var(--surface)", "stroke-width": 2 }));
    if (i % step === 0 || i === rows.length - 1) {
      svg.append(el("text", { class: "tick", x: X(i), y: MT + ih + 17, "text-anchor": "middle" }, r.label));
    }
    const g = el("g", { tabindex: "0" });
    g.append(el("rect", { class: "hit", x: X(i) - iw / rows.length / 2, y: MT,
                          width: iw / rows.length, height: ih }));
    bindTip(g, `<div class="t-title">${r.label}</div>
      <div class="t-row"><span>추천률</span><span>${pct(r.value)}</span></div>
      <div class="t-row"><span>리뷰 수</span><span>${fmt(r.n)}건</span></div>`);
    svg.append(g);
  });

  svg.append(el("line", { class: "baseline", x1: ML, x2: ML + iw, y1: MT + ih, y2: MT + ih }));
  host.replaceChildren(svg);
}

function drawLengthChart(pos, neg) {
  const rows = [
    { label: "추천", med: median(pos.map((r) => r.review_len)), n: pos.length, color: "var(--pos)" },
    { label: "비추천", med: median(neg.map((r) => r.review_len)), n: neg.length, color: "var(--neg)" },
  ];
  state.lengthRows = rows;
  const max = Math.max(...rows.map((r) => r.med), 1) * 1.15; // 막대가 천장에 닿지 않게 여유

  const W = 560, H = 230, ML = 52, MR = 14, MT = 20, MB = 40;
  const iw = W - ML - MR, ih = H - MT - MB;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "추천 리뷰와 비추천 리뷰의 길이 중앙값 비교" });

  for (let t = 0; t <= 4; t++) {
    const y = MT + ih - (ih * t) / 4;
    svg.append(el("line", { class: "gridline", x1: ML, x2: ML + iw, y1: y, y2: y }));
    svg.append(el("text", { class: "tick", x: ML - 8, y: y + 3.5, "text-anchor": "end" },
                fmt(Math.round((max * t) / 4))));
  }

  const bw = iw / rows.length;
  rows.forEach((r, i) => {
    const cx = ML + bw * i + bw / 2;
    const h = Math.max(2, ih * (r.med / max));
    const y = MT + ih - h;
    const g = el("g", { tabindex: "0" });
    g.append(el("rect", { x: cx - 44, y, width: 88, height: h, rx: 4, fill: r.color }));
    g.append(el("text", { class: "mark-label", x: cx, y: y - 7, "text-anchor": "middle" }, `${fmt(Math.round(r.med))}자`));
    svg.append(el("text", { class: "tick", x: cx, y: MT + ih + 18, "text-anchor": "middle" }, r.label));
    g.append(el("rect", { class: "hit", x: cx - bw / 2, y: MT, width: bw, height: ih }));
    bindTip(g, `<div class="t-title">${r.label} 리뷰</div>
      <div class="t-row"><span>길이 중앙값</span><span>${fmt(Math.round(r.med))}자</span></div>
      <div class="t-row"><span>리뷰 수</span><span>${fmt(r.n)}건</span></div>`);
    svg.append(g);
  });

  svg.append(el("line", { class: "baseline", x1: ML, x2: ML + iw, y1: MT + ih, y2: MT + ih }));
  $("#chart-length").replaceChildren(svg);
}

/** 스팀 리뷰의 BBCode 태그를 걷어낸다. [b], [/spoiler], [url=...] 같은 것들. */
const stripBB = (s) => String(s || "").replace(/\[\/?[a-z][^\]]{0,80}\]/gi, " ");

// 형태소 분석기 없이 쓰는 간이 조사 제거 목록. 긴 것부터 지운다.
const JOSA = ["으로부터", "에게서", "이라고", "으로써", "으로서", "에서는", "에게는", "라고는",
              "까지", "부터", "에서", "에게", "으로", "이나", "이란", "라는", "처럼", "보다",
              "마다", "조차", "밖에", "한테", "이랑", "이며", "라도",
              "은", "는", "이", "가", "을", "를", "에", "의", "도", "로", "와", "과", "만", "랑"];

/** '메인이', '메인을' 을 '메인' 하나로 묶는다. 어간이 2자 미만이 되면 그대로 둔다. */
function stem(word) {
  if (!/[가-힣]$/.test(word)) return word; // 한글로 끝나지 않으면 손대지 않는다
  for (const j of JOSA) {
    if (word.length > j.length + 1 && word.endsWith(j)) return word.slice(0, -j.length);
  }
  return word;
}

function tokenize(text) {
  return stripBB(text)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{Script=Hangul}\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((w) => stem(w.trim().toLowerCase()))
    .filter((w) => w.length >= 2 && w.length <= 12 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function drawWordChart() {
  const want = state.wordMode === "pos";
  const subset = state.reviews.filter((r) => r.voted_up === want);
  const count = new Map(), docs = new Map();
  for (const r of subset) {
    const seen = new Set();
    for (const w of tokenize(r.review)) {
      count.set(w, (count.get(w) || 0) + 1);
      if (!seen.has(w)) { docs.set(w, (docs.get(w) || 0) + 1); seen.add(w); }
    }
  }
  const rows = [...count.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([w, n]) => ({ label: w, value: n, docs: docs.get(w) || 0 }));
  state.wordRows = rows;

  const host = $("#chart-words");
  if (!rows.length) {
    host.replaceChildren(Object.assign(document.createElement("p"),
      { className: "sub", textContent: "해당 조건의 리뷰가 없습니다." }));
    return;
  }
  hbar(host, rows, { color: want ? "var(--pos)" : "var(--neg)" });
  $("#words-sub").textContent = `${want ? "추천" : "비추천"} 리뷰 ${fmt(subset.length)}건에서 추출`;
}

/* ═══════════════════════════════════════════════════════
   표
   ═══════════════════════════════════════════════════════ */

function renderTable(R) {
  const rows = [...R].sort((a, b) => b.votes_up - a.votes_up).slice(0, 50);
  $("#table-host").innerHTML = `
    <p class="sub">유용성 투표가 많은 순 상위 ${rows.length}건입니다. 전체 원자료는 위에서 내려받으세요.</p>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>평가</th><th class="num">유용해요</th><th class="num">플레이(h)</th>
        <th class="num">길이</th><th class="num">작성일</th><th>내용</th>
      </tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><span class="pill ${r.voted_up ? "pos" : "neg"}">${r.voted_up ? "추천" : "비추천"}</span></td>
        <td class="num">${fmt(r.votes_up)}</td>
        <td class="num">${((r.author.playtime_at_review || r.author.playtime_forever) / 60).toFixed(1)}</td>
        <td class="num">${fmt(r.review_len)}</td>
        <td class="num">${r.timestamp_created ? new Date(r.timestamp_created * 1000).toISOString().slice(0, 10) : "-"}</td>
        <td class="txt">${esc(stripBB(r.review).replace(/\s+/g, " ").trim().slice(0, 220))}${r.review.length > 220 ? "…" : ""}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

/* ═══════════════════════════════════════════════════════
   UI 보조
   ═══════════════════════════════════════════════════════ */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function notice(kind, msg, title = "") {
  $("#notice").className = `notice ${kind}`;
  $("#notice").innerHTML = `${title ? `<b>${esc(title)}</b>` : ""}<span>${esc(msg)}</span>`;
  $("#notice").hidden = false;
}

function setBusy(on, label) {
  $$("button.act").forEach((b) => {
    if (on) { b.dataset.wasDisabled = b.disabled ? "1" : ""; b.disabled = true; }
    else if (!b.classList.contains("dl") || state.reviews.length) { b.disabled = b.dataset.wasDisabled === "1"; }
  });
  if (on && label) progressText(label);
  if (!on) $("#progress").classList.remove("on");
}

function progress(ratio, text) {
  $("#progress").classList.add("on");
  $("#progress-fill").style.width = `${(ratio * 100).toFixed(1)}%`;
  progressText(text);
}
const progressText = (t) => { $("#progress-text").textContent = t; };

/* ═══════════════════════════════════════════════════════
   초기화
   ═══════════════════════════════════════════════════════ */

function initTheme() {
  // ?theme=dark 로도 고정할 수 있다(수업용 링크, 빔프로젝터 화면 등).
  const forced = new URLSearchParams(location.search).get("theme");
  const saved = (forced === "dark" || forced === "light") ? forced : localStorage.getItem("cb-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  $("#theme").addEventListener("click", () => {
    const now = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = now === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cb-theme", next);
    if (state.reviews.length) analyze(); // 차트 색을 새 모드로 다시 그린다
  });
}

function init() {
  initTheme();

  if (!hasProxy()) {
    notice("warn",
      "실시간 수집은 프록시를 배포한 뒤 열립니다(worker/README.md 참고). 지금은 아래 샘플 데이터와 파일 업로드로 모든 분석 기능을 쓸 수 있습니다.",
      "샘플 모드");
    $("#btn-precheck").disabled = true;
  }

  $("#btn-precheck").addEventListener("click", runPrecheck);
  $("#btn-collect").addEventListener("click", collect);
  $("#dl-json").addEventListener("click", () => download("json"));
  $("#dl-csv").addEventListener("click", () => download("csv"));

  $$(".presets button").forEach((b) => b.addEventListener("click", () => {
    $("#appid").value = b.dataset.appid;
    if (hasProxy()) runPrecheck();
  }));

  $("#sample").addEventListener("change", (e) => { if (e.target.value) loadSample(e.target.value); });
  $("#upload").addEventListener("change", (e) => { if (e.target.files[0]) loadUpload(e.target.files[0]); });

  $$("#words-toggle button").forEach((b) => b.addEventListener("click", () => {
    state.wordMode = b.dataset.mode;
    $$("#words-toggle button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawWordChart();
  }));

  // day_range 는 유용성순일 때만 쓴다
  const syncDayRange = () => { $("#field-day-range").hidden = $("#sort").value !== "all"; };
  $("#sort").addEventListener("change", syncDayRange);
  syncDayRange();

  // 주소로 바로 열기 — 수업에서 링크 하나로 같은 화면을 띄울 때 쓴다.
  //   ?sample=cyberpunk-2077.json  ?appid=730
  const q = new URLSearchParams(location.search);
  if (q.get("appid")) $("#appid").value = q.get("appid").replace(/\D/g, "");
  const sample = q.get("sample");
  if (sample && [...$("#sample").options].some((o) => o.value === sample)) {
    $("#sample").value = sample;
    loadSample(sample);
  }
}

document.addEventListener("DOMContentLoaded", init);

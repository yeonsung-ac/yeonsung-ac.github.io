/* 소비자행동론 - 스팀 리뷰 수집기
 *
 * PROXY_BASE 를 채우면 앱 번호로 실시간 조회·수집이 열린다.
 * 비워 두면 '스팀에서 직접 열기 → 붙여넣기' 방식으로 쓸 수 있다.
 * 프록시 배포 방법은 worker/README.md 참고.
 */
const CONFIG = {
  PROXY_BASE: "",
  PAGE_SIZE: 100,
  MAX_PAGES: 60, // 안전장치: 최대 6,000건
};

const state = { reviews: [], meta: null, compare: [], nextCursor: null, pasteRounds: 0, lastSummary: null };

// 프록시가 없으면 게임 이름을 조회할 수 없어서, 자주 쓰는 것만 표로 갖고 있는다.
const KNOWN_NAMES = {
  "1091500": "Cyberpunk 2077", "730": "Counter-Strike 2", "578080": "PUBG: BATTLEGROUNDS",
  "1245620": "ELDEN RING", "292030": "The Witcher 3", "271590": "Grand Theft Auto V",
  "1172470": "Apex Legends", "413150": "Stardew Valley",
};
const gameName = (appid, fetched) => fetched || KNOWN_NAMES[String(appid)] || `앱 ${appid}`;

const hasProxy = () => Boolean(CONFIG.PROXY_BASE);

/* ── 스팀 질의 ─────────────────────────────────────────── */

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

function reviewParams(s, cursor, perPage = CONFIG.PAGE_SIZE) {
  const p = {
    language: s.language,
    review_type: s.review_type,
    purchase_type: s.purchase_type,
    filter: s.filter,
    num_per_page: perPage,
    cursor: cursor || "*",
  };
  if (s.filter === "all" && s.day_range) p.day_range = s.day_range;
  return p;
}

/** 프록시 없이 새 탭에서 직접 열 수 있는 스팀 주소 */
function steamUrl(s, perPage = 100, cursor = "*") {
  const u = new URL(`https://store.steampowered.com/appreviews/${s.appid}`);
  u.searchParams.set("json", "1");
  for (const [k, v] of Object.entries(reviewParams(s, cursor, perPage))) u.searchParams.set(k, v);
  return u.toString();
}

async function api(path, params = {}) {
  if (!hasProxy()) throw new Error("프록시가 설정되지 않았습니다.");
  const url = new URL(CONFIG.PROXY_BASE.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  // 수업용 열쇠(=잠금 비밀번호). 프록시가 이 값을 확인한다.
  const key = typeof gateSecret === "function" ? gateSecret() : "";
  if (key) url.searchParams.set("key", key);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* JSON 이 아닐 수 있다 */ }
    throw new Error(`요청 실패 (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
  }
  return res.json();
}

/* ── 1단계: 리뷰 현황 미리보기 ─────────────────────────── */

async function runPrecheck() {
  const s = readSettings();
  if (!/^\d+$/.test(s.appid)) return notice("err", "앱 번호를 숫자로 입력하세요.", "입력 오류");
  if (!hasProxy()) {
    return notice("warn", "프록시가 없어 자동 조회를 할 수 없습니다. 아래 '스팀에서 직접 열기'로 JSON 을 연 뒤 붙여넣으면 같은 현황을 볼 수 있습니다.", "자동 조회 불가");
  }
  setBusy(true, "현황을 확인하는 중…");
  try {
    // 선택한 언어 기준과 전체 언어 기준을 함께 조회해 '한국어 비중'을 보여준다.
    const [sel, all, det] = await Promise.all([
      api(`/appreviews/${s.appid}`, reviewParams(s, "*", 1)),
      api(`/appreviews/${s.appid}`, { ...reviewParams(s, "*", 1), language: "all", review_type: "all" }),
      api("/appdetails", { appids: s.appid }).catch(() => null),
    ]);
    if (sel?.success !== 1) throw new Error("스팀이 해당 앱 번호의 리뷰를 반환하지 않았습니다.");
    showPrecheck({
      name: gameName(s.appid, det?.[s.appid]?.data?.name),
      settings: s, sel: sel.query_summary || {}, all: all?.query_summary || {},
    });
  } catch (err) {
    $("#precheck").classList.remove("on");
    $("#btn-collect").disabled = true;
    notice("err", err.message, "오류");
  } finally {
    setBusy(false);
  }
}

/** 붙여넣은 JSON 으로도 같은 현황을 만든다(프록시 없을 때). */
function precheckFromJson(raw) {
  const s = readSettings();
  const q = raw.query_summary || {};
  if (!q.total_reviews) throw new Error("query_summary 가 없습니다. 스팀 응답 전체를 붙여넣었는지 확인하세요.");
  const reviews = raw.reviews || [];
  showPrecheck({ name: gameName(s.appid), settings: s, sel: q, all: {}, pasted: reviews.length });
  return reviews;
}

function showPrecheck(d) {
  const pos = d.sel.total_positive ?? 0;
  const neg = d.sel.total_negative ?? 0;
  const total = d.sel.total_reviews ?? (pos + neg);
  if (!total) {
    $("#precheck").classList.remove("on");
    return notice("warn", "이 조건에 맞는 리뷰가 없습니다. 언어나 리뷰 유형을 바꿔 보세요.", "표본 없음");
  }
  const posRate = pos / total;
  const allTotal = d.all.total_reviews || 0;
  const share = allTotal ? total / allTotal : null;
  const willFetch = Math.min(d.settings.limit, total);
  const pages = Math.ceil(willFetch / CONFIG.PAGE_SIZE);

  const verdict = posRate >= 0.8 ? ["매우 긍정적", "var(--pos)"]
    : posRate >= 0.7 ? ["대체로 긍정적", "var(--pos)"]
    : posRate >= 0.4 ? ["평가가 갈림", "var(--warn)"]
    : ["부정적", "var(--neg)"];

  // 수업용 판단 도우미: 표본이 너무 적거나 한쪽으로 쏠리면 알려 준다.
  const tips = [];
  if (d.pasted && d.pasted < 200) tips.push(`지금까지 ${fmt(d.pasted)}건입니다. 분석에는 200건 이상을 권합니다. 다음 묶음을 이어 받으세요.`);
  if (total < 200) tips.push("리뷰가 200건 미만입니다. 구간별로 나누면 표본이 부족해집니다. 다른 게임도 함께 보세요.");
  if (posRate > 0.95 || posRate < 0.05) tips.push("한쪽으로 크게 쏠려 있어 비교 분석이 단조로울 수 있습니다.");
  if (posRate >= 0.4 && posRate <= 0.7) tips.push("평가가 갈리는 게임입니다. 추천·비추천 비교 과제에 적합합니다.");
  if (share !== null && share < 0.05) tips.push(`한국어 리뷰가 전체의 ${pct(share)} 뿐입니다. 전체 언어로 넓히는 것도 방법입니다.`);

  $("#precheck").innerHTML = `
    <div class="precheck-head">
      <h3>${esc(d.name)}</h3>
      <span class="appid">앱 번호 ${esc(d.settings.appid)}</span>
      <span class="verdict" style="background:color-mix(in srgb, ${verdict[1]} 16%, transparent);color:${verdict[1]}">${verdict[0]}</span>
      ${d.sel.review_score_desc ? `<span class="appid">스팀 평가: ${esc(d.sel.review_score_desc)}</span>` : ""}
    </div>
    <div class="ratio-bar" role="img" aria-label="추천 ${pct(posRate)}, 비추천 ${pct(1 - posRate)}">
      <i style="width:${(posRate * 100).toFixed(2)}%;background:var(--pos)"></i>
      <i style="width:${((1 - posRate) * 100).toFixed(2)}%;background:var(--neg)"></i>
    </div>
    <p class="ratio-legend">
      <span><i class="swatch" style="background:var(--pos)"></i>추천 ${fmt(pos)}건 · ${pct(posRate)}</span>
      <span><i class="swatch" style="background:var(--neg)"></i>비추천 ${fmt(neg)}건 · ${pct(1 - posRate)}</span>
    </p>
    <div class="tiles">
      <div class="tile"><p class="k">이 조건의 리뷰</p><p class="v">${fmt(total)}</p><p class="s">${langLabel(d.settings.language)} · ${typeLabel(d.settings.review_type)}</p></div>
      <div class="tile"><p class="k">전체 언어 리뷰</p><p class="v">${allTotal ? fmt(allTotal) : "-"}</p><p class="s">${share !== null ? `${langLabel(d.settings.language)} 비중 ${pct(share)}` : "조회하지 않음"}</p></div>
      ${d.pasted
        ? `<div class="tile"><p class="k">붙여넣어 확보한 양</p><p class="v">${fmt(d.pasted)}</p><p class="s">직접 열기 방식은 한 번에 100건까지</p></div>
           <div class="tile"><p class="k">전체 대비 표본</p><p class="v">${pct(d.pasted / total, 2)}</p><p class="s">${sortLabel(d.settings.filter)} 기준 일부</p></div>`
        : `<div class="tile"><p class="k">이번에 가져올 양</p><p class="v">${fmt(willFetch)}</p><p class="s">${pages}회 요청 · 약 ${Math.max(1, Math.round(pages * 0.9))}초</p></div>
           <div class="tile"><p class="k">전체 대비 표본</p><p class="v">${pct(willFetch / total)}</p><p class="s">${willFetch < total ? `${sortLabel(d.settings.filter)} 기준 일부` : "전수 수집"}</p></div>`}
    </div>
    ${tips.length ? `<div class="notice info" style="margin-top:16px"><b>고를 때 참고</b><span>${tips.map(esc).join(" ")}</span></div>` : ""}
  `;
  $("#precheck").classList.add("on");
  $("#btn-collect").disabled = !hasProxy();
  addToCompare({ name: d.name, appid: d.settings.appid, total, pos, neg, posRate,
                 lang: d.settings.language, allTotal });
  notice("info", `${esc(d.name)} — 조건에 맞는 리뷰 ${fmt(total)}건을 찾았습니다.`, "현황 확인 완료");
}

/* ── 게임 비교 목록 ────────────────────────────────────── */

function addToCompare(row) {
  state.compare = [row, ...state.compare.filter((r) => r.appid !== row.appid)].slice(0, 8);
  renderCompare();
}

function renderCompare() {
  const host = $("#compare");
  if (!state.compare.length) { host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `
    <h2>확인한 게임 비교</h2>
    <p class="hint">현황을 확인한 게임이 쌓입니다. 어느 게임으로 과제를 할지 고르는 데 쓰세요.</p>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>게임</th><th class="num">앱 번호</th><th>언어</th>
        <th class="num">리뷰 수</th><th class="num">추천률</th><th>분포</th><th></th>
      </tr></thead>
      <tbody>${state.compare.map((r) => `<tr>
        <td>${esc(r.name)}</td>
        <td class="num">${esc(r.appid)}</td>
        <td>${langLabel(r.lang)}</td>
        <td class="num">${fmt(r.total)}</td>
        <td class="num" style="color:${r.posRate >= 0.7 ? "var(--pos)" : r.posRate < 0.4 ? "var(--neg)" : "var(--ink)"}">${pct(r.posRate)}</td>
        <td><span class="ratio-bar" style="width:120px;display:flex">
          <i style="width:${(r.posRate * 100).toFixed(1)}%;background:var(--pos)"></i>
          <i style="width:${((1 - r.posRate) * 100).toFixed(1)}%;background:var(--neg)"></i></span></td>
        <td><button class="linklike" type="button" data-pick="${esc(r.appid)}">이 게임 선택</button></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  $$("#compare button[data-pick]").forEach((b) => b.addEventListener("click", () => {
    $("#appid").value = b.dataset.pick;
    if (hasProxy()) runPrecheck();
    $("#appid").scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}

/* ── 2단계: 수집 ───────────────────────────────────────── */

async function collect() {
  const s = readSettings();
  const collected = [];
  const seen = new Set();
  let cursor = "*";

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
      progress(Math.min(collected.length / s.limit, 1), `${fmt(collected.length)} / ${fmt(s.limit)}건 수집`);
      const next = data.cursor;
      if (!next || next === cursor || batch.length < CONFIG.PAGE_SIZE) break;
      cursor = next;
    }
    if (!collected.length) throw new Error("수집된 리뷰가 없습니다.");
    finishCollection(collected.slice(0, s.limit).map(normalize), s, "실시간 수집");
  } catch (err) {
    notice("err", err.message, "수집 실패");
  } finally {
    setBusy(false);
  }
}

function finishCollection(reviews, s, source) {
  state.reviews = reviews;
  state.meta = {
    name: $(".precheck-head h3")?.textContent || gameName(s.appid),
    appid: s.appid, settings: s, source,
    collected_at: new Date().toISOString().slice(0, 10),
  };
  progress(1, `${fmt(reviews.length)}건 수집 완료`);
  $$(".dl").forEach((b) => (b.disabled = false));
  renderSummary();
  notice("info", `${fmt(reviews.length)}건을 확보했습니다. 아래에서 파일로 내려받으세요.`, "수집 완료");
  $("#summary").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSummary() {
  const R = state.reviews;
  const pos = R.filter((r) => r.voted_up).length;
  const dates = R.map((r) => r.timestamp_created).filter(Boolean).sort((a, b) => a - b);
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const bytes = new Blob([JSON.stringify(R)]).size;

  $("#summary").hidden = false;
  $("#summary-tiles").innerHTML = `
    <div class="tile"><p class="k">확보한 리뷰</p><p class="v">${fmt(R.length)}</p><p class="s">${esc(state.meta.source)}</p></div>
    <div class="tile"><p class="k">추천 / 비추천</p><p class="v">${fmt(pos)} <span style="font-size:.9rem;color:var(--muted)">/ ${fmt(R.length - pos)}</span></p><p class="s">추천률 ${pct(pos / R.length)}</p></div>
    <div class="tile"><p class="k">작성 기간</p><p class="v" style="font-size:1.05rem">${dates.length ? `${day(dates[0])} ~ ${day(dates.at(-1))}` : "-"}</p><p class="s">${dates.length ? `${Math.round((dates.at(-1) - dates[0]) / 86400)}일치` : ""}</p></div>
    <div class="tile"><p class="k">글자 없는 리뷰</p><p class="v">${fmt(R.filter((r) => r.review_len === 0).length)}</p><p class="s">전체 자료 크기 약 ${Math.round(bytes / 1024)} KB</p></div>
  `;
  $("#summary-label").textContent =
    `${state.meta.name} · ${langLabel(state.meta.settings.language)} · ${sortLabel(state.meta.settings.filter)} · ${state.meta.collected_at} 수집`;
}

/* ── 3단계: 내려받기 ───────────────────────────────────── */

function download(format) {
  if (!state.reviews.length) return;
  const base = `steam-reviews-${state.meta?.appid || "data"}-${state.meta?.collected_at || "export"}`;
  if (format === "json") {
    saveBlob(JSON.stringify({ ...state.meta, sample_size: state.reviews.length, reviews: state.reviews }, null, 2),
             `${base}.json`, "application/json");
    return;
  }
  const cols = ["voted_up", "votes_up", "votes_funny", "weighted_vote_score", "comment_count",
                "timestamp_created", "created_date", "steam_purchase", "received_for_free",
                "playtime_forever_h", "playtime_at_review_h", "num_games_owned", "num_reviews",
                "review_len", "review"];
  const rows = state.reviews.map((r) => [
    r.voted_up, r.votes_up, r.votes_funny, r.weighted_vote_score, r.comment_count,
    r.timestamp_created, r.timestamp_created ? new Date(r.timestamp_created * 1000).toISOString().slice(0, 10) : "",
    r.steam_purchase, r.received_for_free,
    (r.author.playtime_forever / 60).toFixed(1), (r.author.playtime_at_review / 60).toFixed(1),
    r.author.num_games_owned, r.author.num_reviews, r.review_len, r.review,
  ]);
  const csv = [cols, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  saveBlob("﻿" + csv, `${base}.csv`, "text/csv;charset=utf-8"); // 엑셀 한글용 BOM
}

const csvCell = (v) => {
  const s = String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s}"` : s;
};

/* ── 붙여넣기 경로 ─────────────────────────────────────── */

function analyzePasted() {
  const raw = $("#paste-json").value.trim();
  if (!raw) return notice("warn", "붙여넣은 내용이 없습니다.", "입력 없음");
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return notice("err", "JSON 을 읽지 못했습니다. 스팀 화면 전체를 복사했는지 확인하세요.", "형식 오류"); }
  try {
    const s = readSettings();
    const fresh = adoptReviews(parsed.reviews || []);
    if (!fresh.length) return notice("warn", "리뷰 본문이 들어 있지 않습니다. 스팀 화면 전체를 복사했는지 확인하세요.", "리뷰 없음");

    // 이미 받은 것과 합치되 같은 리뷰는 한 번만 센다.
    const seen = new Set(state.reviews.map((r) => r.recommendationid).filter(Boolean));
    const added = fresh.filter((r) => !r.recommendationid || !seen.has(r.recommendationid));
    const merged = [...state.reviews, ...added];
    state.pasteRounds += 1;
    state.nextCursor = parsed.cursor || null;

    // 스팀은 첫 응답(cursor=*)에만 전체 집계를 준다. 그 값을 기억해 두고 계속 쓴다.
    const q = parsed.query_summary || {};
    if (q.total_reviews) state.lastSummary = q;
    if (state.lastSummary) {
      showPrecheck({ name: gameName(s.appid), settings: s, sel: state.lastSummary,
                     all: {}, pasted: merged.length });
    }
    finishCollection(merged, s, `붙여넣기 ${state.pasteRounds}회`);
    renderNextStep(s, added.length, fresh.length);
  } catch (err) {
    notice("err", err.message, "오류");
  }
}

/** 다음 100건을 이어서 받을 수 있게 안내한다. */
function renderNextStep(s, added, fresh) {
  const host = $("#paste-next");
  if (!state.nextCursor || added === 0) {
    host.innerHTML = added === 0
      ? `<p class="hint">새로 추가된 리뷰가 없습니다. 마지막 묶음까지 다 받았거나 같은 내용을 다시 붙여넣은 것 같습니다.</p>`
      : `<p class="hint">스팀이 다음 묶음을 주지 않았습니다. 여기까지가 이 조건의 마지막입니다.</p>`;
    return;
  }
  host.innerHTML = `
    <div class="notice info" style="margin-top:14px">
      <b>${fmt(added)}건 추가</b>
      <span>지금까지 <b>${fmt(state.reviews.length)}건</b>을 모았습니다.
        더 필요하면 아래 버튼으로 다음 묶음을 열어 같은 자리에 붙여넣으세요.</span>
    </div>
    <div class="field-row" style="margin-top:12px">
      <button id="btn-next-batch" class="act" type="button">다음 100건 열기 ↗</button>
      <button id="btn-reset-paste" class="act ghost" type="button">처음부터 다시</button>
    </div>`;
  $("#btn-next-batch").addEventListener("click", () => {
    window.open(steamUrl(s, 100, state.nextCursor), "_blank", "noopener");
    $("#paste-json").value = "";
    $("#paste-json").focus();
  });
  $("#btn-reset-paste").addEventListener("click", () => {
    state.reviews = []; state.nextCursor = null; state.pasteRounds = 0; state.lastSummary = null;
    $("#paste-json").value = "";
    host.innerHTML = "";
    $("#summary").hidden = true;
    notice("info", "모아 둔 자료를 비웠습니다. 다시 시작하세요.", "초기화");
  });
}

/* ── UI 보조 ───────────────────────────────────────────── */

function setBusy(on, label) {
  $$("button.act").forEach((b) => {
    if (on) { b.dataset.wasDisabled = b.disabled ? "1" : ""; b.disabled = true; }
    else { b.disabled = b.dataset.wasDisabled === "1"; }
  });
  if (on && label) { $("#progress").classList.add("on"); $("#progress-text").textContent = label; }
  if (!on && !state.reviews.length) $("#progress").classList.remove("on");
}

function progress(ratio, text) {
  $("#progress").classList.add("on");
  $("#progress-fill").style.width = `${(ratio * 100).toFixed(1)}%`;
  $("#progress-text").textContent = text;
}

function init() {
  initTheme();

  if (!hasProxy()) {
    // 설치·가입 없이 쓰는 것이 기본이다. 자동 조회 버튼은 아예 감춘다.
    for (const sel of ["#btn-precheck", "#btn-collect", "#field-limit"]) {
      const n = $(sel); if (n) n.hidden = true;
    }
  } else {
    for (const sel of ["#btn-precheck", "#btn-collect", "#field-limit"]) {
      const n = $(sel); if (n) n.hidden = false;
    }
  }

  $("#btn-precheck").addEventListener("click", runPrecheck);
  $("#btn-collect").addEventListener("click", collect);
  $("#btn-paste").addEventListener("click", analyzePasted);
  $("#dl-json").addEventListener("click", () => download("json"));
  $("#dl-csv").addEventListener("click", () => download("csv"));

  $("#btn-open-steam").addEventListener("click", () => {
    const s = readSettings();
    if (!/^\d+$/.test(s.appid)) return notice("err", "앱 번호를 숫자로 입력하세요.", "입력 오류");
    window.open(steamUrl(s, 100), "_blank", "noopener");
  });

  $$(".presets button").forEach((b) => b.addEventListener("click", () => {
    $("#appid").value = b.dataset.appid;
    if (hasProxy()) runPrecheck();
  }));

  const syncDayRange = () => { $("#field-day-range").hidden = $("#sort").value !== "all"; };
  $("#sort").addEventListener("change", syncDayRange);
  syncDayRange();

  const q = new URLSearchParams(location.search);
  if (q.get("appid")) {
    $("#appid").value = q.get("appid").replace(/\D/g, "");
    if (hasProxy()) runPrecheck();
  }
}

document.addEventListener("DOMContentLoaded", init);

/* 소비자행동론 - 공통 유틸 (수집 페이지와 분석 페이지가 함께 쓴다) */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
const pct = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** 스팀 원본 리뷰에서 분석에 쓰는 필드만 남긴다(개인 식별정보 제외). */
function normalize(r) {
  const a = r.author || {};
  const text = (r.review || "").trim();
  return {
    recommendationid: r.recommendationid || "",
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

/** 이 도구가 내려준 파일이면 그대로, 스팀 원본이면 정리해서 쓴다. */
const adoptReviews = (list) =>
  list.map((r) => (r.author && "playtime_forever" in r.author && "review_len" in r ? r : normalize(r)));

function saveBlob(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function notice(kind, msg, title = "") {
  const box = $("#notice");
  if (!box) return;
  box.className = `notice ${kind}`;
  box.innerHTML = `${title ? `<b>${esc(title)}</b>` : ""}<span>${esc(msg)}</span>`;
  box.hidden = false;
}

function initTheme() {
  const forced = new URLSearchParams(location.search).get("theme");
  const saved = (forced === "dark" || forced === "light") ? forced : localStorage.getItem("cb-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  $("#theme")?.addEventListener("click", () => {
    const now = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = now === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cb-theme", next);
    document.dispatchEvent(new CustomEvent("themechange"));
  });
}

const langLabel = (v) => ({ koreana: "한국어", english: "영어", all: "전체 언어" }[v] || v);
const typeLabel = (v) => ({ all: "추천+비추천", positive: "추천만", negative: "비추천만" }[v] || v);
const sortLabel = (v) => ({ recent: "최신순", updated: "수정순", all: "유용성순" }[v] || v);

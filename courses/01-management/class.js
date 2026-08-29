/**
 * 경영학원론 수업 도우미
 *
 * 학생은 가입하지 않는다. QR 을 찍고 성명·학번·암호만 넣으면 들어온다.
 * 다만 서버가 "누가 보냈는지" 구분하지 못하면 남의 답을 고칠 수 있으므로,
 * 뒤에서 익명 로그인을 걸어 각자에게 고유 번호(uid)를 준다.
 * 성명·학번은 그 번호에 붙는 이름표다.
 *
 * 교수 기능(문제 내기·결과 보기)은 암호가 아니라 구글 로그인으로 가른다.
 * 입장 암호는 학생도 아는 값이라 그것으로 교수를 가릴 수 없기 때문이다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { isProfessorUser } from "../../professor.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const QUIZZES = "mgmt_quizzes";
const ANSWERS = "mgmt_answers";
const PASS = "0909";                 // 문패다. 소스에 드러나므로 성적의 자물쇠로 쓰지 않는다.
const KEY = "mgmt-who";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = {
  me: null,          // { name, sid }
  uid: null,
  user: null,
  isProfessor: false,
  quizzes: [],
  mine: {},          // quizId -> 내 답안
  all: [],           // 교수만 채운다
  view: "room",
  solving: null,
  making: false,
};

/* ── 작은 도우미 ──────────────────────────── */
let toastTimer = null;
function toast(msg, bad = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast on" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast" + (bad ? " bad" : ""); }, 2200);
}

function setNet(cls, msg) {
  $("net-dot").className = "dot" + (cls ? " " + cls : "");
  $("net-msg").textContent = msg;
}

const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
const cleanSid = (s) => String(s ?? "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 20);

/* ── 문패 ─────────────────────────────────── */
function loadWho() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.name && d.sid ? { name: d.name, sid: d.sid } : null;
  } catch { return null; }
}
function saveWho(who) {
  try { localStorage.setItem(KEY, JSON.stringify(who)); } catch { /* 사생활 모드면 그만 */ }
}

$("gate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = cleanName($("g-name").value);
  const sid = cleanSid($("g-sid").value);
  const pw = $("g-pw").value.trim();
  const err = $("gate-error");

  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (name.length < 2) return fail("성명을 두 글자 이상 넣어 주세요.");
  if (sid.length < 4) return fail("학번을 확인해 주세요.");
  if (pw !== PASS) return fail("입장 암호가 다릅니다. 수업 시간에 알려 드린 숫자입니다.");

  err.hidden = true;
  state.me = { name, sid };
  saveWho(state.me);
  enterRoom();
});

$("who-out").addEventListener("click", () => {
  if (!confirm("나가면 다음에 이름과 학번을 다시 넣어야 합니다.")) return;
  try { localStorage.removeItem(KEY); } catch { /* 그만 */ }
  state.me = null;
  showGate();
});

function showGate() {
  $("gate").hidden = false;
  $("room").hidden = true;
  $("solve").hidden = true;
  $("g-pw").value = "";
}

function enterRoom() {
  $("gate").hidden = true;
  $("room").hidden = false;
  $("who-name").textContent = state.me.name;
  $("who-sid").textContent = state.me.sid;
  render();
}

/* ── QR ───────────────────────────────────── */
$("qr-big").addEventListener("click", () => { $("qr-full").hidden = false; });
$("qr-x").addEventListener("click", () => { $("qr-full").hidden = true; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("qr-full").hidden) $("qr-full").hidden = true;
});
$("qr-hide").addEventListener("click", () => {
  $("qr-band").classList.add("folded");
  toast("QR 을 접었습니다. 새로고침하면 다시 보입니다.");
});
$("qr-copy").addEventListener("click", async () => {
  const url = "https://yeonsung-ac.github.io/courses/01-management/";
  try {
    await navigator.clipboard.writeText(url);
    toast("주소를 복사했습니다");
  } catch {
    toast("복사가 막혀 있습니다. 주소창에서 직접 복사해 주세요.", true);
  }
});

/* ── 로그인 ───────────────────────────────── */
$("p-signin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    toast(e.code === "auth/popup-closed-by-user" ? "로그인을 닫으셨습니다" : "로그인하지 못했습니다", true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // 아무도 아닌 상태. 익명으로라도 들어가야 제출이 가능하다.
    try {
      await signInAnonymously(auth);
    } catch (e) {
      setNet("err", "연결하지 못했습니다. Firebase 익명 로그인이 켜져 있는지 확인해 주세요.");
    }
    return;
  }
  state.user = user;
  state.uid = user.uid;
  state.isProfessor = isProfessorUser(user);
  setNet("on", state.isProfessor ? "교수로 연결됨" : "연결됨");
  $("prof").hidden = !state.isProfessor;
  $("prof-login").hidden = state.isProfessor;
  if (state.isProfessor) $("prof-who").textContent = user.email;
  watchQuizzes();
  watchAnswers();
  render();
});

/* ── 자료 지켜보기 ────────────────────────── */
let stopQuizzes = null;
let stopAnswers = null;

function watchQuizzes() {
  if (stopQuizzes) return;
  stopQuizzes = onSnapshot(
    query(collection(db, QUIZZES), orderBy("week", "asc")),
    (snap) => {
      state.quizzes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    () => setNet("err", "문제를 불러오지 못했습니다")
  );
}

function watchAnswers() {
  if (stopAnswers) stopAnswers();
  // 학생은 규칙상 자기 답만 읽힌다. 교수는 전부 읽힌다. 질의는 같다.
  stopAnswers = onSnapshot(
    collection(db, ANSWERS),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.all = rows;
      state.mine = {};
      rows.forEach((r) => { if (r.uid === state.uid) state.mine[r.quizId] = r; });
      render();
    },
    () => { /* 학생이 전체를 못 읽는 것은 정상이다 */ }
  );
}

/* ── 채점 ─────────────────────────────────── */
function grade(quiz, picks) {
  let right = 0;
  let gradable = 0;
  quiz.questions.forEach((q, i) => {
    if (q.type !== "choice") return;
    gradable += 1;
    if (Number(picks[i]) === Number(q.answer)) right += 1;
  });
  return { right, gradable };
}

/* ── 목록 그리기 ──────────────────────────── */
function statusOf(q) {
  if (q.state === "open") return q.mode === "live" ? "live" : "open";
  return "shut";
}

function render() {
  if (!state.me) { showGate(); return; }
  if (state.view === "solve") return;

  $("gate").hidden = true;
  $("room").hidden = false;
  $("solve").hidden = true;

  const open = state.quizzes.filter((q) => q.state === "open");
  const liveOne = open.find((q) => q.mode === "live" && !state.mine[q.id]);

  const live = $("live");
  if (liveOne) {
    live.hidden = false;
    $("live-title").textContent = liveOne.title;
    $("live-sub").textContent = `${liveOne.week}주차 · ${liveOne.questions.length}문항`;
    $("live-go").onclick = () => openSolve(liveOne.id);
  } else {
    live.hidden = true;
  }

  const list = $("quiz-list");
  const seen = state.quizzes.filter((q) => q.state === "open" || state.mine[q.id]);
  $("quiz-empty").hidden = seen.length > 0;
  list.innerHTML = seen.map((q) => {
    const mine = state.mine[q.id];
    const st = statusOf(q);
    const pill = mine
      ? `<span class="pill done">제출함${mine.gradable ? ` · ${mine.right}/${mine.gradable}` : ""}</span>`
      : st === "live" ? `<span class="pill live">지금 진행 중</span>`
        : st === "open" ? `<span class="pill open">풀 수 있음</span>`
          : `<span class="pill shut">닫힘</span>`;
    return `<button class="quiz" type="button" data-q="${esc(q.id)}">
      <span class="wk">${esc(q.week)}주차</span>
      <span class="nm">${esc(q.title)}
        <span class="sub">${q.questions.length}문항${mine ? " · 다시 보기" : ""}</span></span>
      ${pill}
    </button>`;
  }).join("");

  if (state.isProfessor) renderProf();
}

$("quiz-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (b) openSolve(b.dataset.q);
});

/* ── 문제 풀기 ────────────────────────────── */
function openSolve(id) {
  const q = state.quizzes.find((x) => x.id === id);
  if (!q) return;
  state.solving = q;
  state.view = "solve";
  $("room").hidden = true;
  $("gate").hidden = true;
  $("solve").hidden = false;
  $("solve-week").textContent = `${q.week}주차`;
  $("solve-title").textContent = q.title;
  $("solve-sub").textContent = q.desc || `${q.questions.length}문항`;
  $("solve-error").hidden = true;

  const mine = state.mine[id];
  const locked = Boolean(mine) || q.state !== "open";

  $("solve-form").innerHTML = q.questions.map((qq, i) => {
    const picked = mine ? mine.picks[i] : null;
    if (qq.type === "text") {
      return `<div class="q">
        <p class="q-no">문항 ${i + 1}</p>
        <p class="q-text">${esc(qq.text)}</p>
        <textarea name="q${i}" maxlength="600" ${locked ? "disabled" : ""}
          placeholder="답을 적어 주세요">${esc(picked ?? "")}</textarea>
      </div>`;
    }
    const opts = qq.options.map((o, k) => {
      const on = String(picked) === String(k);
      const mark = locked && Number(qq.answer) === k ? " ✓" : "";
      return `<label class="opt${on ? " picked" : ""}">
        <input type="radio" name="q${i}" value="${k}" ${on ? "checked" : ""} ${locked ? "disabled" : ""}>
        <span>${esc(o)}${mark}</span></label>`;
    }).join("");
    return `<div class="q">
      <p class="q-no">문항 ${i + 1}</p>
      <p class="q-text">${esc(qq.text)}</p>
      ${opts}
    </div>`;
  }).join("");

  $("solve-send").hidden = locked;
  const done = $("solved");
  if (mine) {
    done.hidden = false;
    done.innerHTML = mine.gradable
      ? `<h3>제출했습니다</h3>
         <p class="score">${mine.right} / ${mine.gradable}</p>
         <p>객관식만 자동으로 셈했습니다. 서술형은 교수님이 보십니다.</p>`
      : `<h3>제출했습니다</h3><p>교수님이 확인하십니다.</p>`;
  } else if (q.state !== "open") {
    done.hidden = false;
    done.innerHTML = `<h3>닫힌 문제입니다</h3><p>제출 기간이 지났습니다.</p>`;
  } else {
    done.hidden = true;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("solve-back").addEventListener("click", () => {
  state.view = "room";
  state.solving = null;
  render();
});

$("solve-form").addEventListener("change", (e) => {
  if (e.target.type !== "radio") return;
  const box = e.target.closest(".q");
  box.querySelectorAll(".opt").forEach((o) => o.classList.remove("picked"));
  e.target.closest(".opt").classList.add("picked");
});

$("solve-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = state.solving;
  if (!q || !state.uid) return;

  const picks = q.questions.map((qq, i) => {
    const el = $("solve-form").elements[`q${i}`];
    if (qq.type === "text") return String(el.value || "").trim().slice(0, 600);
    const on = [...($("solve-form").querySelectorAll(`input[name="q${i}"]`))].find((x) => x.checked);
    return on ? Number(on.value) : null;
  });

  const blank = picks.findIndex((p, i) => (q.questions[i].type === "text" ? !p : p === null));
  if (blank >= 0) {
    const err = $("solve-error");
    err.textContent = `${blank + 1}번 문항이 비어 있습니다.`;
    err.hidden = false;
    return;
  }

  const { right, gradable } = grade(q, picks);
  const btn = $("solve-send");
  btn.disabled = true;
  btn.textContent = "보내는 중…";
  try {
    // 문서 이름을 '문제_사람' 으로 고정해 한 사람이 두 번 내지 못하게 한다.
    await setDoc(doc(db, ANSWERS, `${q.id}_${state.uid}`), {
      quizId: q.id, uid: state.uid,
      name: state.me.name, sid: state.me.sid,
      picks, right, gradable,
      submittedAt: serverTimestamp(),
    });
    toast("제출했습니다");
    openSolve(q.id);
  } catch (err) {
    const e2 = $("solve-error");
    e2.textContent = "보내지 못했습니다. 연결을 확인하고 다시 눌러 주세요.";
    e2.hidden = false;
  }
  btn.disabled = false;
  btn.textContent = "제출하기";
});

/* ── 교수 화면 ────────────────────────────── */
function renderProf() {
  const host = $("prof-body");
  if (state.making) return;                     // 만드는 중이면 건드리지 않는다

  host.innerHTML = state.quizzes.map((q) => {
    const rows = state.all.filter((a) => a.quizId === q.id);
    const st = statusOf(q);
    const pill = st === "live" ? `<span class="pill live">진행 중</span>`
      : st === "open" ? `<span class="pill open">열림</span>`
        : `<span class="pill shut">닫힘</span>`;

    const tally = q.questions.map((qq, i) => {
      if (qq.type !== "choice") {
        const said = rows.filter((r) => String(r.picks[i] || "").trim()).length;
        return `<p class="count">문항 ${i + 1} (서술형) · <b>${said}</b>명 답함</p>`;
      }
      const total = rows.length || 1;
      const bars = qq.options.map((o, k) => {
        const n = rows.filter((r) => Number(r.picks[i]) === k).length;
        const pct = Math.round((n / total) * 100);
        return `<div class="tally-row${Number(qq.answer) === k ? " right" : ""}">
          <span class="lab">${"①②③④⑤"[k] || k + 1}</span>
          <span class="bar"><i style="width:${pct}%"></i></span>
          <span class="n">${n}명 ${pct}%</span></div>`;
      }).join("");
      return `<p class="count">문항 ${i + 1} · ${esc(qq.text.slice(0, 40))}</p><div class="tally">${bars}</div>`;
    }).join("");

    const names = rows.map((r) => `<span class="name-chip">${esc(r.name)} ${esc(r.sid)}</span>`).join("");

    return `<div class="pq" data-pq="${esc(q.id)}">
      <div class="pq-head">
        <span class="wk">${esc(q.week)}주차</span>
        <span class="nm">${esc(q.title)}</span>
        ${pill}
        <button class="btn-line" data-act="toggle">${q.state === "open" ? "닫기" : "열기"}</button>
        <button class="btn-line" data-act="mode">${q.mode === "live" ? "실시간" : "상시"}</button>
        <button class="btn-line" data-act="del">삭제</button>
      </div>
      <div class="pq-body">
        <p class="count">제출 <b>${rows.length}</b>명</p>
        ${tally}
        ${names ? `<div class="names">${names}</div>` : ""}
      </div>
    </div>`;
  }).join("") || `<p class="empty">아직 만든 문제가 없습니다.</p>`;
}

$("prof-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest("[data-pq]").dataset.pq;
  const q = state.quizzes.find((x) => x.id === id);
  if (!q) return;
  btn.disabled = true;
  try {
    if (btn.dataset.act === "toggle") {
      await updateDoc(doc(db, QUIZZES, id), { state: q.state === "open" ? "closed" : "open" });
      toast(q.state === "open" ? "닫았습니다" : "열었습니다");
    } else if (btn.dataset.act === "mode") {
      await updateDoc(doc(db, QUIZZES, id), { mode: q.mode === "live" ? "open" : "live" });
      toast(q.mode === "live" ? "상시로 바꿨습니다" : "실시간으로 바꿨습니다");
    } else if (btn.dataset.act === "del") {
      if (confirm(`'${q.title}' 을 지울까요?\n제출된 답안은 남습니다.`)) {
        await deleteDoc(doc(db, QUIZZES, id));
        toast("지웠습니다");
      }
    }
  } catch {
    toast("바꾸지 못했습니다. 규칙을 게시하셨는지 확인해 주세요.", true);
  }
  btn.disabled = false;
});

/* 문제 만들기 */
$("p-new").addEventListener("click", () => {
  state.making = true;
  const host = $("prof-body");
  host.innerHTML = `<div class="maker" id="maker">
    <h3>새 문제</h3>
    <div class="mrow"><label for="m-week">주차</label>
      <input id="m-week" type="number" min="1" max="16" value="1"></div>
    <div class="mrow"><label for="m-title">제목</label>
      <input id="m-title" type="text" maxlength="60" placeholder="경영학의 이해"></div>
    <div class="mrow"><label for="m-mode">방식</label>
      <select id="m-mode">
        <option value="live">실시간 — 열면 학생 화면에 바로 뜸</option>
        <option value="open">상시 — 아무 때나 풀 수 있음</option>
      </select></div>
    <div id="m-qs"></div>
    <div class="maker-acts">
      <button class="btn-line" id="m-add" type="button">＋ 객관식</button>
      <button class="btn-line" id="m-addt" type="button">＋ 서술형</button>
      <button class="btn-go" id="m-save" type="button">저장하고 열기</button>
      <button class="btn-line" id="m-cancel" type="button">취소</button>
    </div>
  </div>`;
  addQ("choice");
  $("m-add").onclick = () => addQ("choice");
  $("m-addt").onclick = () => addQ("text");
  $("m-cancel").onclick = () => { state.making = false; renderProf(); };
  $("m-save").onclick = saveQuiz;
});

function addQ(type) {
  const host = $("m-qs");
  const n = host.children.length;
  const box = document.createElement("div");
  box.className = "mq";
  box.dataset.type = type;
  box.innerHTML = `
    <div class="mq-top">
      <span class="n">문항 ${n + 1} · ${type === "choice" ? "객관식" : "서술형"}</span>
      <button class="mq-del" type="button">지우기</button>
    </div>
    <div class="mrow"><textarea class="q-text-in" maxlength="300" placeholder="문제를 적어 주세요"></textarea></div>
    ${type === "choice" ? `<div class="mopts">${[0, 1, 2, 3].map((k) => `
      <div class="mopt">
        <input type="radio" name="ans-${n}" value="${k}" ${k === 0 ? "checked" : ""}>
        <input type="text" class="opt-in" maxlength="120" placeholder="보기 ${"①②③④"[k]}">
        <span>정답</span>
      </div>`).join("")}</div>` : ""}`;
  box.querySelector(".mq-del").onclick = () => { box.remove(); renumber(); };
  host.appendChild(box);
}

function renumber() {
  [...$("m-qs").children].forEach((box, i) => {
    const type = box.dataset.type;
    box.querySelector(".n").textContent = `문항 ${i + 1} · ${type === "choice" ? "객관식" : "서술형"}`;
    box.querySelectorAll('input[type="radio"]').forEach((r) => { r.name = `ans-${i}`; });
  });
}

async function saveQuiz() {
  const week = Number($("m-week").value) || 1;
  const title = cleanName($("m-title").value) || `${week}주차 퀴즈`;
  const mode = $("m-mode").value;

  const questions = [];
  for (const box of $("m-qs").children) {
    const text = box.querySelector(".q-text-in").value.trim();
    if (!text) { toast("비어 있는 문항이 있습니다", true); return; }
    if (box.dataset.type === "text") {
      questions.push({ type: "text", text });
      continue;
    }
    const options = [...box.querySelectorAll(".opt-in")].map((i) => i.value.trim()).filter(Boolean);
    if (options.length < 2) { toast("보기를 두 개 이상 적어 주세요", true); return; }
    const on = [...box.querySelectorAll('input[type="radio"]')].findIndex((r) => r.checked);
    questions.push({ type: "choice", text, options, answer: Math.max(0, on) });
  }
  if (!questions.length) { toast("문항을 하나 이상 넣어 주세요", true); return; }

  $("m-save").disabled = true;
  try {
    await addDoc(collection(db, QUIZZES), {
      week, title, mode, state: "open", questions,
      createdAt: serverTimestamp(),
    });
    state.making = false;
    toast("만들고 열었습니다");
    renderProf();
  } catch {
    toast("저장하지 못했습니다. 규칙을 게시하셨는지 확인해 주세요.", true);
  }
  $("m-save").disabled = false;
}

/* 결과 내려받기 */
$("p-csv").addEventListener("click", () => {
  if (!state.all.length) { toast("아직 제출이 없습니다", true); return; }
  const byId = new Map(state.quizzes.map((q) => [q.id, q]));
  const head = ["주차", "제목", "성명", "학번", "맞은수", "채점문항", "제출시각", "답안"];
  const rows = state.all.map((a) => {
    const q = byId.get(a.quizId);
    const when = a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleString("ko-KR") : "";
    return [q?.week ?? "", q?.title ?? "", a.name, a.sid, a.right ?? "", a.gradable ?? "", when,
            (a.picks || []).join(" | ")];
  });
  const csv = [head, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `경영학원론_퀴즈결과_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length}건 내려받았습니다`);
});

/* 참여자 명단 */
$("p-roster").addEventListener("click", () => {
  const who = new Map();
  state.all.forEach((a) => who.set(a.sid, a.name));
  if (!who.size) { toast("아직 참여자가 없습니다", true); return; }
  const list = [...who.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sid, name]) => `${sid}  ${name}`).join("\n");
  alert(`참여자 ${who.size}명\n\n${list}`);
});

/* ── 시작 ─────────────────────────────────── */
state.me = loadWho();
if (state.me) enterRoom(); else showGate();
setNet("", "연결 중…");

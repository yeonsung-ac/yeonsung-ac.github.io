/**
 * 수업 도우미 - 과목 공용 몸통
 *
 * 과목마다 달라지는 것(이름, 암호, 컬렉션 이름, 강의 영상, 자기소개 질문)은
 * 각 과목 폴더의 course.js 에 있다. 이 파일은 그것을 읽어 움직인다.
 * 고칠 일이 생기면 여기 한 곳만 고치면 모든 과목에 반영된다.
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
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";
import { isProfessorUser } from "../../professor.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const store = getStorage(app);

/* 과목 설정. index.html 이 course.js 를 먼저 읽어 window.COURSE 에 담아 둔다. */
const C = window.COURSE;

const QUIZZES = C.id + "_quizzes";
const ANSWERS = C.id + "_answers";
const LOGS = C.id + "_log";
const FILMS_C = C.id + "_films";    // 강의 영상의 공개 여부. 교수만 고친다.
const INTROS = C.id + "_intros";
const TASKS = C.id + "_tasks";      // 주간 과제. 교수가 낸다.
const WORKS = C.id + "_works";      // 낸 과제. 사진 한 장과 글.
const SCORES = C.id + "_scores";    // 과제 점수. 교수가 매긴다.
const ROSTER = C.id + "_roster";    // 수강생 명단. 이름·학번만. 로그인하면 읽힌다.
const PHONE = C.id + "_phone";      // 전화번호. 교수만 읽는다.

/* 강의 영상. 목록은 과목 설정에 있다. 썸네일 파일 이름(thumbs/01.jpg)이
   이 순서를 따르므로, 순서를 바꾸면 썸네일도 다시 그려야 한다. */
const FILMS = C.films || [];
       // 자기소개. 문서 이름이 곧 uid 라 한 사람 한 장이다.
const PHOTO_MAX = 1600;              // 긴 변. 강의실 스크린(1920)에 띄워도 견딘다
const PHOTO_RAW_MB = 15;             // 고르기 전 원본이 이보다 크면 받지 않는다
const SAY_MAX = C.intro.max || 500;
const PASS = C.pass;                 // 문패다. 소스에 드러나므로 성적의 자물쇠로 쓰지 않는다.
const KEY = C.id + "-who";
const SIDS = C.id + "-sids";         // 이 기기가 지금까지 쓴 학번들

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
  logs: [],
  intro: null,       // 내 자기소개
  intros: [],        // 교수만 채운다
  pickedPhoto: null, // 아직 안 올린 사진 (줄여 놓은 것)
  pickedType: null,  // 그 사진의 종류
  introQ: "",        // 이름·학번 찾기
  introSort: "sid",  // sid | name | new
  introPage: 0,
  spoken: {},        // 발표를 마친 사람. 이 컴퓨터에만 남는다.
  films: {},         // 강의 영상 공개 여부. 없으면 공개로 본다.
  roster: [],        // 수강생 명단 (이름·학번)
  rosterState: "wait",  // wait | ready | fail. 비었는지 못 읽었는지 가려 말해 주려는 것이다.
  pick: null,        // 문패에서 고른 사람
  tasks: [],         // 주간 과제
  works: {},         // 내가 낸 과제  taskId -> 자료
  allWorks: [],      // 교수만 채운다
  taskNow: null,     // 지금 내고 있는 과제
  taskPhoto: null,   // 아직 안 올린 과제 사진
  scores: {},        // 과제 점수  '과제ID_uid' -> { score, memo }
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

/* ── 어디서 냈는지 남기기 ──────────────────
   IP 는 브라우저가 스스로 알 수 없어 바깥에 한 번 물어본다.
   못 받아도 제출은 그대로 진행한다. 기록하려다 제출을 막으면 안 된다. */
let myIp = null;

async function findIp() {
  if (myIp !== null) return myIp;
  try {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 3500);
    const res = await fetch("https://api.ipify.org?format=json", { signal: stop.signal });
    clearTimeout(timer);
    const d = await res.json();
    myIp = String(d.ip || "").slice(0, 45);
  } catch {
    myIp = "";
  }
  return myIp;
}

/* 이 기기가 지금까지 어떤 학번으로 들어왔는지. 한 폰으로 여러 학번을 내면
   대리 제출을 의심할 근거가 된다. IP 는 강의실 와이파이면 모두 같아서
   이쪽이 훨씬 확실한 신호다. */
function seenSids() {
  try { return JSON.parse(localStorage.getItem(SIDS)) || []; } catch { return []; }
}
function noteSid(sid) {
  const list = seenSids();
  if (list.includes(sid)) return;
  list.push(sid);
  try { localStorage.setItem(SIDS, JSON.stringify(list.slice(-8))); } catch { /* 그만 */ }
}

async function writeLog(row) {
  try {
    await addDoc(collection(db, LOGS), {
      ...row, uid: state.uid, ip: await findIp(),
      ua: String(navigator.userAgent || "").slice(0, 180),
      t: serverTimestamp(),
    });
  } catch { /* 기록이 안 남아도 제출은 살린다 */ }
}

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

/* 문패를 명단에서 고르는 방식으로 쓸지. 과목 설정에서 정한다. */
const USE_ROSTER = C.gate === "roster";

/* 이름으로 좁혀 보여 준다. 서른 명을 통째로 늘어놓으면 찾기가 더 어렵다.
   두 글자만 쳐도 대개 한 사람으로 좁혀진다. */
function drawPicks() {
  const box = $("gate-picks");
  if (!box) return;
  const q = ($("g-find")?.value || "").trim();
  const hit = q
    ? state.roster.filter((r) => String(r.name).includes(q) || String(r.sid).includes(q))
    : [];

  if (!state.roster.length) {
    const say = {
      wait: "명단을 불러오는 중입니다…",
      ready: "아직 명단이 올라오지 않았습니다. 담당 교수에게 말씀해 주세요.",
      fail: "명단을 읽지 못했습니다. 담당 교수에게 말씀해 주세요." +
            (state.rosterWhy ? ` (${state.rosterWhy})` : ""),
    }[state.rosterState] || "";
    box.innerHTML = `<p class="gate-none">${esc(say)}</p>`;
    return;
  }
  if (!q) {
    box.innerHTML = `<p class="gate-none">이름을 한두 글자 넣으면 목록이 나옵니다.</p>`;
    return;
  }
  if (!hit.length) {
    box.innerHTML = `<p class="gate-none">명단에 없습니다. 담당 교수에게 말씀해 주세요.</p>`;
    return;
  }
  box.innerHTML = hit.slice(0, 8).map((r) => `
    <button class="gate-pick" type="button" data-sid="${esc(r.sid)}">
      <b>${esc(r.name)}</b><span>${esc(String(r.sid).slice(-4))}</span>
    </button>`).join("");
  box.querySelectorAll("[data-sid]").forEach((el) => {
    el.addEventListener("click", () => {
      state.pick = state.roster.find((r) => String(r.sid) === el.dataset.sid) || null;
      showPicked();
    });
  });
}

function showPicked() {
  const who = $("gate-who");
  if (!who) return;
  who.hidden = !state.pick;
  $("gate-find-row").hidden = Boolean(state.pick);
  if (state.pick) {
    $("gate-who-name").textContent = state.pick.name;
    $("gate-who-sid").textContent = state.pick.sid;
    setTimeout(() => $("g-pw")?.focus(), 60);
  }
  drawPicks();
}

if (USE_ROSTER) {
  $("g-find").addEventListener("input", drawPicks);
  $("gate-again").addEventListener("click", () => { state.pick = null; showPicked(); });
}

$("gate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const err = $("gate-error");
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  const pw = $("g-pw").value.trim();

  let name, sid;
  if (USE_ROSTER) {
    if (!state.pick) return fail("명단에서 이름을 골라 주세요.");
    name = cleanName(state.pick.name);
    sid = cleanSid(state.pick.sid);
  } else {
    name = cleanName($("g-name").value);
    sid = cleanSid($("g-sid").value);
    if (name.length < 2) return fail("성명을 두 글자 이상 넣어 주세요.");
    if (sid.length < 4) return fail("학번을 확인해 주세요.");
  }
  if (pw !== PASS) return fail("입장 암호가 다릅니다. 수업 시간에 알려 드린 숫자입니다.");

  err.hidden = true;
  state.me = { name, sid };
  saveWho(state.me);
  noteSid(sid);
  enterRoom();
});

/* 교수는 학생 칸을 채우지 않는다. 구글 로그인만으로 지나간다.
   암호를 하나 더 만들어 봐야 학생도 아는 값이 되고, 서버 규칙은 어차피
   구글 이메일만 본다. 그래서 문패 옆에 통로를 따로 낸다. */
$("gate-prof").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    const err = $("gate-error");
    err.textContent = e.code === "auth/popup-closed-by-user"
      ? "로그인 창을 닫으셨습니다." : "로그인하지 못했습니다.";
    err.hidden = false;
  }
});

$("who-out").addEventListener("click", async () => {
  if (state.me?.prof) {
    if (!confirm("교수 로그인을 풉니다.")) return;
    await signOut(auth);
    location.reload();
    return;
  }
  if (!confirm("나가면 다음에 이름과 학번을 다시 넣어야 합니다.")) return;
  try { localStorage.removeItem(KEY); } catch { /* 그만 */ }
  state.me = null;
  state.pick = null;
  showGate();
});

function showGate() {
  $("gate").hidden = false;
  if (USE_ROSTER) { showPicked(); }
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
/* 접었으면 펼 수도 있어야 한다. 새로고침해야만 돌아온다면 그것은 길이 아니다. */
$("qr-hide").addEventListener("click", () => {
  $("qr-band").classList.add("folded");
  $("qr-open").hidden = false;
  toast("QR 을 접었습니다");
});
$("qr-open").addEventListener("click", () => {
  $("qr-band").classList.remove("folded");
  $("qr-open").hidden = true;
});
$("qr-copy").addEventListener("click", async () => {
  const url = C.url;
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
  // 교수는 문패를 지나지 않고 바로 들어온다. 강의실 컴퓨터에 이름이 남지
  // 않도록 이 이름표는 localStorage 에 저장하지 않는다.
  if (state.isProfessor && !state.me) {
    state.me = { name: user.displayName || "교수", sid: "담당", prof: true };
    enterRoom();
  }

  watchQuizzes();
  watchAnswers();
  watchIntros();
  watchTasks();
  watchWorks();
  watchScores();
  watchFilms();
  if (USE_ROSTER) watchRoster();
  if (state.isProfessor) watchLogs();
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

/* 자기소개.
   학생은 규칙상 남의 것을 목록으로 못 읽는다. 그래서 학생은 자기 문서 하나만,
   교수는 컬렉션 전체를 지켜본다. 질의를 나누지 않으면 학생 쪽이 통째로 막힌다. */
let stopIntros = null;

function watchIntros() {
  if (stopIntros) stopIntros();
  if (state.isProfessor) {
    stopIntros = onSnapshot(
      collection(db, INTROS),
      (snap) => {
        state.intros = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (state.view === "intro") renderIntroAll();
      },
      () => { /* 그만 */ }
    );
    return;
  }
  stopIntros = onSnapshot(
    doc(db, INTROS, state.uid),
    (snap) => { state.intro = snap.exists() ? snap.data() : null; renderIntro(); },
    () => { /* 아직 없거나 못 읽는 것은 정상이다 */ }
  );
}

/* 강의 영상 공개 여부.
   문서가 없으면 공개로 본다. 열세 개를 일일이 켜 두어야 보이는 것보다,
   기본은 보이고 감출 것만 꺼 두는 편이 손이 덜 간다. */
/* 수강생 명단.
   문패에서 이름을 고르게 하려면 화면이 목록을 갖고 있어야 한다.
   전화번호는 여기 없다. 교수 화면에서 따로 읽는다. */
/* 주간 과제. 열린 것만 학생에게 보인다. */
let stopTasks = null;
let stopWorks = null;

function watchTasks() {
  if (stopTasks) return;
  stopTasks = onSnapshot(
    query(collection(db, TASKS), orderBy("week", "asc")),
    (snap) => {
      state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTasks();
    },
    () => { /* 아직 없을 수 있다 */ }
  );
}

function watchWorks() {
  if (stopWorks) stopWorks();
  // 학생은 규칙상 자기 것만 읽힌다. 교수는 전부 읽힌다. 질의는 같다.
  stopWorks = onSnapshot(
    collection(db, WORKS),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.allWorks = rows;
      state.works = {};
      rows.forEach((r) => { if (r.uid === state.uid) state.works[r.taskId] = r; });
      renderTasks();
      if (state.view === "works") renderWorksAll();
    },
    () => { /* 학생이 전체를 못 읽는 것은 정상이다 */ }
  );
}

/* 과제 점수.
   낸 과제 문서 안에 두면 학생이 자기 점수를 고칠 수 있다. 그래서 따로 둔다.
   학생은 자기 것만, 교수는 전부 읽힌다. 질의는 같다. */
let stopScores = null;

function watchScores() {
  if (stopScores) stopScores();
  stopScores = onSnapshot(
    collection(db, SCORES),
    (snap) => {
      state.scores = {};
      snap.docs.forEach((d) => { state.scores[d.id] = d.data(); });
      renderTasks();
      if (state.view === "works") renderWorksAll();
    },
    () => { /* 학생이 전체를 못 읽는 것은 정상이다 */ }
  );
}

let stopRoster = null;

function watchRoster() {
  if (stopRoster) return;
  stopRoster = onSnapshot(
    collection(db, ROSTER),
    (snap) => {
      state.roster = snap.docs
        .map((d) => ({ sid: d.id, ...d.data() }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
      state.rosterState = "ready";
      drawPicks();
      render();
    },
    (e) => {
      // 규칙이 아직 안 올라갔거나 로그인이 안 된 것이다. 그 말을 화면에 해 준다.
      state.rosterState = "fail";
      state.rosterWhy = e?.code || "";
      drawPicks();
    }
  );
}

let stopFilms = null;

function watchFilms() {
  if (stopFilms) return;
  stopFilms = onSnapshot(
    collection(db, FILMS_C),
    (snap) => {
      const got = {};
      snap.docs.forEach((d) => { got[d.id] = d.data(); });
      state.films = got;
      renderFilms();
    },
    () => { /* 못 읽어도 기본값(공개)으로 보여 준다 */ }
  );
}

let stopLogs = null;

function watchLogs() {
  if (stopLogs) return;
  stopLogs = onSnapshot(
    query(collection(db, LOGS), orderBy("t", "desc")),
    (snap) => {
      state.logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (state.view === "log") renderLog();
    },
    () => { /* 교수가 아니면 못 읽는 것이 정상이다 */ }
  );
}

/* 무엇이 수상한가.
   IP 는 강의실 와이파이면 모두 같게 나오므로 그것만으로는 못 가린다.
   가장 확실한 신호는 '한 기기에서 여러 학번이 나온 것' 이다. */
function suspects(logs) {
  const byDevice = new Map();
  const bySid = new Map();
  logs.forEach((l) => {
    if (!l.sid || !l.uid) return;
    if (!byDevice.has(l.uid)) byDevice.set(l.uid, new Set());
    byDevice.get(l.uid).add(l.sid);
    if (!bySid.has(l.sid)) bySid.set(l.sid, new Set());
    bySid.get(l.sid).add(l.uid);
  });

  const out = [];
  byDevice.forEach((sids, uid) => {
    if (sids.size > 1) {
      out.push({ level: "high", head: "한 기기에서 여러 학번",
                 body: [...sids].join(", "),
                 tail: "기기 " + uid.slice(0, 8) + " · 대리 제출일 수 있습니다" });
    }
  });
  bySid.forEach((uids, sid) => {
    if (uids.size > 1) {
      out.push({ level: "mid", head: "한 학번이 여러 기기",
                 body: sid,
                 tail: uids.size + "대에서 제출 · 기기를 바꿨거나 대신 냈을 수 있습니다" });
    }
  });
  return out;
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

  // QR 은 강의실 스크린에 띄우는 물건이다. 학생은 그것을 찍고 들어온 사람이라
  // 다시 보여 줄 까닭이 없다. 좁은 폰 화면에서 첫 판을 통째로 차지해 버린다.
  $("qr-band").hidden = !state.isProfessor;
  $("qr-open").hidden = !state.isProfessor || !$("qr-band").classList.contains("folded");

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

  renderIntro();
  renderTasks();
  renderFilms();

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

  // 이 기기에서 다른 학번으로 낸 적이 있으면 짚고 넘어간다. 막지는 않는다.
  const others = seenSids().filter((x) => x !== state.me.sid);
  if (others.length) {
    const go = confirm(
      "이 기기에서 다른 학번으로 제출한 적이 있습니다." + "\n\n"
      + "먼저 쓴 학번: " + others.join(", ") + "\n\n"
      + "대리 제출은 기록에 남아 교수님이 확인하십니다." + "\n"
      + "계속하시겠습니까?");
    if (!go) return;
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
    noteSid(state.me.sid);
    writeLog({ kind: "submit", quizId: q.id, name: state.me.name, sid: state.me.sid,
               otherSids: others.slice(0, 5) });
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
  if (state.view === "log") { renderLog(); return; }

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

/* 기록 보기 — 교수만 */
function renderLog() {
  const host = $("prof-body");
  const rows = state.logs;
  const bad = suspects(rows);

  const flags = bad.length
    ? `<div class="flags">${bad.map((b) => `
        <div class="flag ${b.level}">
          <span class="fh">${esc(b.head)}</span>
          <span class="fb">${esc(b.body)}</span>
          <span class="ft">${esc(b.tail)}</span>
        </div>`).join("")}</div>`
    : `<p class="count">지금까지 수상한 자취는 없습니다.</p>`;

  const byId = new Map(state.quizzes.map((q) => [q.id, q]));
  const table = rows.length
    ? `<div class="logwrap"><table class="logtable">
        <thead><tr><th>시각</th><th>성명</th><th>학번</th><th>문제</th><th>IP</th><th>기기</th></tr></thead>
        <tbody>${rows.slice(0, 300).map((l) => {
          const when = l.t?.toDate ? l.t.toDate().toLocaleString("ko-KR", { hour12: false }) : "…";
          const q = byId.get(l.quizId);
          const odd = (l.otherSids || []).length > 0;
          return `<tr${odd ? ' class="odd"' : ""}>
            <td class="n">${esc(when)}</td>
            <td>${esc(l.name || "")}</td>
            <td class="n">${esc(l.sid || "")}</td>
            <td>${esc(q ? q.week + "주차 " + q.title : "-")}</td>
            <td class="n">${esc(l.ip || "알 수 없음")}</td>
            <td class="n dim">${esc(String(l.uid || "").slice(0, 8))}</td>
          </tr>`;
        }).join("")}</tbody></table></div>
       <p class="count">모두 <b>${rows.length}</b>건${rows.length > 300 ? " (최근 300건만 표시)" : ""}</p>`
    : `<p class="empty">아직 기록이 없습니다.</p>`;

  host.innerHTML = `
    <div class="logbar">
      <button class="btn-line" id="log-back" type="button">← 문제로</button>
      <button class="btn-line" id="log-csv" type="button">기록 내려받기 (CSV)</button>
    </div>
    <h3 class="block-title" style="margin-top:6px">살펴볼 것</h3>
    ${flags}
    <h3 class="block-title" style="margin-top:26px">전체 기록</h3>
    ${table}`;

  $("log-back").onclick = () => { state.view = "room"; renderProf(); };
  $("log-csv").onclick = () => downloadLog();
}

function downloadLog() {
  if (!state.logs.length) { toast("기록이 없습니다", true); return; }
  const byId = new Map(state.quizzes.map((q) => [q.id, q]));
  const head = ["시각", "성명", "학번", "주차", "제목", "IP", "기기", "이 기기의 다른 학번", "브라우저"];
  const rows = state.logs.map((l) => {
    const q = byId.get(l.quizId);
    const when = l.t?.toDate ? l.t.toDate().toLocaleString("ko-KR", { hour12: false }) : "";
    return [when, l.name || "", l.sid || "", q?.week ?? "", q?.title ?? "",
            l.ip || "", String(l.uid || "").slice(0, 12),
            (l.otherSids || []).join(" "), l.ua || ""];
  });
  const csv = [head, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${C.name}_제출기록_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length}건 내려받았습니다`);
}

$("p-log").addEventListener("click", () => {
  state.view = "log";
  state.making = false;
  renderLog();
});

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
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${C.name}_퀴즈결과_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length}건 내려받았습니다`);
});

/* 화면에 나오는 이름은 과목 설정을 따라간다.
   경영학원론은 '자기소개', 소비자행동론은 '소비 되돌아보기' 다. */
{
  const b = $("p-intro");
  // 제목을 그대로 붙이면 "소비 되돌아보기 모아보기" 처럼 어색해진다.
  if (b) b.textContent = C.intro.button || (C.intro.title + " 모아보기");
  const h = document.querySelector("#intro .block-title");
  if (h) h.textContent = C.intro.title;
}

/* ── 자기소개 ─────────────────────────────────
   사진 한 장과 소개 글. 학생은 거의 다 휴대폰으로 들어오므로
   사진은 원본 그대로 올리지 않는다. 요즘 폰 사진은 한 장에 5MB 를 넘고,
   강의실 와이파이에 서른 명이 한꺼번에 올리면 그대로 멈춘다.
   브라우저에서 긴 변 1200px 로 줄여 보내면 대개 200KB 안쪽이 된다. */

/* 사진을 줄인다.
   폰 카메라 사진은 1200만 화소가 예사라, 통째로 Image 로 띄우면 기기에 따라
   메모리가 모자라 브라우저가 페이지를 통째로 새로 고쳐 버린다. 그래서
   createImageBitmap 으로 디코딩하면서 바로 줄이는 길을 먼저 쓴다. */
async function shrink(file) {
  // 1) 되도록 이 길로. 디코딩하면서 줄이므로 큰 사진을 통째로 펼치지 않는다.
  if (typeof createImageBitmap === "function") {
    try {
      const probe = await createImageBitmap(file);
      const s = Math.min(1, PHOTO_MAX / Math.max(probe.width, probe.height));
      const w = Math.max(1, Math.round(probe.width * s));
      const h = Math.max(1, Math.round(probe.height * s));
      probe.close?.();
      const bmp = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(bmp, 0, 0);
      bmp.close?.();
      return await toJpeg(cv);
    } catch { /* 아래 길로 간다 */ }
  }

  // 2) 옛 길. 요즘 브라우저는 EXIF 회전을 알아서 맞춘다.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("사진을 읽지 못했습니다"));
      i.src = url;
    });
    const s = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * s));
    const h = Math.max(1, Math.round(img.height * s));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    return await toJpeg(cv);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(cv) {
  return new Promise((ok, no) => cv.toBlob(
    (b) => (b ? ok(b) : no(new Error("사진을 줄이지 못했습니다"))), "image/jpeg", 0.85));
}

/* 아무리 기다려도 끝나지 않는 일이 있다. 그냥 두면 화면이 조용히 굳는다. */
function within(ms, work, whine) {
  return Promise.race([
    work,
    new Promise((_, no) => setTimeout(() => no(new Error(whine)), ms)),
  ]);
}

/* 자기소개 칸. 과목마다 묻는 것이 다르므로 설정을 보고 그린다.
   경영학원론은 한 칸, 소비자행동론은 세 칸이다. */
const ASKS = C.intro.fields;

function drawFields() {
  const box = $("intro-fields");
  if (!box || box.dataset.done === "1") return;
  box.innerHTML =
    (C.intro.prompt ? `<p class="intro-ask">${esc(C.intro.prompt)}</p>` : "") +
    ASKS.map((f, i) => `
      <label class="intro-label" for="intro-f${i}">${esc(f.label)}</label>
      <textarea id="intro-f${i}" maxlength="${SAY_MAX}" rows="${ASKS.length > 1 ? 3 : 6}"
                placeholder="${esc(f.ph || "")}"></textarea>
      <p class="intro-count"><span id="intro-n${i}">0</span> / ${SAY_MAX}자</p>`).join("");

  ASKS.forEach((f, i) => {
    $("intro-f" + i).addEventListener("input", (e) => {
      $("intro-n" + i).textContent = String(e.target.value.length);
    });
  });
  box.dataset.done = "1";
}

/* 낸 것을 읽고 쓰는 통로. 한 칸짜리든 세 칸짜리든 같은 모양으로 다룬다. */
function readAsks() {
  return ASKS.map((f, i) => $("intro-f" + i).value.trim().slice(0, SAY_MAX));
}
function fillAsks(parts) {
  ASKS.forEach((f, i) => {
    const v = (parts && parts[i]) || "";
    $("intro-f" + i).value = v;
    $("intro-n" + i).textContent = String(v.length);
  });
}
/* 옛 자료는 parts 가 없고 text 한 덩어리만 있다. 그것도 읽을 수 있어야 한다. */
const partsOf = (r) => (Array.isArray(r.parts) && r.parts.length ? r.parts : [r.text || ""]);
function saidHtml(r) {
  const parts = partsOf(r);
  if (ASKS.length === 1) return `<span class="said-one">${esc(parts[0])}</span>`;
  return parts.map((v, i) => `<span class="said-row">
    <b>${esc((ASKS[i] || {}).label || "")}</b><span>${esc(v)}</span></span>`).join("");
}
const saidText = (r) => partsOf(r).join(" / ");

function renderIntro() {
  drawFields();
  const box = $("intro");
  if (!box) return;

  // 교수는 낼 것이 없다. 모아보기로 본다.
  if (!state.me || state.isProfessor) { box.hidden = true; return; }
  box.hidden = false;

  const got = state.intro;
  const editing = box.dataset.editing === "1";
  $("intro-done").hidden = !got || editing;
  $("intro-form").hidden = Boolean(got) && !editing;

  if (got && !editing) {
    $("intro-photo").src = got.photoUrl || "";
    $("intro-photo").hidden = !got.photoUrl;
    $("intro-text").innerHTML = saidHtml(got);
    const when = got.updatedAt?.toDate ? got.updatedAt.toDate() : null;
    $("intro-when").textContent = when ? when.toLocaleString("ko-KR") + " 에 냈습니다" : "";
  }
}

$("intro-edit").addEventListener("click", () => {
  $("intro").dataset.editing = "1";
  drawFields();
  fillAsks(state.intro ? partsOf(state.intro) : []);
  const pv = $("intro-preview");
  if (state.intro?.photoUrl) {
    pv.src = state.intro.photoUrl;
    pv.hidden = false;
    $("intro-pick-say").hidden = true;
  }
  $("intro-next").hidden = true;
  renderIntro();
  $("intro-form").scrollIntoView({ behavior: "smooth", block: "start" });
});

// 상자를 누르면 앨범이 열린다.
// 카메라로 바로 찍는 길(capture)은 기기마다 탈이 나서 뺐다. 폰 카메라로 찍은
// 사진도 앨범에 남으므로, 앨범 한 길만 두는 편이 학생에게 헷갈리지 않는다.
$("intro-pick").addEventListener("click", () => $("intro-file").click());
$("intro-file").addEventListener("change", (e) => takePhoto(e));

/* 사진을 받는다.
   줄여서 올리는 것이 본래 길이다. 그런데 기기와 사진 형식은 가지가지라
   줄이는 데 실패하는 일이 있다. 그때 손을 놓아 버리면 학생은 아무것도 못 낸다.
   그래서 못 줄이면 원본 그대로라도 올린다. 안 되는 것보다 무거운 편이 낫다. */
async function takePhoto(e) {
  const f = e.target.files?.[0];
  e.target.value = "";                       // 같은 사진을 다시 골라도 반응하도록
  if (!f) return;
  const err = $("intro-error");
  const say = $("intro-pick-say");
  err.hidden = true;

  const fail = (m) => { err.textContent = m; err.hidden = false; };

  // 카메라로 막 찍은 파일은 type 이 비어 오는 기기가 있다. 이름으로도 봐 준다.
  const looksImage = String(f.type || "").startsWith("image/")
    || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(f.name || "");
  if (!looksImage) return fail("사진 파일만 됩니다. 앨범에서 골라 보세요.");

  if (f.size > PHOTO_RAW_MB * 1024 * 1024) {
    return fail(`사진이 너무 큽니다 (${(f.size / 1024 / 1024).toFixed(1)}MB). ${PHOTO_RAW_MB}MB 아래로 골라 주세요.`);
  }

  const wasSaid = say.innerHTML;
  say.hidden = false;
  say.innerHTML = "<b>사진을 준비하는 중…</b><small>잠시만요</small>";
  $("intro-pick").classList.add("busy");

  let blob = null;
  let type = "image/jpeg";
  try {
    blob = await within(25000, shrink(f), "시간이 지났습니다");
  } catch {
    // 줄이지 못했다. 원본을 그대로 쓴다. 창고 규칙이 5MB 까지 받는다.
    if (f.size <= 5 * 1024 * 1024) {
      blob = f;
      type = String(f.type || "").startsWith("image/") ? f.type : guessType(f.name);
    }
  }

  if (!blob) {
    say.innerHTML = wasSaid;
    $("intro-pick").classList.remove("busy");
    return fail("이 사진은 처리하지 못했습니다. 앨범에서 다른 사진을 골라 보세요.");
  }

  state.pickedPhoto = blob;
  state.pickedType = type;

  const pv = $("intro-preview");
  if (pv.dataset.blob) URL.revokeObjectURL(pv.src);
  pv.src = URL.createObjectURL(blob);
  pv.dataset.blob = "1";
  pv.hidden = false;
  say.hidden = true;
  say.innerHTML = wasSaid;
  $("intro-pick").classList.add("filled");
  $("intro-next").hidden = false;
  $("intro-pick").classList.remove("busy");
  toast(`사진 준비 끝 · ${Math.round(blob.size / 1024)}KB`);
}

/* 파일 이름만 보고 종류를 짐작한다. 창고 규칙이 image/ 로 시작하기를 요구한다. */
function guessType(name) {
  const e = String(name || "").toLowerCase();
  if (e.endsWith(".png")) return "image/png";
  if (e.endsWith(".gif")) return "image/gif";
  if (e.endsWith(".webp")) return "image/webp";
  if (e.endsWith(".heic") || e.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

$("intro-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("intro-error");
  const btn = $("intro-send");
  const parts = readAsks();
  const say = parts.join("\n");
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;

  if (!state.uid) return fail("아직 연결 중입니다. 잠시 뒤에 다시 눌러 주세요.");
  if (!state.pickedPhoto && !state.intro?.photoUrl) return fail("사진을 한 장 골라 주세요.");
  const thin = parts.findIndex((v) => v.length < 5);
  if (thin >= 0) return fail(`${ASKS[thin].label} — 조금 더 적어 주세요.`);

  btn.disabled = true;
  btn.textContent = "보내는 중…";
  try {
    let url = state.intro?.photoUrl || "";
    let path = state.intro?.photoPath || "";
    if (state.pickedPhoto) {
      path = `${INTROS}/${state.uid}/photo.jpg`;
      const r = storageRef(store, path);
      await uploadBytes(r, state.pickedPhoto,
        { contentType: state.pickedType || "image/jpeg" });
      url = await getDownloadURL(r);
    }

    await setDoc(doc(db, INTROS, state.uid), {
      uid: state.uid,
      name: state.me.name,
      sid: state.me.sid,
      text: say,
      parts,
      photoUrl: url,
      photoPath: path,
      createdAt: state.intro?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    writeLog({ kind: "intro", sid: state.me.sid, name: state.me.name });
    state.pickedPhoto = null;
    state.pickedType = null;
    $("intro-next").hidden = true;
    $("intro").dataset.editing = "";
    toast(C.intro.title + "를 냈습니다");
    renderIntro();
  } catch (ex) {
    fail("보내지 못했습니다. 연결을 확인하고 다시 눌러 주세요. (" + (ex.code || ex.message) + ")");
  } finally {
    btn.disabled = false;
    btn.textContent = "제출하기";
  }
});

/* 교수 화면 — 누가 냈는지 훑어보는 곳.
   여기서 한 명을 누르면 발표 화면이 열린다. 수업에서는 이 화면을 강의실
   스크린에 띄워 놓고 학생이 발표하는 동안 그 사진을 크게 보여 준다. */
const PER = 30;                       // 한 판에 서른 줄
const SPOKE = C.id + "-spoken";       // 발표를 마친 사람. 이 컴퓨터에만 남는다.

function loadSpoken() {
  try { state.spoken = JSON.parse(localStorage.getItem(SPOKE)) || {}; } catch { state.spoken = {}; }
}
function saveSpoken() {
  try { localStorage.setItem(SPOKE, JSON.stringify(state.spoken)); } catch { /* 그만 */ }
}
loadSpoken();

const when = (v) => (v && v.toDate ? v.toDate() : null);
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) => (d
  ? pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
  : "");

/* 늘어놓을 줄. 찾기와 정렬까지 마친 것이다.
   발표 화면도 이 순서를 그대로 따라가야 화면과 손이 어긋나지 않는다. */
function introRows() {
  const q = state.introQ.trim().toLowerCase();
  const rows = state.intros.filter((r) => !q
    || String(r.name || "").toLowerCase().includes(q)
    || String(r.sid || "").toLowerCase().includes(q));

  const how = {
    sid: (a, b) => String(a.sid).localeCompare(String(b.sid)),
    name: (a, b) => String(a.name).localeCompare(String(b.name), "ko"),
    new: (a, b) => ((when(b.updatedAt) || 0) - (when(a.updatedAt) || 0)),
  }[state.introSort];
  return rows.sort(how);
}

/* 같은 학번이 둘 이상이면 알려 준다. 폰을 바꾸거나 브라우저 기록이 지워지면
   같은 학생이 두 번 낼 수 있다. 발표 때 헷갈리기 전에 눈에 띄게 해 둔다. */
function sidCount() {
  const seen = new Map();
  state.intros.forEach((r) => seen.set(r.sid, (seen.get(r.sid) || 0) + 1));
  return seen;
}

function renderIntroAll() {
  const body = $("prof-body");
  const all = introRows();
  const dup = sidCount();
  const done = all.filter((r) => state.spoken[r.id]).length;

  const pages = Math.max(1, Math.ceil(all.length / PER));
  if (state.introPage >= pages) state.introPage = pages - 1;
  const from = state.introPage * PER;
  const page = all.slice(from, from + PER);

  const bar = '<div class="lst-bar">'
    + '<p class="lst-count"><b>' + state.intros.length + '명</b>이 냈습니다'
    + (done ? ' · 발표 마침 <b>' + done + '</b>' : "")
    + (state.introQ ? ' · 찾은 것 <b>' + all.length + '</b>' : "")
    + '</p><div class="lst-tools">'
    + '<input class="lst-find" id="lst-find" type="search" placeholder="성명 · 학번 찾기" value="'
    + esc(state.introQ) + '">'
    + '<select class="lst-sort" id="lst-sort">'
    + '<option value="sid"' + (state.introSort === "sid" ? " selected" : "") + '>학번 순</option>'
    + '<option value="name"' + (state.introSort === "name" ? " selected" : "") + '>이름 순</option>'
    + '<option value="new"' + (state.introSort === "new" ? " selected" : "") + '>늦게 낸 순</option>'
    + '</select>'
    + '<button class="btn-go" id="show-start" type="button">발표 화면</button>'
    + '<button class="btn-line" id="lst-csv" type="button">CSV</button>'
    + '</div></div>';

  let list;
  if (!all.length) {
    list = '<p class="empty">' + (state.introQ ? "찾는 학생이 없습니다." : "아직 낸 학생이 없습니다.") + '</p>';
  } else {
    list = '<ul class="lst">' + page.map((r, k) => {
      const i = from + k;
      const made = when(r.createdAt) || when(r.updatedAt);
      const fixed = when(r.updatedAt);
      const edited = made && fixed && fixed - made > 60000;
      const tags = (dup.get(r.sid) > 1 ? '<span class="tag warn">학번 중복</span>' : "")
        + (edited ? '<span class="tag">고침</span>' : "")
        + (state.spoken[r.id] ? '<span class="tag ok">발표함</span>' : "");
      return '<li class="lst-row' + (state.spoken[r.id] ? " spoke" : "") + '">'
        + '<span class="lst-no">' + (i + 1) + '</span>'
        + '<button class="lst-open" type="button" data-i="' + i + '" title="발표 화면으로 띄웁니다">'
        + (r.photoUrl
            ? '<img src="' + esc(r.photoUrl) + '" alt="" loading="lazy">'
            : '<span class="lst-nophoto">사진<br>없음</span>')
        + '<span class="lst-body"><span class="lst-who"><b>' + esc(r.name) + '</b>'
        + '<span class="lst-sid">' + esc(r.sid) + '</span>' + tags + '</span>'
        + '<span class="lst-text">' + esc(saidText(r)) + '</span></span>'
        + '<span class="lst-when">' + stamp(made) + '</span>'
        + '</button>'
        + '<span class="lst-acts">'
        + '<button class="lst-mark" type="button" data-mark="' + esc(r.id) + '" title="발표 마침으로 표시">'
        + (state.spoken[r.id] ? "\u21ba" : "\u2713") + '</button>'
        + '<button class="lst-del" type="button" data-del="' + esc(r.id) + '" title="지우기">\u00d7</button>'
        + '</span></li>';
    }).join("") + '</ul>';

    if (pages > 1) {
      list += '<div class="pager">'
        + '<button class="btn-line" id="pg-prev" type="button"' + (state.introPage === 0 ? " disabled" : "") + '>\u2190 앞</button>'
        + '<span>' + (state.introPage + 1) + ' / ' + pages + ' 판 · '
        + (from + 1) + '\u2013' + Math.min(from + PER, all.length) + '번</span>'
        + '<button class="btn-line" id="pg-next" type="button"' + (state.introPage >= pages - 1 ? " disabled" : "") + '>뒤 \u2192</button>'
        + '</div>';
    }
  }

  body.innerHTML = bar + list;

  const find = $("lst-find");
  if (find) {
    find.addEventListener("input", (e) => {
      state.introQ = e.target.value;
      state.introPage = 0;
      renderIntroAll();
      const f2 = $("lst-find");
      f2.focus();
      f2.setSelectionRange(f2.value.length, f2.value.length);
    });
  }

  const sort = $("lst-sort");
  if (sort) {
    sort.addEventListener("change", (e) => {
      state.introSort = e.target.value;
      state.introPage = 0;
      renderIntroAll();
    });
  }

  const go = $("show-start");
  if (go) go.addEventListener("click", () => openShow(0));

  const csv = $("lst-csv");
  if (csv) csv.addEventListener("click", introCsv);

  const turn = (d) => {
    state.introPage += d;
    renderIntroAll();
    $("prof-body").scrollIntoView({ block: "start" });
  };
  const prev = $("pg-prev");
  if (prev) prev.addEventListener("click", () => turn(-1));
  const next = $("pg-next");
  if (next) next.addEventListener("click", () => turn(1));

  body.querySelectorAll("[data-i]").forEach((el) => {
    el.addEventListener("click", () => openShow(Number(el.dataset.i)));
  });
  body.querySelectorAll("[data-mark]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.mark;
      if (state.spoken[id]) delete state.spoken[id]; else state.spoken[id] = 1;
      saveSpoken();
      renderIntroAll();
    });
  });
  body.querySelectorAll("[data-del]").forEach((el) => {
    el.addEventListener("click", () => dropIntro(el.dataset.del));
  });
}

/* ── 명단 올리기 (교수) ───────────────────────
   엑셀을 브라우저가 읽어 서버에 올린다. 학생 개인정보를 저장소에 두지 않으려는 것이다.
   이름·학번은 명단 칸에, 전화번호는 교수만 읽는 칸에 따로 넣는다. */
let sheetJs = null;
async function loadSheet() {
  if (sheetJs) return sheetJs;
  await new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    el.onload = ok;
    el.onerror = () => no(new Error("엑셀 읽는 도구를 불러오지 못했습니다"));
    document.head.appendChild(el);
  });
  sheetJs = window.XLSX;
  return sheetJs;
}

/* 열 이름이 조금씩 다르다. 뜻이 같은 것을 찾아 준다. */
function pickCol(row, words) {
  const keys = Object.keys(row);
  for (const w of words) {
    const k = keys.find((x) => String(x).replace(/\s/g, "").includes(w));
    if (k) return k;
  }
  return null;
}

async function uploadRoster(file) {
  const XLSX = await loadSheet();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  if (!rows.length) throw new Error("빈 표입니다");

  const kName = pickCol(rows[0], ["이름", "성명"]);
  const kSid = pickCol(rows[0], ["학번"]);
  const kTel = pickCol(rows[0], ["휴대", "전화", "연락"]);
  if (!kName || !kSid) throw new Error("'이름' 과 '학번' 열을 찾지 못했습니다");

  const list = rows
    .map((r) => ({
      name: String(r[kName] || "").trim(),
      sid: String(r[kSid] || "").trim(),
      tel: kTel ? String(r[kTel] || "").trim() : "",
    }))
    .filter((r) => r.name && r.sid);
  if (!list.length) throw new Error("읽을 수 있는 줄이 없습니다");

  // 수강 정정 기간에는 명단이 자주 바뀐다. 무엇이 달라졌는지 말해 주고,
  // 빠진 사람은 물어본 뒤에 지운다. 말없이 지우면 이미 낸 것과 어긋난다.
  const had = new Set(state.roster.map((r) => String(r.sid)));
  const now = new Set(list.map((r) => r.sid));
  const added = list.filter((r) => !had.has(r.sid));
  const gone = state.roster.filter((r) => !now.has(String(r.sid)));

  for (const r of list) {
    await setDoc(doc(db, ROSTER, r.sid), { name: r.name, at: serverTimestamp() });
    if (r.tel) {
      await setDoc(doc(db, PHONE, r.sid), { name: r.name, tel: r.tel, at: serverTimestamp() });
    }
  }

  let removed = 0;
  if (gone.length) {
    const who = gone.map((r) => `${r.name} (${r.sid})`).join("\n");
    if (confirm(`새 명단에 없는 ${gone.length}명을 명단에서 뺄까요?\n\n${who}\n\n`
              + "뺀 사람이 이미 낸 것은 지워지지 않습니다. 문패로 들어오지 못하게만 됩니다.")) {
      for (const r of gone) {
        await deleteDoc(doc(db, ROSTER, String(r.sid)));
        try { await deleteDoc(doc(db, PHONE, String(r.sid))); } catch { /* 없을 수 있다 */ }
        removed++;
      }
    }
  }
  return { total: list.length, added: added.length, removed };
}

$("p-roster-up")?.addEventListener("click", () => $("roster-file").click());
$("roster-file")?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  toast("명단을 읽는 중…");
  try {
    const r = await uploadRoster(f);
    const bits = [`${r.total}명`];
    if (r.added) bits.push(`새로 ${r.added}명`);
    if (r.removed) bits.push(`뺀 사람 ${r.removed}명`);
    toast(bits.join(" · ") + " 올렸습니다");
  } catch (ex) {
    toast("올리지 못했습니다 — " + (ex.message || ex.code), true);
  }
});

/* 명단과 대조해 아직 안 낸 사람을 짚어 준다. 낸 사람만 세면 누가 빠졌는지 모른다. */
function renderRoster() {
  const body = $("prof-body");
  if (!state.roster.length) {
    body.innerHTML = `<p class="empty">명단이 아직 없습니다. 위 <b>명단 올리기</b> 로 엑셀을 올려 주세요.</p>`;
    return;
  }
  const gave = new Set(state.intros.map((r) => String(r.sid)));
  const done = state.roster.filter((r) => gave.has(String(r.sid)));
  const miss = state.roster.filter((r) => !gave.has(String(r.sid)));

  body.innerHTML = `<div class="lst-bar">
      <p class="lst-count">명단 <b>${state.roster.length}명</b> ·
        ${esc(C.intro.title)} 낸 사람 <b>${done.length}</b> ·
        아직 <b>${miss.length}</b></p>
      <div class="lst-tools"><button class="btn-line" id="ros-csv" type="button">CSV</button></div>
    </div>
    <ul class="lst">${state.roster.map((r, i) => {
      const ok = gave.has(String(r.sid));
      return `<li class="lst-row${ok ? " spoke" : ""}">
        <span class="lst-no">${i + 1}</span>
        <span class="lst-open" style="cursor:default">
          <span class="lst-body"><span class="lst-who">
            <b>${esc(r.name)}</b><span class="lst-sid">${esc(r.sid)}</span>
            ${ok ? `<span class="tag ok">냈음</span>` : `<span class="tag warn">아직</span>`}
          </span></span>
          <span class="lst-when">${esc(state.tels?.[r.sid] || "")}</span>
        </span>
      </li>`;
    }).join("")}</ul>`;

  $("ros-csv")?.addEventListener("click", () => {
    const head = ["번호", "이름", "학번", "전화번호", C.intro.title];
    const rows = state.roster.map((r, i) => [i + 1, r.name, r.sid,
      state.tels?.[r.sid] || "", gave.has(String(r.sid)) ? "O" : ""]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = C.name + "_명단_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* 전화번호는 교수가 명단을 열 때만 읽는다. 늘 켜 두면 굳이 볼 일 없는 자료를 계속 들고 있게 된다. */
async function loadTels() {
  try {
    const snap = await getDocs(collection(db, PHONE));
    state.tels = {};
    snap.docs.forEach((d) => { state.tels[d.id] = d.data().tel || ""; });
  } catch { state.tels = {}; }
}

$("p-roster")?.addEventListener("click", async () => {
  state.view = "roster";
  renderRoster();
  await loadTels();
  renderRoster();
});

$("p-intro").addEventListener("click", () => {
  state.view = "intro";
  renderIntroAll();
});

/* 시험 삼아 넣은 것, 잘못 낸 것을 교수가 치운다.
   장부와 창고 양쪽에서 지운다. 장부만 지우면 사진이 창고에 남아 쌓인다. */
async function dropIntro(id) {
  const r = state.intros.find((x) => x.id === id);
  if (!r) return;
  if (!confirm(r.name + " (" + r.sid + ") 학생이 낸 " + C.intro.title + " 를 지웁니다.\n되돌릴 수 없습니다.")) return;
  try {
    if (r.photoPath) {
      try { await deleteObject(storageRef(store, r.photoPath)); }
      catch { /* 사진이 이미 없어도 장부는 지운다 */ }
    }
    await deleteDoc(doc(db, INTROS, id));
    delete state.spoken[id];
    saveSpoken();
    toast("지웠습니다");
  } catch (e) {
    toast("지우지 못했습니다 (" + (e.code || e.message) + ")", true);
  }
}

/* 소개 글까지 통째로 내려받는다. 사진은 주소만 담는다. */
function introCsv() {
  const rows = introRows();
  if (!rows.length) { toast("내려받을 것이 없습니다", true); return; }
  const head = ["번호", "성명", "학번", "제출", "수정", "발표함"]
    .concat(ASKS.map((f) => f.label)).concat(["사진 주소"]);
  const body = rows.map((r, i) => [
    i + 1, r.name, r.sid,
    (when(r.createdAt) || "") && when(r.createdAt).toLocaleString("ko-KR"),
    (when(r.updatedAt) || "") && when(r.updatedAt).toLocaleString("ko-KR"),
    state.spoken[r.id] ? "O" : "",
  ].concat(ASKS.map((f, k) => partsOf(r)[k] || "")).concat([r.photoUrl || ""]));
  const csv = [head, ...body]
    .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(","))
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = C.name + "_" + C.intro.title + "_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(rows.length + "명 내려받았습니다");
}


/* ── 강의 영상 ────────────────────────────────
   한 줄에 한 편. 썸네일에 제목이 들어 있고, 교수에게는 오른쪽에 공개 스위치가 붙는다.
   학생에게는 공개된 것만 보인다. */
/* 강의 단위. 경영학원론은 "강", 소비자행동론은 교재를 따라 "장" 이다. */
const UNIT = C.unit || "강";
const filmId = (i) => String(i + 1).padStart(2, "0");
const filmOpen = (i) => state.films[filmId(i)]?.open !== false;

function renderFilms() {
  const box = $("films");
  if (!box || !state.me) return;

  const prof = state.isProfessor;
  const seen = FILMS.map((f, i) => ({ ...f, i })).filter((f) => prof || filmOpen(f.i));
  const shown = FILMS.filter((f, i) => filmOpen(i)).length;

  box.hidden = seen.length === 0;
  $("films-tools").hidden = !prof;
  $("films-sub").textContent = prof
    ? `모두 ${FILMS.length}${UNIT} · 학생에게 보이는 것 ${shown}${UNIT}`
    : (FILMS.every((f) => !f.v)
      ? `모두 ${seen.length}${UNIT} · 영상은 준비 중입니다`
      : `모두 ${seen.length}${UNIT} · 눌러서 유튜브에서 보기`);

  $("film-list").innerHTML = seen.map((f) => {
    const no = filmId(f.i);
    const on = filmOpen(f.i);
    // 아직 주소가 없는 강은 눌리지 않게 둔다. 목록에는 보이되 헛걸음을 만들지 않는다.
    const ready = Boolean(f.v);
    const head = ready
      ? `<a class="film-go" href="https://youtu.be/${esc(f.v)}" target="_blank" rel="noopener noreferrer"
           aria-label="제${f.i + 1}${UNIT} ${esc(f.t)} 유튜브에서 보기">`
      : `<span class="film-go" aria-label="제${f.i + 1}${UNIT} ${esc(f.t)} 준비 중">`;
    return `<li class="film${prof && !on ? " off" : ""}${ready ? "" : " soon"}">
      ${head}
        <span class="film-shot">
          <img src="thumbs/${no}.jpg" alt="" loading="${f.i < 4 ? "eager" : "lazy"}"
               width="800" height="450">
          ${ready ? `<span class="film-play" aria-hidden="true">▶</span>`
                  : `<span class="film-soon">준비 중</span>`}
        </span>
        <span class="film-copy">
          <span class="film-no">제${f.i + 1}${UNIT}</span>
          <span class="film-title">${esc(f.t)}</span>
        </span>
      ${ready ? "</a>" : "</span>"}
      ${prof ? `<span class="film-acts">
        <button class="film-eye${on ? " on" : ""}" type="button" data-film="${no}"
                aria-pressed="${on}" title="${on ? "학생에게 보입니다" : "학생에게 감춰져 있습니다"}">
          ${on ? "공개" : "비공개"}
        </button>
      </span>` : ""}
    </li>`;
  }).join("");

  if (!prof) return;
  $("film-list").querySelectorAll("[data-film]").forEach((el) => {
    el.addEventListener("click", () => flipFilm(el.dataset.film));
  });
}

/* 누르는 순간 화면부터 바꾼다.
   서버에 다녀오기를 기다리면 강의실 회선에서 반 박자씩 늦게 반응해,
   눌린 것인지 아닌지 알 수 없어 두 번 세 번 누르게 된다.
   먼저 바꿔 보여 주고, 서버가 거절하면 되돌린다. */
async function flipFilm(id) {
  const was = state.films[id];
  const now = was?.open !== false;

  state.films[id] = { ...(was || {}), open: !now };
  renderFilms();

  try {
    await setDoc(doc(db, FILMS_C, id), { open: !now, at: serverTimestamp() });
    toast(now ? "학생에게 감췄습니다" : "학생에게 공개했습니다");
  } catch (e) {
    if (was === undefined) delete state.films[id]; else state.films[id] = was;
    renderFilms();
    toast("바꾸지 못했습니다 (" + (e.code || e.message) + ")", true);
  }
}

async function flipAll(open) {
  const word = open ? "모두 공개" : "모두 비공개";
  if (!confirm(`${FILMS.length}강을 ${word}로 바꿉니다.`)) return;

  const was = { ...state.films };
  FILMS.forEach((f, i) => { state.films[filmId(i)] = { open }; });
  renderFilms();

  try {
    for (let i = 0; i < FILMS.length; i++) {
      await setDoc(doc(db, FILMS_C, filmId(i)), { open, at: serverTimestamp() });
    }
    toast(word + "로 바꿨습니다");
  } catch (e) {
    state.films = was;
    renderFilms();
    toast("바꾸지 못했습니다 (" + (e.code || e.message) + ")", true);
  }
}

$("films-all").addEventListener("click", () => flipAll(true));
$("films-none").addEventListener("click", () => flipAll(false));


/* ── 주간 과제 ────────────────────────────────
   사진 한 장과 글 3,000자. 매주 하나씩 열린다.
   발표까지 쓰므로 교수 화면에서 사진을 화면 가득 띄울 수 있어야 한다. */
const WORK_MAX = 3000;
const dueOf = (t) => (t.due ? new Date(t.due + "T23:59:59") : null);
const isLate = (t, at) => {
  const d = dueOf(t);
  return Boolean(d && at && at > d);
};
const dueText = (t) => {
  const d = dueOf(t);
  if (!d) return "마감 없음";
  const left = Math.ceil((d - new Date()) / 86400000);
  if (left < 0) return `마감 지남 (${t.due})`;
  if (left === 0) return `오늘까지 (${t.due})`;
  return `${t.due}까지 · ${left}일 남음`;
};

function renderTasks() {
  const box = $("tasks");
  if (!box || !state.me) return;
  const prof = state.isProfessor;
  const seen = prof ? state.tasks : state.tasks.filter((t) => t.open !== false);

  box.hidden = !prof && !seen.length;
  $("tasks-tools").hidden = !prof;
  $("tasks-sub").textContent = prof
    ? `모두 ${state.tasks.length}개 · 학생에게 열린 것 ${state.tasks.filter((t) => t.open !== false).length}개`
    : `${seen.length}개`;

  if (!seen.length) {
    $("task-list").innerHTML = `<p class="empty">아직 낸 과제가 없습니다.</p>`;
    return;
  }

  $("task-list").innerHTML = seen.map((t) => {
    const mine = state.works[t.id];
    const late = mine && isLate(t, mine.updatedAt?.toDate ? mine.updatedAt.toDate() : null);
    const shut = dueOf(t) && dueOf(t) < new Date();
    const sc = mine ? state.scores[`${t.id}_${state.uid}`] : null;
    const pill = mine
      ? (sc && sc.score !== "" && sc.score != null
          ? `<span class="pill score">${esc(String(sc.score))}점</span>`
          : `<span class="pill done">냈음${late ? " · 늦음" : ""}</span>`)
      : shut ? `<span class="pill shut">마감</span>`
        : `<span class="pill open">내야 함</span>`;
    return `<li class="task${t.open === false ? " off" : ""}">
      <button class="task-go" type="button" data-task="${esc(t.id)}">
        <span class="task-body">
          <span class="task-head"><b>${esc(t.week)}주차</b>
            <span class="task-title">${esc(t.title)}</span></span>
          <span class="task-due">${esc(dueText(t))}</span>
        </span>
        ${pill}
      </button>
      ${prof ? `<span class="task-acts">
        <button class="film-eye${t.open !== false ? " on" : ""}" type="button" data-topen="${esc(t.id)}">
          ${t.open !== false ? "열림" : "닫힘"}</button>
        <button class="lst-del" type="button" data-tdel="${esc(t.id)}" title="지우기">×</button>
      </span>` : ""}
    </li>`;
  }).join("");

  $("task-list").querySelectorAll("[data-task]").forEach((el) => {
    el.addEventListener("click", () => openTask(el.dataset.task));
  });
  if (!prof) return;
  $("task-list").querySelectorAll("[data-topen]").forEach((el) => {
    el.addEventListener("click", async () => {
      const t = state.tasks.find((x) => x.id === el.dataset.topen);
      try { await setDoc(doc(db, TASKS, t.id), { ...t, open: t.open === false }, { merge: true }); }
      catch (e) { toast("바꾸지 못했습니다 (" + (e.code || e.message) + ")", true); }
    });
  });
  $("task-list").querySelectorAll("[data-tdel]").forEach((el) => {
    el.addEventListener("click", async () => {
      const t = state.tasks.find((x) => x.id === el.dataset.tdel);
      if (!confirm(`${t.week}주차 "${t.title}" 과제를 지웁니다.` + "\n"
                 + "학생이 낸 것은 지워지지 않습니다.")) return;
      try { await deleteDoc(doc(db, TASKS, t.id)); toast("지웠습니다"); }
      catch (e) { toast("지우지 못했습니다 (" + (e.code || e.message) + ")", true); }
    });
  });
}

/* 학생이 과제를 내는 화면 */
function openTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  state.taskNow = t;
  state.taskPhoto = null;
  state.view = "task";

  const mine = state.works[t.id];
  $("room").hidden = true;
  $("taskview").hidden = false;
  $("tv-week").textContent = `${t.week}주차`;
  $("tv-title").textContent = t.title;
  $("tv-guide").textContent = t.guide || "";
  $("tv-guide").hidden = !t.guide;
  $("tv-due").textContent = dueText(t);

  const pv = $("tv-preview");
  pv.src = mine?.photoUrl || "";
  pv.hidden = !mine?.photoUrl;
  $("tv-pick-say").hidden = Boolean(mine?.photoUrl);
  $("tv-text").value = mine?.text || "";
  $("tv-n").textContent = String(($("tv-text").value || "").length);
  $("tv-error").hidden = true;

  // 점수가 매겨졌으면 보여 준다. 남의 점수는 서버가 막아 읽히지 않는다.
  const sc = state.scores[`${t.id}_${state.uid}`];
  const box = $("tv-score");
  const has = sc && sc.score !== "" && sc.score != null;
  box.hidden = !has;
  if (has) {
    $("tv-score-n").textContent = String(sc.score);
    $("tv-score-memo").textContent = sc.memo || "";
    $("tv-score-memo").hidden = !sc.memo;
  }
  window.scrollTo({ top: 0 });
}

$("tv-back").addEventListener("click", () => {
  state.view = "room";
  $("taskview").hidden = true;
  $("room").hidden = false;
  render();
});

$("tv-text").addEventListener("input", (e) => {
  $("tv-n").textContent = String(e.target.value.length);
});

$("tv-pick").addEventListener("click", () => $("tv-file").click());
$("tv-file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  const err = $("tv-error");
  err.hidden = true;
  const say = $("tv-pick-say");
  const was = say.innerHTML;
  say.hidden = false;
  say.innerHTML = "<b>사진을 준비하는 중…</b>";
  try {
    let blob;
    try { blob = await within(25000, shrink(f), "시간이 지났습니다"); }
    catch { if (f.size <= 5 * 1024 * 1024) blob = f; }
    if (!blob) throw new Error("이 사진은 처리하지 못했습니다");
    state.taskPhoto = blob;
    const pv = $("tv-preview");
    if (pv.dataset.blob) URL.revokeObjectURL(pv.src);
    pv.src = URL.createObjectURL(blob);
    pv.dataset.blob = "1";
    pv.hidden = false;
    say.hidden = true;
    toast(`사진 준비 끝 · ${Math.round(blob.size / 1024)}KB`);
  } catch (ex) {
    err.textContent = ex.message + ". 앨범에서 다른 사진을 골라 보세요.";
    err.hidden = false;
  } finally {
    say.innerHTML = was;
  }
});

$("tv-send").addEventListener("click", async () => {
  const t = state.taskNow;
  const err = $("tv-error");
  const btn = $("tv-send");
  const text = $("tv-text").value.trim().slice(0, WORK_MAX);
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;

  const mine = state.works[t.id];
  if (!state.uid) return fail("아직 연결 중입니다. 잠시 뒤에 다시 눌러 주세요.");
  if (!state.taskPhoto && !mine?.photoUrl) return fail("사진을 한 장 골라 주세요.");
  if (text.length < 10) return fail("글을 열 글자 이상 적어 주세요.");

  btn.disabled = true;
  btn.textContent = "보내는 중…";
  try {
    let url = mine?.photoUrl || "";
    let path = mine?.photoPath || "";
    if (state.taskPhoto) {
      path = `${WORKS}/${state.uid}/${t.id}.jpg`;
      const r = storageRef(store, path);
      await uploadBytes(r, state.taskPhoto, { contentType: "image/jpeg" });
      url = await getDownloadURL(r);
    }
    await setDoc(doc(db, WORKS, `${t.id}_${state.uid}`), {
      taskId: t.id, uid: state.uid,
      name: state.me.name, sid: state.me.sid,
      text, photoUrl: url, photoPath: path,
      createdAt: mine?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    writeLog({ kind: "work", taskId: t.id, sid: state.me.sid, name: state.me.name });
    state.taskPhoto = null;
    toast("과제를 냈습니다");
  } catch (ex) {
    fail("보내지 못했습니다. 연결을 확인하고 다시 눌러 주세요. (" + (ex.code || ex.message) + ")");
  } finally {
    btn.disabled = false;
    btn.textContent = "제출하기";
  }
});

/* 교수: 과제 만들기 */
$("p-task-new").addEventListener("click", async () => {
  const week = prompt("몇 주차 과제인가요?", String(state.tasks.length + 1));
  if (!week) return;
  const title = prompt("과제 제목");
  if (!title) return;
  const guide = prompt("학생에게 보일 안내 (없으면 비워 두세요)") || "";
  const due = prompt("마감일 (2026-09-15 처럼. 없으면 비워 두세요)") || "";
  try {
    await addDoc(collection(db, TASKS), {
      week: String(week).trim(), title: title.trim(), guide: guide.trim(),
      due: due.trim(), open: true, at: serverTimestamp(),
    });
    toast("과제를 냈습니다");
  } catch (e) {
    toast("만들지 못했습니다 (" + (e.code || e.message) + ")", true);
  }
});

/* 교수: 낸 과제 모아보기. 발표에도 쓴다. */
function workRows() {
  const t = state.taskPick || (state.tasks[0] || {});
  return state.allWorks
    .filter((w) => w.taskId === t.id)
    .sort((a, b) => String(a.sid).localeCompare(String(b.sid)));
}

const sc = (workId) => state.scores[workId] || {};

/* 점수를 매긴다. 빈칸으로 두면 점수를 지운다. */
async function putScore(workId, raw) {
  const w = state.allWorks.find((x) => x.id === workId);
  if (!w) return;
  const v = String(raw).trim();
  try {
    if (v === "") {
      await deleteDoc(doc(db, SCORES, workId));
      toast("점수를 지웠습니다");
      return;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) { toast("0 에서 100 사이로 넣어 주세요", true); return; }
    await setDoc(doc(db, SCORES, workId), {
      uid: w.uid, taskId: w.taskId, sid: w.sid, name: w.name,
      score: n, memo: sc(workId).memo || "", at: serverTimestamp(),
    });
    toast(`${w.name} ${n}점`);
  } catch (e) {
    toast("매기지 못했습니다 (" + (e.code || e.message) + ")", true);
  }
}

function renderWorksAll() {
  const body = $("prof-body");
  if (!state.tasks.length) {
    body.innerHTML = `<p class="empty">아직 낸 과제가 없습니다.</p>`;
    return;
  }
  if (!state.taskPick) state.taskPick = state.tasks[0];
  const rows = workRows();
  const gave = new Set(rows.map((r) => String(r.sid)));
  const miss = state.roster.filter((r) => !gave.has(String(r.sid)));

  body.innerHTML = `<div class="lst-bar">
      <p class="lst-count"><b>${rows.length}명</b>이 냈습니다`
      + (state.roster.length ? ` · 안 낸 사람 <b>${miss.length}</b>` : "") + `</p>
      <div class="lst-tools">
        <select class="lst-sort" id="wk-pick">${state.tasks.map((t) =>
          `<option value="${esc(t.id)}"${t.id === state.taskPick.id ? " selected" : ""}>
            ${esc(t.week)}주차 · ${esc(t.title)}</option>`).join("")}</select>
        <button class="btn-go" id="wk-show" type="button">발표 화면</button>
        <button class="btn-line" id="wk-csv" type="button">CSV</button>
      </div>
    </div>`
    + (rows.length ? `<ul class="lst">${rows.map((r, i) => {
      const late = isLate(state.taskPick, r.updatedAt?.toDate ? r.updatedAt.toDate() : null);
      return `<li class="lst-row">
        <span class="lst-no">${i + 1}</span>
        <button class="lst-open" type="button" data-wi="${i}">
          ${r.photoUrl ? `<img src="${esc(r.photoUrl)}" alt="" loading="lazy">`
                       : `<span class="lst-nophoto">사진<br>없음</span>`}
          <span class="lst-body"><span class="lst-who">
            <b>${esc(r.name)}</b><span class="lst-sid">${esc(r.sid)}</span>
            ${late ? `<span class="tag warn">늦음</span>` : ""}</span>
            <span class="lst-text">${esc(r.text)}</span></span>
          <span class="lst-when">${stamp(when(r.updatedAt))}</span>
        </button>
        <span class="lst-acts">
          <input class="wk-score" type="number" min="0" max="100" inputmode="numeric"
                 data-score="${esc(r.id)}" value="${esc(String(sc(r.id).score ?? ""))}"
                 placeholder="점수" title="점수를 넣고 화면 밖을 누르면 저장됩니다">
        </span>
      </li>`;
    }).join("")}</ul>` : `<p class="empty">이 과제는 아직 아무도 내지 않았습니다.</p>`);

  body.querySelectorAll("[data-score]").forEach((el) => {
    el.addEventListener("change", () => putScore(el.dataset.score, el.value));
  });

  $("wk-pick").addEventListener("change", (e) => {
    state.taskPick = state.tasks.find((t) => t.id === e.target.value);
    renderWorksAll();
  });
  $("wk-show").addEventListener("click", () => openWorkShow(0));
  $("wk-csv").addEventListener("click", worksCsv);
  body.querySelectorAll("[data-wi]").forEach((el) => {
    el.addEventListener("click", () => openWorkShow(Number(el.dataset.wi)));
  });
}

$("p-works").addEventListener("click", () => {
  state.view = "works";
  renderWorksAll();
});

function worksCsv() {
  const rows = workRows();
  if (!rows.length) { toast("내려받을 것이 없습니다", true); return; }
  const t = state.taskPick;
  const head = ["번호", "이름", "학번", "제출", "늦음", "점수", "글", "사진 주소"];
  const body = rows.map((r, i) => [i + 1, r.name, r.sid,
    when(r.updatedAt) ? when(r.updatedAt).toLocaleString("ko-KR") : "",
    isLate(t, when(r.updatedAt)) ? "O" : "",
    sc(r.id).score ?? "", r.text, r.photoUrl || ""]);
  const csv = [head, ...body]
    .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '"' + '"') + '"').join(","))
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${C.name}_${t.week}주차_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* 과제 발표 화면. 자기소개 발표와 같은 자리를 쓴다. */
let workAt = 0;
function openWorkShow(i) {
  const rows = workRows();
  if (!rows.length) { toast("아직 낸 사람이 없습니다", true); return; }
  state.showKind = "work";
  workAt = Math.max(0, Math.min(i, rows.length - 1));
  $("show").hidden = false;
  document.body.classList.add("showing");
  paintWork();
}
function paintWork() {
  const rows = workRows();
  const r = rows[workAt];
  if (!r) { closeShow(); return; }
  const img = $("show-photo");
  img.src = r.photoUrl || "";
  img.hidden = !r.photoUrl;
  img.alt = r.name + " 학생이 낸 사진";
  $("show-name").textContent = r.name;
  $("show-sid").textContent = r.sid;
  $("show-text").textContent = r.text || "";
  $("show-n").textContent = `${workAt + 1} / ${rows.length}`;
  $("show-prev").disabled = workAt === 0;
  $("show-next").disabled = workAt >= rows.length - 1;
}

/* ── 발표 화면 ────────────────────────────────
   강의실 스크린용이라 사진을 화면 높이에 맞춰 크게 놓고 글씨를 키웠다.
   진행은 화살표 키로 한다. 발표 중에 마우스를 찾는 것보다 그쪽이 빠르다. */
let showAt = 0;

function openShow(i) {
  state.showKind = "intro";
  const rows = introRows();
  if (!rows.length) { toast("아직 낸 학생이 없습니다", true); return; }
  showAt = Math.max(0, Math.min(i, rows.length - 1));
  $("show").hidden = false;
  document.body.classList.add("showing");
  paintShow();
}

function paintShow() {
  const rows = introRows();
  const r = rows[showAt];
  if (!r) { closeShow(); return; }
  const img = $("show-photo");
  img.src = r.photoUrl || "";
  img.hidden = !r.photoUrl;
  img.alt = r.name + " 학생이 낸 사진";
  $("show-name").textContent = r.name;
  $("show-sid").textContent = r.sid;
  $("show-text").innerHTML = saidHtml(r);
  $("show-n").textContent = `${showAt + 1} / ${rows.length}`;
  $("show-prev").disabled = showAt === 0;
  $("show-next").disabled = showAt >= rows.length - 1;
}

function stepShow(d) {
  if (state.showKind === "work") {
    const rows = workRows();
    const next = workAt + d;
    if (next < 0 || next >= rows.length) return;
    workAt = next;
    paintWork();
    return;
  }
  const rows = introRows();
  const next = showAt + d;
  if (next < 0 || next >= rows.length) return;
  showAt = next;
  paintShow();
}

function closeShow() {
  $("show").hidden = true;
  document.body.classList.remove("showing");
}

$("show-x").addEventListener("click", closeShow);
$("show-prev").addEventListener("click", () => stepShow(-1));
$("show-next").addEventListener("click", () => stepShow(1));

document.addEventListener("keydown", (e) => {
  if ($("show").hidden) return;
  if (e.key === "Escape") { closeShow(); return; }
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
    e.preventDefault(); stepShow(1);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault(); stepShow(-1);
  }
});

/* ── 시작 ─────────────────────────────────── */
state.me = loadWho();
if (state.me) enterRoom(); else showGate();
setNet("", "연결 중…");

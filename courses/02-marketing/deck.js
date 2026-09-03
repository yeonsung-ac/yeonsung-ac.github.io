/**
 * 교안 보관함 · 움직이는 몸통
 *
 * 다른 과목은 _class/class.js 한 벌을 나눠 쓴다. 이 과목은 지나간 학기의
 * 교안만 놓아 두는 곳이라 문제도 과제도 없다. 그 큰 몸통을 끌어오면
 * 쓰지 않는 화면이 더 많아지므로 여기만 따로 둔다.
 *
 * 문은 다른 과목과 같다. 성명·학번·암호. 암호는 course.js 의 값이 처음 값이고,
 * 교수가 관리 화면에서 바꾸면 서버(course_config/mkt)의 해시가 이긴다.
 *
 * 교수 기능(공개·비공개)은 암호가 아니라 구글 로그인으로 가른다.
 * 입장 암호는 학생도 아는 값이라 그것으로 교수를 가릴 수 없기 때문이다.
 *
 * 파일은 저장소(Firebase Storage)의 marketing/ 아래에 있고, 규칙이 로그인한
 * 사람에게만 내준다. 깃 저장소는 공개라 교안을 거기 두지 않는다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup,
  GoogleAuthProvider, signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage, ref, getDownloadURL, uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

import { firebaseConfig } from "../_class/firebase-config.js";
import { isProfessorUser } from "../../professor.js";

const C = window.COURSE;
const DECKS = C.id + "_decks";       // 강마다 공개·비공개 한 줄
const LOGS = C.id + "_log";          // 누가 무엇을 열었는지. 교수만 읽는다
const CONFIG = "course_config";      // 입장 암호. 관리 화면이 쓴다
const KEY = C.id + "-who";           // 이 기기가 쓴 이름표
const BASE = "marketing";            // 저장소 안의 폴더

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const store = getStorage(app);

const state = {
  me: null,            // { name, sid }
  isProfessor: false,
  gateHash: null,      // 교수가 바꾼 암호. 없으면 course.js 의 처음 값
  open: {},            // { "01": true, ... }
  ready: false,        // 공개 여부를 서버에서 한 번이라도 받았는가
};

const $ = (id) => document.getElementById(id);
const MARK = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => MARK[m]);

/* ── 알림 ──────────────────────────────────── */
let toastT = null;
function toast(text, bad) {
  const el = $("toast");
  el.textContent = text;
  el.classList.toggle("bad", Boolean(bad));
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("on"), 2600);
}

/* ── 암호 ──────────────────────────────────── */
async function hashOf(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── 이 기기가 쓴 이름표 ───────────────────── */
function loadMe() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.name && v.sid ? v : null;
  } catch (e) { return null; }
}

function saveMe(me) {
  try { localStorage.setItem(KEY, JSON.stringify(me)); } catch (e) { /* 사생활 보호 모드 */ }
}

/* ── 화면 가르기 ───────────────────────────── */
function show() {
  const inside = Boolean(state.me) || state.isProfessor;
  $("boot").hidden = true;
  $("gate").hidden = inside;
  $("room").hidden = !inside;
  if (!inside) return;

  $("prof").hidden = !state.isProfessor;
  if (state.isProfessor) {
    $("prof-who").textContent = auth.currentUser ? auth.currentUser.email : "";
    $("who").textContent = "교수로 보고 있습니다. 감춰 둔 것도 함께 보입니다.";
  } else {
    $("who").textContent = state.me.name + " · " + state.me.sid;
  }
  render();
}

/* ── 목록 ──────────────────────────────────── */
function render() {
  const prof = state.isProfessor;
  const rows = C.decks
    .map((d, i) => ({ t: d.t, d: d.d, p: d.p, n: String(i + 1).padStart(2, "0") }))
    .filter((d) => prof || state.open[d.n]);

  $("wait").hidden = state.ready;
  $("none").hidden = !state.ready || rows.length > 0 || prof;

  $("decks").innerHTML = rows.map((d) => {
    const on = Boolean(state.open[d.n]);
    const sw = prof
      ? '<button class="sw ' + (on ? "on" : "") + '" type="button" data-sw="' + d.n + '"' +
        ' aria-pressed="' + on + '"><i></i><span>' + (on ? "공개" : "비공개") + "</span></button>"
      : "";
    return '' +
      '<li class="deck' + (prof && !on ? " shut" : "") + '">' +
        '<img class="deck-thumb" src="thumbs/' + d.n + '.jpg" alt=""' +
             ' width="800" height="450" loading="lazy">' +
        '<div class="deck-body">' +
          '<p class="deck-meta"><b>' + d.n + "</b> · " + esc(d.d) + " · " + d.p + "쪽</p>" +
          '<h3 class="deck-title">' + esc(d.t) + "</h3>" +
          '<div class="deck-acts">' +
            '<button class="btn-go" type="button" data-open="' + d.n + '">열어보기</button>' +
            '<button class="btn-line" type="button" data-get="' + d.n + '">PPT 받기</button>' +
            sw +
          "</div>" +
        "</div>" +
      "</li>";
  }).join("");
}

/* ── 파일 열기 ─────────────────────────────── */
function fileUrl(kind, n) {
  const ext = kind === "pdf" ? "pdf" : "pptx";
  return getDownloadURL(ref(store, BASE + "/" + kind + "/" + n + "." + ext));
}

/* 새 창은 먼저 열어 두고 주소를 나중에 넣는다. 주소를 받아 온 뒤에 열면
   사용자가 누른 순간과 멀어져 스마트폰이 팝업으로 보고 막는다. */
async function openDeck(n, kind) {
  const win = window.open("", "_blank", "noopener");
  try {
    const url = await fileUrl(kind, n);
    if (win) win.location = url;
    else location.href = url;          // 그래도 막혔다면 이 창에서 연다
    note(n, kind);
  } catch (e) {
    if (win) win.close();
    toast(e && e.code === "storage/object-not-found"
      ? "아직 올라오지 않은 교안입니다."
      : "파일을 여는 데 실패했습니다. 잠시 뒤 다시 눌러 주세요.", true);
  }
}

/* 누가 무엇을 열었는지 남긴다. 학생은 자기 것만 쓸 수 있고 읽지는 못한다. */
function note(n, kind) {
  if (state.isProfessor) return;
  addDoc(collection(db, LOGS), {
    uid: auth.currentUser ? auth.currentUser.uid : "",
    name: state.me.name,
    sid: state.me.sid,
    deck: n,
    kind: kind,
    at: serverTimestamp(),
  }).catch(() => { /* 기록이 안 남아도 교안은 열려야 한다 */ });
}

/* ── 공개·비공개 ───────────────────────────── */
async function toggle(n) {
  const next = !state.open[n];
  state.open[n] = next;             // 눈에 먼저 보이고 서버는 뒤따른다
  render();
  try {
    await setDoc(doc(db, DECKS, n), { open: next, at: serverTimestamp() }, { merge: true });
    toast(next ? n + "강을 공개했습니다" : n + "강을 감췄습니다");
  } catch (e) {
    state.open[n] = !next;
    render();
    toast("바꾸지 못했습니다. 규칙을 확인해 주세요.", true);
  }
}

/* ── 서버 듣기 ─────────────────────────────── */
function watch() {
  onSnapshot(collection(db, DECKS), (snap) => {
    const next = {};
    snap.forEach((d) => { if (d.data().open) next[d.id] = true; });
    state.open = next;
    state.ready = true;
    if (!$("room").hidden) render();
  }, () => {
    state.ready = true;
    if (!$("room").hidden) render();
  });

  onSnapshot(doc(db, CONFIG, C.id), (snap) => {
    state.gateHash = snap.exists() ? (snap.data().hash || null) : null;
  }, () => { /* 못 읽으면 course.js 의 처음 값을 쓴다 */ });
}

/* ── 교안 올리기 ───────────────────────────── */
/* 콘솔에서 스물두 개를 손으로 올리는 것보다, 폴더를 통째로 골라 두면 이름의
   번호를 보고 제자리에 넣는 편이 덜 헷갈린다. 교수만 보이고, 규칙도 교수만 쓴다. */
const TYPE = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

$("up-open").addEventListener("click", () => {
  const box = $("up");
  box.hidden = !box.hidden;
  $("up-open").textContent = box.hidden ? "교안 올리기" : "올리기 닫기";
});

$("up-file").addEventListener("change", async (e) => {
  const picked = [...e.target.files];
  e.target.value = "";            // 같은 파일을 다시 골라도 알아채도록
  if (!picked.length) return;

  const list = $("up-list");
  const jobs = [];
  const skipped = [];

  for (const f of picked) {
    const m = /^(\d{1,2})\.(pdf|pptx)$/i.exec(f.name);
    const n = m ? String(Number(m[1])).padStart(2, "0") : null;
    if (!n || Number(m[1]) < 1 || Number(m[1]) > C.decks.length) {
      skipped.push(f.name);
      continue;
    }
    jobs.push({ f: f, n: n, kind: m[2].toLowerCase() });
  }
  jobs.sort((a, b) => (a.n + a.kind).localeCompare(b.n + b.kind));

  list.innerHTML =
    jobs.map((j) => '<li class="up-row" id="up-' + j.n + "-" + j.kind + '">' +
      "<b>" + j.n + "." + j.kind + "</b>" +
      '<span class="up-bar"><i style="width:0%"></i></span>' +
      '<span class="up-say">기다리는 중</span></li>').join("") +
    (skipped.length
      ? '<li class="up-skip">이름이 01.pdf 같은 꼴이 아니라 건너뜁니다 — ' +
        esc(skipped.join(", ")) + "</li>"
      : "");

  let done = 0;
  for (const j of jobs) {          // 한 번에 하나씩. 스물두 개를 동시에 밀면 끊긴다.
    const row = $("up-" + j.n + "-" + j.kind);
    const bar = row.querySelector(".up-bar i");
    const say = row.querySelector(".up-say");
    try {
      await new Promise((ok, no) => {
        const task = uploadBytesResumable(
          ref(store, BASE + "/" + j.kind + "/" + j.n + "." + j.kind),
          j.f, { contentType: TYPE[j.kind], cacheControl: "private, max-age=86400" });
        task.on("state_changed", (s) => {
          const pct = s.totalBytes ? (s.bytesTransferred / s.totalBytes * 100) : 0;
          bar.style.width = pct.toFixed(0) + "%";
          say.textContent = pct.toFixed(0) + "%";
        }, no, ok);
      });
      row.classList.add("ok");
      say.textContent = "올렸습니다";
      done++;
    } catch (err) {
      row.classList.add("bad");
      say.textContent = (err && err.code) === "storage/unauthorized"
        ? "권한 없음 — 규칙을 게시하셨나요?"
        : "실패";
    }
  }
  toast(done === jobs.length
    ? jobs.length + "개를 모두 올렸습니다"
    : done + " / " + jobs.length + "개만 올라갔습니다", done !== jobs.length);
});

/* ── 문 ────────────────────────────────────── */
$("gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("g-name").value.trim();
  const sid = $("g-sid").value.trim();
  const pw = $("g-pw").value;
  const err = $("gate-error");

  const ok = state.gateHash ? (await hashOf(pw)) === state.gateHash : pw === C.pass;
  if (!ok) {
    err.textContent = "입장 암호가 맞지 않습니다.";
    err.hidden = false;
    $("g-pw").value = "";
    $("g-pw").focus();
    return;
  }
  err.hidden = true;
  state.me = { name: name, sid: sid };
  saveMe(state.me);
  show();
});

$("gate-prof").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    toast("로그인하지 못했습니다.", true);
  }
});

$("out").addEventListener("click", async () => {
  try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
  state.me = null;
  if (state.isProfessor) { await signOut(auth); location.reload(); return; }
  $("g-pw").value = "";
  show();
});

$("decks").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.open) openDeck(b.dataset.open, "pdf");
  else if (b.dataset.get) openDeck(b.dataset.get, "pptx");
  else if (b.dataset.sw) toggle(b.dataset.sw);
});

/* ── 시작 ──────────────────────────────────── */
/* 문패는 서버를 기다릴 까닭이 없다. 암호를 견주는 것은 브라우저 안에서 끝나고,
   서버가 필요한 것은 들어온 뒤 파일을 받아 올 때부터다. 먼저 띄워 두면
   학교 와이파이가 느린 날에도 학생이 빈 화면을 보고 있지 않는다. */
state.me = loadMe();
show();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch(() => {
      toast("서버에 연결하지 못했습니다. 잠시 뒤 새로고침해 주세요.", true);
    });
    return;
  }
  const wasProf = state.isProfessor;
  state.isProfessor = isProfessorUser(user);
  watch();
  if (state.isProfessor !== wasProf || !$("room").hidden) show();
});

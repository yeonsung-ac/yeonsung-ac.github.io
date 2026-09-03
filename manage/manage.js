/**
 * 수업 관리 — 과목별 입장 암호
 *
 * 암호 원문은 어디에도 두지 않는다. 해시만 서버에 담고, 학생 화면이 학생이 친
 * 값을 해시해서 견준다. 그래서 여기서도 '지금 암호가 무엇인지' 는 보여 줄 수 없다.
 * 잊으셨으면 새로 정하시면 된다.
 *
 * 이 암호는 문고리다. 네 자리 숫자는 마음먹으면 뚫린다.
 * 실제 자물쇠는 수강생 명단과 firestore.rules 다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import { firebaseConfig } from "../courses/_class/firebase-config.js";
import { isProfessorUser } from "../professor.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const CONFIG = "course_config";

/* 다루는 과목. 새 과목을 붙이면 여기 한 줄 더한다. */
const COURSES = [
  { id: "mgmt", no: "01", name: "경영학원론", path: "courses/01-management/", first: "0909" },
  { id: "ad", no: "03", name: "광고학개론", path: "courses/03-advertising/", first: "0909" },
  { id: "cb", no: "04", name: "소비자행동론", path: "courses/04-consumer-behavior/", first: "0909" },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer = null;
function toast(msg, bad = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast on" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast" + (bad ? " bad" : ""); }, 2400);
}

async function hashOf(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const state = { conf: {}, ready: false };

/* ── 로그인 ───────────────────────────────── */
$("signin").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    toast(e.code === "auth/popup-closed-by-user" ? "로그인을 닫으셨습니다" : "로그인하지 못했습니다", true);
  }
});

$("signout").addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

onAuthStateChanged(auth, (user) => {
  $("wait").hidden = true;
  const prof = isProfessorUser(user);

  $("lock").hidden = prof;
  $("room").hidden = !prof;

  if (prof) {
    $("me-mail").textContent = user.email;
    watch();
    draw();
    return;
  }
  // 로그인은 했는데 교수 계정이 아닌 경우
  const who = $("lock-who");
  who.hidden = !user;
  if (user) who.textContent = `${user.email} 로 로그인하셨습니다. 이 화면은 담당 교수만 쓸 수 있습니다.`;
});

/* ── 지금 상태 지켜보기 ───────────────────── */
let stop = null;
function watch() {
  if (stop) return;
  stop = onSnapshot(
    collection(db, CONFIG),
    (snap) => {
      state.conf = {};
      snap.docs.forEach((d) => { state.conf[d.id] = d.data(); });
      state.ready = true;
      draw();
    },
    () => { state.ready = true; draw(); }
  );
}

const when = (v) => (v && v.toDate ? v.toDate() : null);

/* ── 그리기 ───────────────────────────────── */
function draw() {
  $("cards").innerHTML = COURSES.map((c) => {
    const got = state.conf[c.id];
    const at = when(got?.at);
    const changed = Boolean(got?.hash);
    return `<li class="card" data-c="${c.id}">
      <div class="card-head">
        <p class="card-no">${esc(c.no)} / ${esc(c.name)}</p>
        <a class="card-link" href="../${esc(c.path)}" target="_blank" rel="noopener noreferrer">수업 도우미 ↗</a>
      </div>

      <p class="card-now">
        ${changed
          ? `<span class="dot on"></span>바꾼 암호를 쓰고 있습니다`
            + (at ? `<span class="card-at">${at.toLocaleString("ko-KR")} 에 바꿈</span>` : "")
          : `<span class="dot"></span>처음 값 <b>${esc(c.first)}</b> 을 쓰고 있습니다`}
      </p>

      <div class="card-set">
        <label for="pw-${c.id}">새 암호</label>
        <input id="pw-${c.id}" type="text" inputmode="numeric" maxlength="20"
               autocomplete="off" placeholder="숫자 네 자리를 권합니다">
        <button class="btn-go" data-save="${c.id}" type="button">바꾸기</button>
        ${changed ? `<button class="btn-line" data-reset="${c.id}" type="button">처음 값으로</button>` : ""}
      </div>

      <p class="card-err" data-err="${c.id}" hidden></p>
    </li>`;
  }).join("");

  $("cards").querySelectorAll("[data-save]").forEach((b) => {
    b.addEventListener("click", () => save(b.dataset.save));
  });
  $("cards").querySelectorAll("[data-reset]").forEach((b) => {
    b.addEventListener("click", () => reset(b.dataset.reset));
  });
  $("cards").querySelectorAll("input").forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(el.id.replace("pw-", "")); }
    });
  });
}

function say(id, msg) {
  const el = document.querySelector(`[data-err="${id}"]`);
  el.textContent = msg;
  el.hidden = !msg;
}

/* ── 바꾸기 ───────────────────────────────── */
async function save(id) {
  const c = COURSES.find((x) => x.id === id);
  const el = $("pw-" + id);
  const pw = el.value.trim();
  say(id, "");

  if (pw.length < 4) return say(id, "네 글자 이상 넣어 주세요.");
  if (pw.length > 20) return say(id, "스무 글자까지 됩니다.");
  if (!confirm(`${c.name} 입장 암호를 "${pw}" 로 바꿉니다.\n\n`
             + "바꾸면 그때부터 새 암호만 통합니다.\n학생들에게 알려 주셔야 합니다.")) return;

  try {
    await setDoc(doc(db, CONFIG, id), { hash: await hashOf(pw), at: serverTimestamp() });
    el.value = "";
    toast(`${c.name} 암호를 바꿨습니다`);
  } catch (e) {
    say(id, "바꾸지 못했습니다 (" + (e.code || e.message) + ")");
  }
}

/* ── 처음 값으로 되돌리기 ─────────────────── */
async function reset(id) {
  const c = COURSES.find((x) => x.id === id);
  if (!confirm(`${c.name} 암호를 처음 값 "${c.first}" 로 되돌립니다.`)) return;
  try {
    await deleteDoc(doc(db, CONFIG, id));
    toast(`${c.name} 을 처음 값으로 되돌렸습니다`);
  } catch (e) {
    say(id, "되돌리지 못했습니다 (" + (e.code || e.message) + ")");
  }
}

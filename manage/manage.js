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
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, listAll, getMetadata,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

import { firebaseConfig } from "../courses/_class/firebase-config.js";
import { isProfessorUser } from "../professor.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const store = getStorage(app);
const CONFIG = "course_config";

/* 다루는 과목. 새 과목을 붙이면 여기 한 줄 더한다. */
const COURSES = [
  { id: "mgmt", no: "01", name: "경영학원론", path: "courses/01-management/", first: "0909" },
  { id: "mkt", no: "02", name: "통합적 마케팅 커뮤니케이션", path: "courses/02-marketing/", first: "0909" },
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


/* ── 사용량 ───────────────────────────────────
   요금은 결국 이 숫자에서 나온다. 청구 금액 자체는 결제 API 가 있어야 읽을 수
   있고 그건 서버가 필요하다. 이 사이트는 서버가 없으므로 사용량으로 가늠한다.

   무료 제공량은 firebase.google.com/pricing 에 적힌 값이다.
     Firestore  저장 1 GiB · 하루 읽기 5만 · 쓰기 2만 · 삭제 2만
     Storage    저장 5 GB · 달 내려받기 100 GB · 업로드 작업 5천 · 내려받기 작업 5만 */
const FREE = { fsStore: 1 * 1024 ** 3, stStore: 5 * 1024 ** 3 };

/* 무료 한도를 넘겼을 때의 대략 단가(USD). 지역과 시점에 따라 다르므로
   화면에도 '대략' 이라고 밝혀 둔다. 넘길 일이 거의 없어 참고용이다. */
const RATE = { fsStoreGiB: 0.18, stStoreGB: 0.026, usdKrw: 1400 };

const WHAT = [
  { id: "mgmt", name: "경영학원론" },
  { id: "ad", name: "광고학개론" },
  { id: "cb", name: "소비자행동론" },
];
/* 학생이 낸 것 말고 내가 올려 둔 것. 교안 PDF·PPT 가 여기 있고,
   덩치가 커서 빼놓고 세면 사용량이 실제와 어긋난다. */
const MINE = [{ prefix: "marketing", name: "마케팅 교안" }];

const KIND = [
  { k: "intros", t: "자기소개" },
  { k: "works", t: "과제" },
  { k: "answers", t: "퀴즈 답안" },
  { k: "roster", t: "명단" },
];

const mb = (n) => (n / 1024 / 1024);
const nice = (n) => (n >= 1024 * 1024
  ? (n / 1024 / 1024).toFixed(1) + " MB"
  : Math.max(1, Math.round(n / 1024)) + " KB");

async function countOf(name) {
  try {
    const s = await getCountFromServer(collection(db, name));
    return s.data().count;
  } catch { return null; }
}

/* 창고는 한 사람에 폴더 하나라 안쪽까지 들어가 세어야 한다. */
async function sizeOf(prefix) {
  let files = 0, bytes = 0;
  async function walk(r) {
    const got = await listAll(r);
    for (const it of got.items) {
      files++;
      try { bytes += (await getMetadata(it)).size || 0; } catch { /* 그만 */ }
    }
    for (const p of got.prefixes) await walk(p);
  }
  try { await walk(storageRef(store, prefix)); } catch { /* 없을 수 있다 */ }
  return { files, bytes };
}

$("use-go").addEventListener("click", async () => {
  const btn = $("use-go");
  const out = $("use-out");
  btn.disabled = true;
  btn.textContent = "세는 중…";
  out.innerHTML = `<p class="use-wait">서버를 훑고 있습니다. 사진이 많으면 조금 걸립니다…</p>`;

  try {
    const rows = [];
    for (const c of WHAT) {
      const counts = {};
      for (const k of KIND) counts[k.k] = await countOf(`${c.id}_${k.k}`);
      const a = await sizeOf(`${c.id}_intros`);
      const b = await sizeOf(`${c.id}_works`);
      rows.push({ ...c, counts, files: a.files + b.files, bytes: a.bytes + b.bytes });
    }

    for (const m of MINE) {
      const g = await sizeOf(m.prefix);
      rows.push({ id: m.prefix, name: m.name, counts: {}, files: g.files, bytes: g.bytes });
    }

    const files = rows.reduce((s, r) => s + r.files, 0);
    const bytes = rows.reduce((s, r) => s + r.bytes, 0);
    const docs = rows.reduce((s, r) =>
      s + KIND.reduce((t, k) => t + (r.counts[k.k] || 0), 0), 0);

    // 문서 하나를 넉넉히 2KB 로 잡는다. 실제로는 그보다 작다.
    const fsBytes = docs * 2048;
    const pctSt = bytes / FREE.stStore * 100;
    const pctFs = fsBytes / FREE.fsStore * 100;

    const overSt = Math.max(0, bytes - FREE.stStore) / 1024 ** 3;
    const overFs = Math.max(0, fsBytes - FREE.fsStore) / 1024 ** 3;
    const won = Math.round((overSt * RATE.stStoreGB + overFs * RATE.fsStoreGiB) * RATE.usdKrw);

    out.innerHTML = `
      <div class="use-wrap">
        <table class="use-tb">
          <thead><tr><th>과목</th>${KIND.map((k) => `<th>${esc(k.t)}</th>`).join("")}
            <th>파일</th><th>용량</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td class="nm">${esc(r.name)}</td>
            ${KIND.map((k) => `<td>${r.counts[k.k] == null ? "—" : r.counts[k.k]}</td>`).join("")}
            <td>${r.files}</td><td>${nice(r.bytes)}</td>
          </tr>`).join("")}</tbody>
          <tfoot><tr><td class="nm">합계</td>
            ${KIND.map((k) => `<td>${rows.reduce((s, r) => s + (r.counts[k.k] || 0), 0)}</td>`).join("")}
            <td>${files}</td><td>${nice(bytes)}</td></tr></tfoot>
        </table>
      </div>

      <div class="use-bars">
        ${bar("파일 저장 (Cloud Storage)", pctSt, `${mb(bytes).toFixed(1)} MB / 무료 5 GB`)}
        ${bar("글·기록 저장 (Firestore)", pctFs, `문서 ${docs}개 · 약 ${mb(fsBytes).toFixed(1)} MB / 무료 1 GiB`)}
      </div>

      <div class="use-cost ${won ? "over" : ""}">
        <b>${won ? `이대로면 달 ${won.toLocaleString()}원쯤 나올 수 있습니다`
                 : "무료 한도 안입니다 · 예상 청구 0원"}</b>
        <span>${won
          ? "무료 한도를 넘긴 만큼만 셈한 것입니다."
          : "지금 쌓인 양으로는 저장 요금이 붙지 않습니다. 읽고 쓰는 횟수도 하루 무료량"
            + "(읽기 5만 · 쓰기 2만)에 한참 못 미칩니다."}</span>
        <span class="use-note">
          저장 단가는 대략 GB당 월 $${RATE.stStoreGB} (사진) · GiB당 $${RATE.fsStoreGiB} (글) 로 셈했고,
          환율은 ${RATE.usdKrw}원으로 잡았습니다. 지역과 시점에 따라 다르니 어림수로만 보세요.
          정확한 청구액은 <a href="https://console.firebase.google.com/project/yeonsung-ac/usage"
          target="_blank" rel="noopener noreferrer">Firebase 사용량·결제</a>에서 보셔야 합니다.
        </span>
      </div>`;
  } catch (e) {
    out.innerHTML = `<p class="card-err">세지 못했습니다 (${esc(e.code || e.message)})</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "다시 세어 보기";
  }
});

function bar(name, pct, sub) {
  const w = Math.min(100, Math.max(pct, pct > 0 ? 0.6 : 0));
  return `<div class="use-bar">
    <p class="use-bar-top"><b>${esc(name)}</b><span>${pct < 0.1 ? "0.1% 미만" : pct.toFixed(1) + "%"}</span></p>
    <div class="use-track"><span style="width:${w}%"></span></div>
    <p class="use-bar-sub">${esc(sub)}</p>
  </div>`;
}

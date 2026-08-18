/**
 * 과제 제출함. 빌드 도구 없이 브라우저에서 Firebase 를 직접 쓴다.
 * 학생은 자기가 낸 것만 보고, 교수(professor.js 의 이메일)는 전부 본다.
 * 파일 실물은 Storage 에, 목록에 필요한 정보는 Firestore 의 submissions 에 둔다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
import { ASSIGNMENTS, MAX_FILE_MB, isProfessorUser } from "./settings.js";

const COLLECTION = "submissions";
const LIST_LIMIT = 500;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;
const FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024; // Blaze 무료 할당량 5GB

const $ = (id) => document.getElementById(id);

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  if (!value) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(value);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/** Storage 경로에 쓸 수 있게 파일명을 다듬는다. 원래 이름은 Firestore 에 따로 남긴다. */
function safeName(name) {
  return name.replace(/[^\w.\-가-힣ㄱ-ㅎㅏ-ㅣ]/g, "_").slice(-120) || "file";
}

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!configured) {
  $("setup-notice").hidden = false;
  $("account-state").textContent = "설정 필요";
} else {
  start();
}

function start() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const state = {
    user: null,
    isProfessor: false,
    items: [],
    queue: [],
    filter: "전체",
    keyword: "",
    uploading: false,
    editingId: null,
  };

  /* ---------- 로그인 ---------- */

  async function signIn() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      if (error.code === "auth/cancelled-popup-request") return;
      window.alert("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  function renderAccount() {
    const box = $("account");
    box.textContent = "";

    if (!state.user) {
      const button = make("button", "board-button board-button-primary", "구글 계정으로 로그인");
      button.type = "button";
      button.addEventListener("click", signIn);
      box.append(button);
      return;
    }

    const who = make("span", "board-user");
    const avatar = make("span", "board-avatar");
    if (state.user.photoURL) avatar.style.backgroundImage = `url(${state.user.photoURL})`;
    else avatar.textContent = (state.user.displayName || "?").slice(0, 1);
    const name = state.user.displayName || "이름 없음";
    who.append(avatar, make("span", "board-user-name", state.isProfessor ? `${name} (교수)` : name));

    const out = make("button", "board-button", "로그아웃");
    out.type = "button";
    out.addEventListener("click", () => signOut(auth));

    box.append(who, out);
  }

  /* ---------- 데이터 ---------- */

  function toItem(id, data) {
    const at = (value) => (value instanceof Timestamp ? value.toDate() : null);
    return {
      id,
      assignment: String(data.assignment ?? ""),
      fileName: String(data.fileName ?? ""),
      fileSize: Number(data.fileSize ?? 0),
      note: String(data.note ?? ""),
      storagePath: String(data.storagePath ?? ""),
      ownerId: String(data.ownerId ?? ""),
      ownerName: String(data.ownerName ?? "이름 없음"),
      ownerEmail: String(data.ownerEmail ?? ""),
      createdAt: at(data.createdAt),
    };
  }

  /**
   * 교수는 전체를 최신순으로, 학생은 자기 것만 가져온다.
   * 학생 쪽에 orderBy 를 붙이면 복합 색인을 따로 만들어야 해서 정렬은 브라우저에서 한다.
   */
  async function loadItems() {
    const base = collection(db, COLLECTION);
    const q = state.isProfessor
      ? query(base, orderBy("createdAt", "desc"), limit(LIST_LIMIT))
      : query(base, where("ownerId", "==", state.user.uid), limit(LIST_LIMIT));

    const snapshot = await getDocs(q);
    state.items = snapshot.docs.map((item) => toItem(item.id, item.data()));
    if (!state.isProfessor) {
      state.items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    }
  }

  /* ---------- 요금 안내 ---------- */

  function renderBilling() {
    const box = $("billing");
    box.hidden = !state.isProfessor;
    if (!state.isProfessor) return;

    const used = state.items.reduce((sum, item) => sum + item.fileSize, 0);
    const percent = Math.min(100, (used / FREE_TIER_BYTES) * 100);

    const line = $("billing-usage");
    line.textContent = "";
    line.classList.toggle("is-warn", percent >= 80);
    line.append(document.createTextNode(
      `보관 중 ${formatSize(used)} / 무료 5GB (${percent.toFixed(percent < 1 ? 2 : 1)}%) · 파일 ${state.items.length}개`,
    ));

    const bar = make("span", "submit-billing-bar");
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(percent, 0.6)}%`;
    bar.append(fill);
    line.append(bar);
  }

  /* ---------- 업로드 대기열 ---------- */

  function showUploadError(message) {
    const box = $("upload-error");
    box.textContent = message;
    box.hidden = !message;
  }

  function renderQueue() {
    const box = $("queue");
    box.textContent = "";
    box.hidden = state.queue.length === 0;
    $("upload-button").disabled = state.uploading
      || state.queue.filter((entry) => !entry.bad && !entry.done).length === 0;

    state.queue.forEach((entry, index) => {
      const row = document.createElement("li");
      if (entry.bad) row.classList.add("is-bad");
      if (entry.done) row.classList.add("is-done");

      row.append(
        make("span", "submit-queue-name", entry.file.name),
        make("span", "submit-queue-size", entry.bad ? entry.bad : formatSize(entry.file.size)),
      );

      if (state.uploading) {
        row.append(make("span", "submit-queue-size", entry.done ? "완료" : `${entry.progress ?? 0}%`));
      } else {
        const cancel = make("button", "submit-queue-drop", "×");
        cancel.type = "button";
        cancel.title = "목록에서 빼기";
        cancel.addEventListener("click", () => {
          state.queue.splice(index, 1);
          renderQueue();
        });
        row.append(cancel);
      }

      const bar = make("span", "submit-queue-bar");
      const fill = document.createElement("i");
      fill.style.width = `${entry.done ? 100 : entry.progress ?? 0}%`;
      bar.append(fill);
      row.append(bar);

      box.append(row);
    });
  }

  function addFiles(files) {
    [...files].forEach((file) => {
      let bad = null;
      if (file.size > MAX_BYTES) bad = `${MAX_FILE_MB}MB 초과 — 제외됨`;
      else if (file.size === 0) bad = "빈 파일 — 제외됨";
      state.queue.push({ file, bad, progress: 0, done: false });
    });
    showUploadError("");
    renderQueue();
  }

  /* ---------- 업로드 실행 ---------- */

  function uploadOne(entry) {
    const id = crypto.randomUUID();
    const path = `${COLLECTION}/${state.user.uid}/${id}/${safeName(entry.file.name)}`;
    const task = uploadBytesResumable(ref(storage, path), entry.file, {
      contentType: entry.file.type || "application/octet-stream",
    });

    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          entry.progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          renderQueue();
        },
        reject,
        async () => {
          try {
            await addDoc(collection(db, COLLECTION), {
              assignment: $("field-assignment").value,
              fileName: entry.file.name,
              fileSize: entry.file.size,
              note: $("field-note").value.trim(),
              storagePath: path,
              ownerId: state.user.uid,
              ownerName: state.user.displayName || "이름 없음",
              ownerEmail: state.user.email || "",
              createdAt: serverTimestamp(),
            });
            entry.done = true;
            entry.progress = 100;
            renderQueue();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  async function runUpload() {
    const targets = state.queue.filter((entry) => !entry.bad && !entry.done);
    if (targets.length === 0) return;

    state.uploading = true;
    showUploadError("");
    renderQueue();

    let failed = 0;
    for (const entry of targets) {
      try {
        await uploadOne(entry);
      } catch (error) {
        failed += 1;
        entry.bad = error?.code === "storage/unauthorized"
          ? "권한 없음 — 로그인 상태를 확인하세요"
          : "업로드 실패";
        renderQueue();
      }
    }

    state.uploading = false;
    if (failed > 0) showUploadError(`${failed}개 파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.`);

    // 성공한 것은 목록으로 넘어갔으니 대기열에서 지우고, 실패한 것만 남겨 원인을 보여 준다.
    state.queue = state.queue.filter((entry) => entry.bad && !entry.done);
    $("field-note").value = "";
    renderQueue();
    await refresh();
  }

  /* ---------- 목록 ---------- */

  function buildAssignmentOptions() {
    ASSIGNMENTS.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      $("field-assignment").append(option);
    });

    ["전체", ...ASSIGNMENTS].forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name === "전체" ? "전체 과제" : name;
      $("filter-assignment").append(option);
    });
  }

  async function download(item, button) {
    button.disabled = true;
    try {
      const url = await getDownloadURL(ref(storage, item.storagePath));
      window.open(url, "_blank", "noopener");
    } catch {
      window.alert("파일을 내려받지 못했습니다. 이미 삭제되었을 수 있습니다.");
    } finally {
      button.disabled = false;
    }
  }

  async function remove(item, button) {
    if (!window.confirm(`${item.fileName} 을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    button.disabled = true;
    try {
      // 실물이 이미 없어도 목록은 정리되어야 하므로 Storage 삭제 실패는 넘어간다.
      await deleteObject(ref(storage, item.storagePath)).catch(() => {});
      await deleteDoc(doc(db, COLLECTION, item.id));
      await refresh();
    } catch {
      window.alert("삭제에 실패했습니다.");
      button.disabled = false;
    }
  }

  function isOwner(item) {
    return Boolean(state.user && state.user.uid === item.ownerId);
  }

  function buildRow(item) {
    const row = make("div", "submit-row");

    const tag = make("span", "board-tag", item.assignment || "미분류");
    tag.dataset.category = item.assignment;

    const main = make("span", "submit-row-main");
    const sub = state.isProfessor
      ? [item.ownerName, item.ownerEmail, item.note].filter(Boolean).join(" · ")
      : item.note;
    main.append(make("span", "submit-row-name", item.fileName));
    if (sub) main.append(make("span", "submit-row-sub", sub));

    const meta = make("span", "submit-row-meta");
    meta.append(make("b", "", formatSize(item.fileSize)), document.createTextNode(formatDate(item.createdAt)));

    const actions = make("span", "submit-row-actions");
    const get = make("button", "board-button", "내려받기");
    get.type = "button";
    get.addEventListener("click", () => download(item, get));
    actions.append(get);

    // 남의 제출물은 교수도 고치지 못한다. 지우는 것만 된다.
    if (isOwner(item)) {
      const edit = make("button", "board-button", "수정");
      edit.type = "button";
      edit.addEventListener("click", () => {
        state.editingId = item.id;
        renderList();
      });
      actions.append(edit);
    }

    const del = make("button", "board-button board-button-danger", "삭제");
    del.type = "button";
    del.addEventListener("click", () => remove(item, del));
    actions.append(del);

    row.append(tag, main, meta, actions);
    return row;
  }

  /**
   * 고칠 수 있는 것은 과제 분류와 메모뿐이다.
   * 파일을 바꾸려면 지우고 다시 올려야 한다. 규칙에서도 그렇게 막아 두었다.
   */
  function buildEditRow(item) {
    const row = make("div", "submit-row submit-row-editing");

    const select = document.createElement("select");
    select.className = "submit-select";
    const names = ASSIGNMENTS.includes(item.assignment) || !item.assignment
      ? ASSIGNMENTS
      : [...ASSIGNMENTS, item.assignment];
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = ASSIGNMENTS.includes(name) ? name : `${name} (지워진 과제)`;
      select.append(option);
    });
    select.value = item.assignment || ASSIGNMENTS[0];

    const main = make("span", "submit-row-main");
    main.append(make("span", "submit-row-name", item.fileName));
    const note = document.createElement("input");
    note.type = "text";
    note.className = "submit-edit-note";
    note.maxLength = 100;
    note.placeholder = "메모 (선택)";
    note.value = item.note;
    main.append(note);

    const meta = make("span", "submit-row-meta");
    meta.append(make("b", "", formatSize(item.fileSize)), document.createTextNode(formatDate(item.createdAt)));

    const actions = make("span", "submit-row-actions");
    const save = make("button", "board-button board-button-primary", "저장");
    save.type = "button";
    save.addEventListener("click", () => saveEdit(item, select.value, note.value.trim(), save));
    const cancel = make("button", "board-button", "취소");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      state.editingId = null;
      renderList();
    });
    actions.append(save, cancel);

    row.append(select, main, meta, actions);
    return row;
  }

  async function saveEdit(item, assignment, note, button) {
    button.disabled = true;
    try {
      await updateDoc(doc(db, COLLECTION, item.id), { assignment, note });
      state.editingId = null;
      await refresh();
    } catch {
      window.alert("수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      button.disabled = false;
    }
  }

  function renderList() {
    const list = $("list");
    const status = $("list-status");
    list.textContent = "";

    const visible = state.items.filter((item) => {
      if (state.filter !== "전체" && item.assignment !== state.filter) return false;
      if (!state.keyword) return true;
      return (
        item.fileName.toLowerCase().includes(state.keyword) ||
        item.ownerName.toLowerCase().includes(state.keyword) ||
        item.ownerEmail.toLowerCase().includes(state.keyword)
      );
    });

    if (visible.length === 0) {
      list.hidden = true;
      status.hidden = false;
      status.className = "board-status";
      status.textContent = state.items.length === 0
        ? (state.isProfessor ? "아직 제출된 파일이 없습니다." : "아직 제출한 파일이 없습니다. 위에서 올려 보세요.")
        : "조건에 맞는 제출물이 없습니다.";
      return;
    }

    status.hidden = true;
    list.hidden = false;

    visible.forEach((item) => {
      const li = document.createElement("li");
      li.append(item.id === state.editingId ? buildEditRow(item) : buildRow(item));
      list.append(li);
    });
  }

  /* ---------- 화면 ---------- */

  async function refresh() {
    const status = $("list-status");
    try {
      await loadItems();
    } catch {
      $("list").hidden = true;
      status.hidden = false;
      status.className = "board-status board-status-error";
      status.textContent = "목록을 불러오지 못했습니다. 새로고침해 주세요.";
      return;
    }
    renderBilling();
    renderList();
  }

  async function render() {
    $("view-main").hidden = false;
    const signedIn = Boolean(state.user);

    $("gate").hidden = signedIn;
    $("upload").hidden = !signedIn;
    $("listing").hidden = !signedIn;
    $("billing").hidden = !state.isProfessor;
    $("search").hidden = !state.isProfessor;
    $("listing-title").textContent = state.isProfessor ? "전체 제출 내역" : "내 제출 내역";

    if (!signedIn) {
      state.items = [];
      state.queue = [];
      renderQueue();
      return;
    }
    await refresh();
  }

  /* ---------- 시작 ---------- */

  buildAssignmentOptions();

  $("gate-signin").addEventListener("click", signIn);
  $("upload-button").addEventListener("click", runUpload);
  $("drop-sub").textContent = `여러 개를 한 번에 올릴 수 있습니다 · 파일당 최대 ${MAX_FILE_MB}MB`;

  const drop = $("drop");
  const picker = $("field-file");

  drop.addEventListener("click", () => picker.click());
  drop.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      picker.click();
    }
  });
  picker.addEventListener("change", () => {
    addFiles(picker.files);
    picker.value = "";
  });
  ["dragenter", "dragover"].forEach((name) => {
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove("is-over");
    });
  });
  drop.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
  });

  $("filter-assignment").addEventListener("change", (event) => {
    state.filter = event.target.value;
    renderList();
  });
  $("search").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim().toLowerCase();
    renderList();
  });

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isProfessor = isProfessorUser(user);
    renderAccount();
    render();
  });
}

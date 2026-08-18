/**
 * 게시판 동작. 빌드 도구 없이 브라우저에서 Firebase 를 직접 쓴다.
 * 화면 전환은 주소의 해시로 한다.
 *   (없음) = 목록 / #new = 글쓰기 / #edit = 수정 / #p=글ID = 상세
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
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { isProfessorUser } from "../professor.js";

const CATEGORIES = ["자유", "질문", "후기", "상담", "공지"];
const COLLECTION = "posts";
const LIST_LIMIT = 200;

/**
 * 비밀글은 '상담' 분류에서만 쓸 수 있다.
 * Firestore 는 문서 단위로만 권한을 걸 수 있어서 제목만 공개하고 본문만 가릴 수 없다.
 * 그래서 본문을 secrets 컬렉션으로 떼어 두고, posts 에는 제목과 비밀 여부만 남긴다.
 * 목록에는 모두 보이지만 본문은 작성자와 교수만 읽는다.
 */
const SECRET_COLLECTION = "secrets";
const SECRET_CATEGORY = "상담";

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

  const state = {
    user: null,
    isProfessor: false,
    posts: [],
    filter: "전체",
    keyword: "",
    editing: null,
    editingBody: "",
    listLoaded: false,
  };

  /** 이 글의 본문을 볼 수 있는 사람인가. 공개글이면 누구나. */
  function canReadBody(post) {
    if (!post.secret) return true;
    return Boolean(state.user && (state.user.uid === post.authorId || state.isProfessor));
  }

  /* ---------- 로그인 ---------- */

  function renderAccount() {
    const box = $("account");
    box.textContent = "";

    if (!state.user) {
      const button = make("button", "button button-primary", "구글 계정으로 로그인");
      button.type = "button";
      button.addEventListener("click", signIn);
      box.append(button);
      return;
    }

    const who = make("span", "board-me");
    const avatar = make("span", "board-avatar");
    if (state.user.photoURL) avatar.style.backgroundImage = `url(${state.user.photoURL})`;
    else avatar.textContent = (state.user.displayName || "?").slice(0, 1);
    who.append(avatar, make("span", "board-me-name", state.user.displayName || "이름 없음"));

    const out = make("button", "button", "로그아웃");
    out.type = "button";
    out.addEventListener("click", () => signOut(auth));

    box.append(who, out);
  }

  async function signIn() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      if (error.code === "auth/cancelled-popup-request") return;
      window.alert("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  /* ---------- 데이터 ---------- */

  function toPost(id, data) {
    const at = (value) => (value instanceof Timestamp ? value.toDate() : null);
    return {
      id,
      title: String(data.title ?? ""),
      content: String(data.content ?? ""),
      category: CATEGORIES.includes(data.category) ? data.category : "자유",
      authorId: String(data.authorId ?? ""),
      authorName: String(data.authorName ?? "이름 없음"),
      secret: data.secret === true,
      createdAt: at(data.createdAt),
      updatedAt: at(data.updatedAt),
    };
  }

  /** 비밀글의 본문을 가져온다. 권한이 없으면 null 을 돌려준다. */
  async function loadBody(post) {
    if (!post.secret) return post.content;
    if (!canReadBody(post)) return null;
    try {
      const snapshot = await getDoc(doc(db, SECRET_COLLECTION, post.id));
      return snapshot.exists() ? String(snapshot.data().content ?? "") : "";
    } catch {
      return null;
    }
  }

  async function loadPosts() {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(LIST_LIMIT)),
    );
    state.posts = snapshot.docs.map((item) => toPost(item.id, item.data()));
    state.listLoaded = true;
  }

  /* ---------- 목록 ---------- */

  function buildFilters() {
    const box = $("filters");
    ["전체", ...CATEGORIES].forEach((name) => {
      const button = make("button", "", name);
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(name === state.filter));
      button.addEventListener("click", () => {
        state.filter = name;
        [...box.children].forEach((child) => child.setAttribute("aria-selected", String(child === button)));
        renderList();
      });
      box.append(button);
    });
  }

  function renderList() {
    const list = $("list");
    const status = $("list-status");

    const visible = state.posts.filter((post) => {
      if (state.filter !== "전체" && post.category !== state.filter) return false;
      if (!state.keyword) return true;
      return (
        post.title.toLowerCase().includes(state.keyword) ||
        post.content.toLowerCase().includes(state.keyword) ||
        post.authorName.toLowerCase().includes(state.keyword)
      );
    });

    list.textContent = "";

    if (visible.length === 0) {
      list.hidden = true;
      status.hidden = false;
      status.className = "board-status";
      status.textContent = state.posts.length === 0
        ? "아직 등록된 글이 없습니다. 첫 글을 남겨 보세요."
        : "조건에 맞는 글이 없습니다.";
      return;
    }

    status.hidden = true;
    list.hidden = false;

    visible.forEach((post) => {
      const link = document.createElement("a");
      link.href = `#p=${post.id}`;

      const tag = make("span", "board-tag", post.category);
      tag.dataset.category = post.category;

      const main = make("span", "board-row-main");
      const title = make("span", "board-row-title");
      if (post.secret) title.append(make("span", "board-lock", "🔒 비밀글"));
      title.append(document.createTextNode(post.title));
      main.append(
        title,
        make("span", "board-row-excerpt", post.secret
          ? "본문은 작성자와 교수만 볼 수 있습니다."
          : post.content.slice(0, 100)),
      );

      const meta = make("span", "board-row-meta");
      meta.append(make("b", "", post.authorName), document.createTextNode(formatDate(post.createdAt)));

      link.append(tag, main, meta);

      const row = document.createElement("li");
      row.append(link);
      list.append(row);
    });
  }

  /* ---------- 글쓰기 · 수정 ---------- */

  function buildCategoryOptions() {
    CATEGORIES.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      $("field-category").append(option);
    });
  }

  function showFormError(message) {
    const box = $("form-error");
    box.textContent = message;
    box.hidden = !message;
  }

  /** 비밀글 선택칸은 '상담' 분류에서만 보인다. 다른 분류로 바꾸면 선택도 풀린다. */
  function syncSecretField() {
    const on = $("field-category").value === SECRET_CATEGORY;
    $("field-secret").parentElement.hidden = !on;
    if (!on) $("field-secret").checked = false;
  }

  function fillForm(post, body) {
    $("field-category").value = post ? post.category : "자유";
    $("field-title").value = post ? post.title : "";
    $("field-content").value = post ? (body ?? post.content) : "";
    syncSecretField();
    $("field-secret").checked = Boolean(post && post.secret);
    $("form-title").textContent = post ? "글 수정" : "새 글 쓰기";
    $("form-submit").textContent = post ? "수정 완료" : "등록하기";
    showFormError("");
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!state.user) return;

    const title = $("field-title").value.trim();
    const body = $("field-content").value.trim();
    const category = $("field-category").value;
    const secret = category === SECRET_CATEGORY && $("field-secret").checked;

    if (!title || !body) {
      showFormError("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    // 비밀글이면 posts 에는 본문을 남기지 않는다. 목록에 노출되는 문서이기 때문이다.
    const input = { title, category, secret, content: secret ? "" : body };

    const submit = $("form-submit");
    submit.disabled = true;
    showFormError("");

    try {
      const editingId = state.editing;
      let id = editingId;
      if (id) {
        await updateDoc(doc(db, COLLECTION, id), { ...input, updatedAt: serverTimestamp() });
        state.editing = null;
      } else {
        const created = await addDoc(collection(db, COLLECTION), {
          ...input,
          authorId: state.user.uid,
          authorName: state.user.displayName || "이름 없음",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        id = created.id;
      }

      if (secret) {
        try {
          await setDoc(doc(db, SECRET_COLLECTION, id), { content: body, authorId: state.user.uid });
        } catch (error) {
          // 새 글이었다면 본문 없는 껍데기가 남지 않게 되돌린다.
          // 수정 중이었다면 원래 글을 지워서는 안 되므로 그대로 둔다.
          if (!editingId) await deleteDoc(doc(db, COLLECTION, id)).catch(() => {});
          throw error;
        }
      } else if (editingId) {
        // 비밀글을 공개글로 되돌린 경우 떼어 두었던 본문을 지운다.
        // 새 글에는 지울 본문이 애초에 없으므로 건드리지 않는다.
        await deleteDoc(doc(db, SECRET_COLLECTION, id)).catch(() => {});
      }

      await loadPosts();
      window.location.hash = `#p=${id}`;
    } catch {
      showFormError("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      submit.disabled = false;
    }
  }

  /* ---------- 상세 ---------- */

  async function renderPost(id) {
    const article = $("article");
    const status = $("post-status");

    article.hidden = true;
    status.hidden = false;
    status.className = "board-status";
    status.textContent = "글을 불러오는 중입니다…";

    let post = null;
    try {
      const snapshot = await getDoc(doc(db, COLLECTION, id));
      if (snapshot.exists()) post = toPost(snapshot.id, snapshot.data());
    } catch {
      status.className = "board-status board-status-error";
      status.textContent = "글을 불러오지 못했습니다.";
      return;
    }

    if (!post) {
      status.textContent = "글을 찾을 수 없습니다. 삭제되었거나 주소가 잘못되었습니다.";
      return;
    }

    status.hidden = true;
    article.hidden = false;

    $("post-category").textContent = post.category;
    $("post-category").dataset.category = post.category;
    $("post-title").textContent = post.title;

    const edited = post.updatedAt && post.createdAt
      && post.updatedAt.getTime() - post.createdAt.getTime() > 60000 ? " (수정됨)" : "";
    $("post-meta").textContent = `${post.authorName} · ${formatDate(post.createdAt)}${edited}`;

    const lock = $("post-lock");
    lock.hidden = !post.secret;

    const body = await loadBody(post);
    const blocked = body === null;
    const content = $("post-content");
    content.classList.toggle("board-blocked", blocked);
    content.textContent = blocked
      ? "비밀글입니다. 작성자와 담당 교수만 본문을 볼 수 있습니다."
      : body;

    const owner = Boolean(state.user && state.user.uid === post.authorId);
    $("post-owner-actions").hidden = !(owner || state.isProfessor);
    if (!(owner || state.isProfessor)) return;

    // 교수는 지울 수만 있고 남의 글을 고치지는 못한다.
    $("edit-button").hidden = !owner;
    $("edit-button").onclick = () => {
      state.editing = post.id;
      fillForm(post, body);
      window.location.hash = "#edit";
    };

    $("delete-button").disabled = false;
    $("delete-button").onclick = async () => {
      if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
      $("delete-button").disabled = true;
      try {
        if (post.secret) await deleteDoc(doc(db, SECRET_COLLECTION, post.id)).catch(() => {});
        await deleteDoc(doc(db, COLLECTION, post.id));
        await loadPosts();
        window.location.hash = "";
      } catch {
        window.alert("삭제에 실패했습니다.");
        $("delete-button").disabled = false;
      }
    };
  }

  /* ---------- 화면 전환 ---------- */

  async function route() {
    const hash = window.location.hash;
    $("view-list").hidden = true;
    $("view-form").hidden = true;
    $("view-post").hidden = true;

    if (hash.startsWith("#p=")) {
      $("view-post").hidden = false;
      await renderPost(hash.slice(3));
      return;
    }

    if (hash === "#new" || hash === "#edit") {
      // 로그인하지 않았으면 글쓰기 화면에 들어갈 수 없다.
      if (!state.user) {
        window.location.hash = "";
        return;
      }
      if (hash === "#new") {
        state.editing = null;
        fillForm(null);
      }
      $("view-form").hidden = false;
      return;
    }

    state.editing = null;
    $("view-list").hidden = false;

    if (!state.listLoaded) {
      try {
        await loadPosts();
      } catch {
        const status = $("list-status");
        status.hidden = false;
        status.className = "board-status board-status-error";
        status.textContent = "글 목록을 불러오지 못했습니다. 새로고침해 주세요.";
        return;
      }
    }
    renderList();
  }

  /* ---------- 시작 ---------- */

  buildFilters();
  buildCategoryOptions();

  $("search").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim().toLowerCase();
    renderList();
  });

  $("write-link").addEventListener("click", (event) => {
    if (state.user) return;
    event.preventDefault();
    signIn();
  });

  $("field-category").addEventListener("change", syncSecretField);
  syncSecretField();

  $("form").addEventListener("submit", submitForm);
  window.addEventListener("hashchange", route);

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.isProfessor = isProfessorUser(user);
    // 로그인 상태가 바뀌면 볼 수 있는 범위도 바뀌므로 목록을 다시 읽는다.
    state.listLoaded = false;
    renderAccount();
    route();
  });
}

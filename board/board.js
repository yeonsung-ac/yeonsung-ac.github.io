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
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const CATEGORIES = ["자유", "질문", "후기", "공지"];
const COLLECTION = "posts";
const LIST_LIMIT = 200;

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

  const state = { user: null, posts: [], filter: "전체", keyword: "", editing: null, listLoaded: false };

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
      createdAt: at(data.createdAt),
      updatedAt: at(data.updatedAt),
    };
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
      main.append(
        make("span", "board-row-title", post.title),
        make("span", "board-row-excerpt", post.content.slice(0, 100)),
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

  function fillForm(post) {
    $("field-category").value = post ? post.category : "자유";
    $("field-title").value = post ? post.title : "";
    $("field-content").value = post ? post.content : "";
    $("form-title").textContent = post ? "글 수정" : "새 글 쓰기";
    $("form-submit").textContent = post ? "수정 완료" : "등록하기";
    showFormError("");
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!state.user) return;

    const input = {
      title: $("field-title").value.trim(),
      content: $("field-content").value.trim(),
      category: $("field-category").value,
    };
    if (!input.title || !input.content) {
      showFormError("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    const submit = $("form-submit");
    submit.disabled = true;
    showFormError("");

    try {
      let id = state.editing;
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
    $("post-content").textContent = post.content;

    const owner = Boolean(state.user && state.user.uid === post.authorId);
    $("post-owner-actions").hidden = !owner;
    if (!owner) return;

    $("edit-button").onclick = () => {
      state.editing = post.id;
      fillForm(post);
      window.location.hash = "#edit";
    };

    $("delete-button").onclick = async () => {
      if (!window.confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
      $("delete-button").disabled = true;
      try {
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

  $("form").addEventListener("submit", submitForm);
  window.addEventListener("hashchange", route);

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    renderAccount();
    route();
  });
}

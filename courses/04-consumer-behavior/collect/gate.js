/* 소비자행동론 - 수업용 잠금
 *
 * 주의: 정적 호스팅에서 브라우저로 하는 확인은 소스를 열면 우회할 수 있다.
 * 이 잠금은 '수강생만 쓰세요' 라는 문패이지, 보안 장치가 아니다.
 * 실질적인 차단은 프록시(Worker) 쪽에서 같은 비밀번호를 요구해 이뤄진다.
 *
 * 비밀번호를 바꾸려면:  python tools/make_password_hash.py "새비밀번호"
 * 출력된 해시를 아래 PASSWORD_SHA256 에 붙여넣는다. 빈 값이면 잠금은 꺼진다.
 */
const GATE = {
  PASSWORD_SHA256: "9552e277ebcc7fa191292c6e900d94dfe6e837d8abf76a2da927d4530d2c8f69",
  STORE_KEY: "cb-gate-2026",
  TITLE: "소비자행동론 수업 자료",
  HINT: "수업 시간에 안내한 비밀번호를 입력하세요.",
};

/** 입력한 비밀번호를 프록시 요청에도 실어 보내기 위해 보관한다. */
let GATE_SECRET = null;
const gateSecret = () => GATE_SECRET || sessionStorage.getItem(GATE.STORE_KEY + "-s") || "";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function lockScreen() {
  document.documentElement.style.overflow = "hidden";
  const wrap = document.createElement("div");
  wrap.className = "gate";
  wrap.innerHTML = `
    <form class="gate-card" autocomplete="off">
      <p class="gate-kicker">04 / 소비자행동론</p>
      <h1>${GATE.TITLE}</h1>
      <p class="gate-hint">${GATE.HINT}</p>
      <label class="sr-only" for="gate-pw">비밀번호</label>
      <input id="gate-pw" type="password" inputmode="text" autocomplete="current-password" placeholder="비밀번호">
      <p class="gate-error" id="gate-error" hidden>비밀번호가 맞지 않습니다.</p>
      <button type="submit">들어가기</button>
      <p class="gate-foot">연성대학교 경영학과 이현구 · 수업 목적 외 사용을 금합니다.</p>
    </form>`;
  document.body.appendChild(wrap);

  const input = wrap.querySelector("#gate-pw");
  const err = wrap.querySelector("#gate-error");
  input.focus();

  wrap.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    if (await sha256Hex(value) !== GATE.PASSWORD_SHA256) {
      err.hidden = false;
      input.select();
      return;
    }
    GATE_SECRET = value;
    sessionStorage.setItem(GATE.STORE_KEY, "1");
    sessionStorage.setItem(GATE.STORE_KEY + "-s", value);
    wrap.remove();
    document.documentElement.style.overflow = "";
    document.dispatchEvent(new CustomEvent("gateopen"));
  });
}

/** head 에서 부른다. 잠긴 상태면 본문이 잠깐이라도 보이지 않도록 즉시 가린다. */
(function initGate() {
  if (!GATE.PASSWORD_SHA256) return; // 잠금 꺼짐
  if (sessionStorage.getItem(GATE.STORE_KEY) === "1") {
    GATE_SECRET = sessionStorage.getItem(GATE.STORE_KEY + "-s");
    return;
  }
  document.documentElement.classList.add("gating");
  const open = () => {
    lockScreen();
    document.addEventListener("gateopen", () => document.documentElement.classList.remove("gating"), { once: true });
  };
  if (document.body) open();
  else document.addEventListener("DOMContentLoaded", open);
})();

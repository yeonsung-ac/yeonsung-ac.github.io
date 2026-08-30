(() => {
  const ACCESS_CODE = "0909";
  const ACCESS_KEY = "advertising-course-access";
  const body = document.body;
  const gate = document.querySelector("#gate");
  const courseSite = document.querySelector("#course-site");
  const form = document.querySelector("#gate-form");
  const input = document.querySelector("#access-code");
  const error = document.querySelector("#gate-error");
  const exitButton = document.querySelector("#exit-button");

  function unlock() {
    sessionStorage.setItem(ACCESS_KEY, "granted");
    body.classList.remove("locked");
    gate.hidden = true;
    courseSite.setAttribute("aria-hidden", "false");
  }

  function lock() {
    sessionStorage.removeItem(ACCESS_KEY);
    body.classList.add("locked");
    gate.hidden = false;
    courseSite.setAttribute("aria-hidden", "true");
    input.value = "";
    error.textContent = "";
    input.focus();
    window.scrollTo(0, 0);
  }

  if (sessionStorage.getItem(ACCESS_KEY) === "granted") unlock();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value === ACCESS_CODE) {
      unlock();
      document.querySelector("#page-title").focus?.();
      return;
    }
    error.textContent = "확인 숫자가 맞지 않습니다.";
    input.select();
  });

  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
    error.textContent = "";
  });

  exitButton.addEventListener("click", lock);
})();

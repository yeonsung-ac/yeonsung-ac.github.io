/**
 * 스팀 리뷰 프록시 - Cloudflare Worker
 *
 * 스팀 API 는 Access-Control-Allow-Origin 헤더를 보내지 않아서 브라우저에서
 * 직접 부를 수 없다. 이 워커가 대신 불러다 CORS 헤더를 붙여 돌려준다.
 *
 * 배포 방법은 같은 폴더의 README.md 를 볼 것.
 */

// 이 주소에서 오는 요청만 받는다. 새 주소를 쓰려면 여기에 추가한다.
const ALLOWED_ORIGINS = [
  "https://yeonsung-ac.github.io",
];

// 로컬 개발용 (http://localhost:8000 등) 은 패턴으로 허용한다.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// 수업용 열쇠. gate.js 의 PASSWORD_SHA256 과 같은 값이어야 한다.
// 빈 문자열로 두면 열쇠 검사를 하지 않는다.
const KEY_SHA256 = "9552e277ebcc7fa191292c6e900d94dfe6e837d8abf76a2da927d4530d2c8f69";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UPSTREAM = {
  appreviews: "https://store.steampowered.com/appreviews/",
  appdetails: "https://store.steampowered.com/api/appdetails",
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function isAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin || "*") },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isAllowed(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return json({ error: "GET 요청만 받습니다." }, 405, origin);
    }
    if (!isAllowed(origin)) {
      return json({ error: "허용되지 않은 출처입니다.", origin }, 403, origin || "*");
    }

    // 수업용 열쇠 확인. 화면 잠금만으로는 막을 수 없는 실제 사용을 여기서 막는다.
    if (KEY_SHA256) {
      const key = url.searchParams.get("key") || "";
      if (!key || (await sha256Hex(key)) !== KEY_SHA256) {
        return json({ error: "수업용 비밀번호가 필요합니다." }, 401, origin);
      }
    }

    const segments = url.pathname.split("/").filter(Boolean);
    let target;

    if (segments[0] === "appreviews") {
      const appid = segments[1];
      if (!/^\d+$/.test(appid || "")) {
        return json({ error: "앱 번호는 숫자여야 합니다." }, 400, origin);
      }
      target = new URL(UPSTREAM.appreviews + appid);
      // json=1 은 항상 강제한다.
      target.searchParams.set("json", "1");
      for (const [k, v] of url.searchParams) {
        if (k !== "json" && k !== "key") target.searchParams.set(k, v);
      }
    } else if (segments[0] === "appdetails") {
      const appids = url.searchParams.get("appids") || "";
      if (!/^\d+$/.test(appids)) {
        return json({ error: "appids 는 숫자여야 합니다." }, 400, origin);
      }
      target = new URL(UPSTREAM.appdetails);
      target.searchParams.set("appids", appids);
      target.searchParams.set("l", url.searchParams.get("l") || "korean");
      target.searchParams.set("filters", "basic");
    } else {
      return json({ error: "지원하지 않는 경로입니다.", path: url.pathname }, 404, origin);
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        headers: { "Accept": "application/json", "User-Agent": "yeonsung-consumer-behavior/1.0" },
        cf: { cacheTtl: 600, cacheEverything: true },
      });
    } catch (err) {
      return json({ error: "스팀 서버에 연결하지 못했습니다.", detail: String(err) }, 502, origin);
    }

    if (!upstream.ok) {
      return json({ error: `스팀 응답 오류 (HTTP ${upstream.status})` }, upstream.status, origin);
    }

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
        ...corsHeaders(origin),
      },
    });
  },
};

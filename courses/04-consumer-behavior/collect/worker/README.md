# 스팀 리뷰 프록시 배포하기

스팀 API 는 브라우저에서 직접 부를 수 없다(CORS 헤더를 안 보낸다). 이 워커를
한 번 올려 두면 분석기에서 앱 번호로 실시간 조회가 열린다. **무료 요금제로
충분하고 카드 등록이 필요 없다** (하루 10만 요청).

## 1. 계정 만들기

<https://dash.cloudflare.com/sign-up> 에서 가입한다. 도메인은 필요 없다.

## 2. 워커 만들기

1. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Start with Hello World!** 선택
2. 이름을 `steam-proxy` 로 하고 **Deploy** 를 누른다 (기본 코드 그대로 일단 배포)
3. 배포가 끝나면 **Edit code** 를 눌러 편집기를 연다
4. 편집기의 내용을 전부 지우고 이 폴더의 `steam-proxy.js` 를 통째로 붙여넣는다
5. 오른쪽 위 **Deploy** 를 누른다

## 3. 주소 확인

배포 후 이런 주소가 생긴다.

```
https://steam-proxy.<계정이름>.workers.dev
```

브라우저에서 아래를 열어 JSON 이 나오면 성공이다. (Origin 없이 직접 열면
403 이 정상이다 — 분석기 페이지에서만 동작하도록 막아 둔 것이다.)

```
https://steam-proxy.<계정이름>.workers.dev/appreviews/730?num_per_page=1
```

## 4. 분석기에 연결

`courses/04-consumer-behavior/app.js` 맨 위를 고친다.

```js
const CONFIG = {
  PROXY_BASE: "https://steam-proxy.<계정이름>.workers.dev",
};
```

커밋하고 push 하면 실시간 수집이 열린다. 비워 두면 분석기는 샘플 데이터와
파일 업로드만으로 계속 동작한다.

## 접근 제한

`steam-proxy.js` 의 `ALLOWED_ORIGINS` 에 적힌 주소에서만 응답한다. 기본값은
`https://yeonsung-ac.github.io` 이고, `localhost` 는 개발용으로 허용돼 있다.
다른 곳에서 쓰려면 배열에 추가하고 다시 Deploy 한다.

## 지원 경로

| 경로 | 하는 일 |
|---|---|
| `/appreviews/<앱번호>` | 리뷰 조회. 스팀의 질의 변수를 그대로 넘긴다 |
| `/appdetails?appids=<앱번호>` | 게임 이름·출시일 등 기본 정보 |

## 비용

무료 요금제는 **하루 10만 요청, 요청당 CPU 10ms** 까지다. 이 워커는 스팀 응답을
그대로 넘기기만 해서 CPU 를 거의 안 쓴다. 수업에서 학생 40명이 각자 5,000건씩
(=50회 요청) 수집해도 하루 2,000 요청이다. 한도에 닿을 일이 없다.

응답은 10분간 캐시된다. 같은 게임을 여러 학생이 조회하면 그만큼 요청이 줄어든다.

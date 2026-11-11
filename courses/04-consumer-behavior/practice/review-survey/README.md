# 소비자행동론 — 온라인 제품 리뷰의 정보 유용성 조사

한국어 설문·관리자 대시보드 전체 프로젝트입니다. 별도 운영 서버 없이 Firebase Authentication, Firestore와 GitHub Pages 또는 Firebase Hosting으로 운영합니다.

## 현재 수업용 배치

- 제11장 연습문제: `https://yeonsung-ac.github.io/courses/04-consumer-behavior/practice/consumer-behavior-ch11.html`
- 위 페이지 아래쪽에 설문을 삽입합니다. 기존 핵심 해설 20개와 연습문제 15개는 보존합니다.
- 설문: 위 디렉터리의 `review-survey/index.html`
- 큰 QR: `review-survey/qr.html`
- 관리자: `review-survey/admin.html`

## 최종 적용된 요청

수업 중 한 번에 진행하므로 **참여코드 없이 익명 응답**이 기본입니다. 관리자 화면에서 참여코드 방식을 선택할 수도 있습니다. 같은 설문 익명 ID의 중복 제출은 서버에서 막습니다. 브라우저 저장소 삭제·다른 기기·시크릿 창으로 새 ID를 만들면 동일인 재참여를 식별할 수 없습니다. 이 한계는 코드 없는 익명 조사의 특성입니다.

기존 수업 로그인과 설문 인증은 별도 Firebase 앱 이름(`review-survey-student`)을 사용합니다. 이름·학번·수업 로그인 UID를 설문으로 전달하거나 저장하지 않습니다. 응답에는 기술적 익명 UID와 시각이 저장되므로 완전한 비연결성을 보장하는 연구용 익명화 시스템은 아닙니다. 공개 대시보드는 없으며 교수자만 원자료를 읽습니다. 자유입력에 개인정보를 적지 않도록 안내합니다.

## 폴더 구조

```text
review-survey/
├─ public/
│  ├─ index.html          학생 설문
│  ├─ admin.html          교수자 로그인·통계·운영
│  ├─ qr.html             강의실용 큰 QR 화면
│  ├─ setup.html          브라우저별 연결 설정
│  ├─ config.js           공개 Firebase 설정과 교수 이메일
│  ├─ styles.css, qr.css
│  └─ modules/
│     ├─ firebase.js      익명·관리자 인증 및 SDK 연결
│     ├─ student.js       검증·진행률·확인·원자 제출
│     ├─ admin.js         실시간 집계·그래프·다운로드·운영
│     ├─ stats.js         평균·표본SD·공동순위·상관·CSV
│     ├─ demo.js          서버 저장 없는 시연 응답
│     ├─ setup.js         연결 설정 입력
│     └─ qr-page.js       QR PNG·전체화면·인쇄
├─ firestore.rules        설문 단독 보안 규칙
├─ firestore.existing.rules  배포 전 기존 수업 규칙 백업
├─ firestore.merged.rules    기존 규칙을 보존한 병합본
├─ firebase.json
├─ package.json, package-lock.json
├─ scripts/serve.mjs
└─ tests/                 통계·권한·동시 제출 검증
```

## 로컬 실행

Node.js 22 LTS 이상을 권장합니다. 런타임은 정적 HTML/JS이므로 운영용 npm 설치는 필요 없습니다.

```sh
npm start
```

`http://127.0.0.1:8522/`를 엽니다. 시연은 `index.html?demo=1`, `admin.html?demo=1`입니다. 시연 화면에 표시되는 9건은 Firebase에 저장되지 않고 실제 데이터와 섞이지 않습니다. 기본 설문에는 코드 입력이 없습니다. 설정이 없으면 안내만 표시하며 가짜 성공 제출은 하지 않습니다. `file://`로 직접 열지 마세요.

## Firebase 설정

1. Firebase Console에서 프로젝트를 선택하고 웹 앱을 등록합니다.
2. Authentication → 로그인 방법에서 **익명**, **Google**을 활성화합니다. 이메일 로그인을 사용할 경우 **이메일/비밀번호**도 활성화합니다.
3. Authentication → 설정 → 승인된 도메인에 GitHub Pages 도메인과 로컬 테스트 도메인을 등록합니다.
4. Firestore Database를 생성합니다. 리전은 수업 환경에 맞게 선택합니다.
5. 웹 앱의 `firebaseConfig`를 `public/config.js`에 입력합니다. 이 설정은 공개 식별자입니다. 서비스 계정 비밀키·관리자 비밀번호를 넣지 마세요.
6. 관리자 설정은 아래 두 방법 중 하나를 사용합니다.
   - UID 허용 목록: Auth에서 관리자 계정을 생성하고, Firestore Console에 `reviewSurveyAdmins/{UID}` 문서를 추가합니다. 예: `{role: "admin"}`. 브라우저에서는 이 허용 목록을 생성할 수 없습니다.
   - 기존 수업 교수 계정: `professorEmails`와 규칙의 `reviewProfessor()`를 동일한 이메일로 설정합니다. 이메일 인증이 확인된 계정만 인정합니다. 현재 수업용은 기존 교수 이메일 한 개만 사용합니다.
7. 규칙을 게시하고 관리자 화면에 로그인합니다. 처음에는 접수가 종료된 상태이며 목표는 15명입니다. **조사 시작**을 누르면 학생이 제출할 수 있습니다. 수업용 배포 작업에서 별도로 초기 접수를 열 수 있습니다.

`setup.html`의 설정 입력은 현재 브라우저에만 저장됩니다. 학생들에게 배포하려면 반드시 `config.js`를 배포본에 포함하세요. 설정 입력은 JSON 또는 Firebase Console의 큰따옴표 객체 리터럴을 받으며 `eval()`을 사용하지 않습니다.

### 기존 프로젝트 규칙 보존

Firebase에 규칙을 배포하면 파일 전체가 교체됩니다. 기존 수업 프로젝트에서 `firestore.rules` 단독본을 바로 게시하지 마세요. 기존 게시 규칙을 백업하고 그 문서 경로 안에 설문 전용 경로·함수를 추가한 **병합본**을 사용합니다. `firestore.merged.rules`가 이 수업 프로젝트용 병합본입니다. 다른 프로젝트에 이 수업 전체 규칙을 복사하지 마세요.

## Firestore 구조

```text
reviewSurveyAdmins/{관리자 UID}
reviewSurveys/online-reviews
  isOpen: boolean
  target: integer (기본 15, 1~100)
  issued: integer (코드 발급 수)
  codeRequired: boolean (기본 false)
  activeRound: 조사 회차 UUID 문자열
  updatedAt: timestamp
  responses/{submissionKey}
    answers: {q1:1..7, ..., q12:1..7}
    otherText: string (0~300자)
    participantNo: 익명 표시 번호
    submissionKey, round, kind: live 또는 test
    uid: 설문 전용 Firebase 익명 UID
    createdAt: 서버 timestamp
  receipts/{회차_UID}        코드 없는 방식의 접수증, 점수 없음
    uid, round, participantNo, createdAt
  codes/{참여코드 SHA-256}   선택적 코드 방식
    participantNo, kind, round, used, usedBy, usedAt
  codeSecrets/{해시}         관리자만 보는 원문 코드
```

학생은 설정과 자신의 접수증만 읽을 수 있습니다. 선택적 코드 모드에서는 알고 있는 코드 문서 한 개만 조회할 수 있고 목록은 금지됩니다. 응답 점수는 제출자 본인에게도 재조회 권한을 주지 않습니다. 제출 전 확인 화면은 클라이언트의 선택값으로 만듭니다.

코드 없는 방식은 응답과 접수증을 트랜잭션으로 함께 생성합니다. 코드 방식은 응답 생성과 코드 사용 처리를 트랜잭션으로 함께 처리합니다. 규칙의 `getAfter()`가 동반 쓰기와 UID·회차·유형·서버시각을 검사합니다. 제출 후 응답 수정은 관리자도 금지됩니다. 관리자에게 삭제만 허용합니다.

## 수업 운영

1. 관리자 로그인 → 기본 모드 **코드 없이 익명** 확인 → 조사 시작.
2. **QR코드 크게 보기** 또는 `qr.html`을 강의실 화면에 띄웁니다. 전체화면·PNG 저장·인쇄를 지원합니다.
3. 학생이 QR 스캔 → 이름·학번 없이 12문항 응답 → 확인 → 최종 제출.
4. 교수자 대시보드에서 실시간 완료 인원·미응답·응답률·통계 확인.
5. 조사 종료를 누르면 새 제출을 서버에서 거절합니다. 제출 확인창을 열어 두었던 학생도 종료 후에는 제출할 수 없습니다.
6. Excel/CSV/그래프를 저장합니다. 전체 초기화는 `전체 초기화`를 직접 입력해야 실행되며 먼저 접수를 닫습니다.

QR에 `localhost`나 `127.0.0.1`이 들어가면 학생 휴대폰에서는 접속할 수 없습니다. **배포된 HTTPS 주소의 QR 화면**을 사용하세요. QR은 브라우저에서 로컬 생성하며 외부 QR 서비스에 설문 주소를 전송하지 않습니다.

### 참여코드 옵션

접수 종료·응답 0건 상태에서 **개별 참여코드 사용**을 체크합니다. 실제 참여코드 생성으로 목표 인원만큼 128비트 무작위 코드를 발급합니다. CSV로 내려받아 각 학생에게 하나씩 배부합니다. 평가는 익명 참여번호로만 표시됩니다. 학생이 자기 코드를 타인에게 전달하는 것까지 막지는 않습니다.

### 테스트 데이터

관리자에서 테스트 코드 3개와 샘플 응답을 생성할 수 있습니다. `kind:test`는 실제 통계·응답률·원자료 내보내기에 포함되지 않습니다. **테스트 데이터 삭제**는 테스트 코드·테스트 응답만 지웁니다. 실제 응답 전체 삭제는 별도의 재확인을 요구합니다.

## 통계 정의와 해석

- 모든 계산은 현재 회차의 `kind:live`이며 12문항이 모두 1~7 정수인 제출만 사용합니다.
- 총점, 평균, 표본 표준편차(`n−1`), 최솟값·최댓값·n을 계산합니다. 0명 평균과 1명 표준편차는 `—`로 표시합니다.
- Q1~Q11 평균이 높을수록 상위입니다. 동점은 공동 경쟁 순위(1,1,3)입니다. 반올림 전 값으로 비교합니다.
- Q12는 중요성 지표이며 Q1~Q11 순위에 넣지 않습니다.
- 개인별 Q1~Q11 평균과 Q12 사이 피어슨 r을 계산합니다. n<3 또는 한 변수의 분산이 0이면 계산하지 않고 이유를 표시합니다. 통계적 유의성 검정이나 인과 효과 추정은 제공하지 않습니다.
- 미국 2018년 수치는 사용자 제공 교재의 비율입니다. 7점 척도와 크기를 직접 비교하지 않고 순위만 탐색적으로 비교합니다. 동점의 영향도 주의해야 합니다.
- 소규모 수업 편의표본이므로 모집단에 일반화하지 않습니다.
- 목표 인원은 코드 없는 모드에서 진행률 기준이며, 강제적인 응답 상한은 아닙니다. 다른 기기 참여를 서버에서 동일인으로 구별하지 않습니다.

## 다운로드

- 원자료 CSV: 익명 참여번호, Q1~Q12, 개인평균, 기타 설명, 한국 시각.
- 요약 CSV: 총점·평균·표본SD·최솟값·최댓값·n·공동순위.
- Excel: 원자료 / 요약 통계 / 미국 순위 비교 / 중요성 분포 / 해석 안내.
- PNG: 흰 배경의 그래프 4종. QR도 고해상도 PNG.
- 인쇄: 분석 결과 또는 큰 QR 화면을 브라우저의 PDF 저장으로 출력.
- 원자료 내보내기에 인증 UID·원문 참여코드는 포함하지 않습니다. 참여코드 배부용 CSV는 별도입니다.
- CSV 자유입력의 수식 시작 문자를 중화하고 HTML은 `textContent`로 표시합니다.

## 배포

### GitHub Pages

`public/`의 내용 전체를 사이트의 원하는 하위 디렉터리에 복사합니다. 이 수업에서는 `courses/04-consumer-behavior/practice/review-survey/`입니다. 상대경로를 사용하므로 하위 디렉터리에서 동작합니다. GitHub Pages가 연결된 브랜치에 커밋하고 배포 완료를 확인합니다. Firestore 규칙은 GitHub에 커밋하는 것만으로 적용되지 않으므로 Firebase Console에도 별도로 게시해야 합니다.

### Firebase Hosting (새 전용 프로젝트)

```sh
npm install
npx firebase login
npx firebase use --add
npx firebase deploy --only hosting,firestore:rules
```

기존 공유 Firebase 프로젝트에서는 위 명령으로 단독 규칙을 덮어쓰지 마세요. 먼저 `firebase.json`의 rules 경로를 검토한 병합본으로 바꿉니다.

## 검증

```sh
npm install
npm test
npm run test:rules
```

Firestore 에뮬레이터에는 Java 21 이상이 필요합니다. 실제 프로젝트에 연결하지 않는 `demo-review-survey`를 사용합니다. 테스트는 익명 열람 차단, 코드 원자 소모, 제출 후 변경 거절, 범위·누락·타인 UID·회차 위조, 종료 후 제출 거절, 코드 동시 제출, 코드 없는 원자 제출·중복 방지·접수증 접근, 검증된 교수 이메일 등을 검사합니다.

병합본 검사는 PowerShell에서 `$env:TEST_MERGED='1'; npm run test:rules`입니다. 에뮬레이터 테스트 데이터는 운영 Firestore에 저장하지 않습니다.

## 라이브러리와 공식 문서

Firebase Web SDK 12.5.0, Chart.js 4.5.1, SheetJS CE 0.20.3, qrcode-generator 1.4.4를 고정 버전 CDN으로 사용합니다. 그래프와 Excel 라이브러리를 불러오지 못하면 안내하고 CSV·통계표는 계속 사용할 수 있습니다. 실시간 조사에는 인터넷이 필요합니다.

- Firebase 트랜잭션: https://firebase.google.com/docs/firestore/manage-data/transactions
- 보안 규칙 조건: https://firebase.google.com/docs/firestore/security/rules-conditions
- Chart.js 플러그인: https://www.chartjs.org/docs/latest/developers/plugins.html
- SheetJS 공식 CDN: https://docs.sheetjs.com/docs/getting-started/installation/standalone/

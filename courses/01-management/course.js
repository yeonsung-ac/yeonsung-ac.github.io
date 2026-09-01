/**
 * 경영학원론 · 과목 설정
 *
 * 움직이는 몸통은 ../_class/class.js 에 있다. 여기에는 이 과목에서만
 * 달라지는 것만 둔다. 다른 과목을 붙일 때도 이 파일만 새로 쓰면 된다.
 *
 * id 는 서버에 자료를 담는 이름의 앞머리다. mgmt_quizzes, mgmt_intros 처럼
 * 붙으므로, 한 번 정하면 바꾸지 않는다. 바꾸면 이미 낸 자료를 못 읽는다.
 */
window.COURSE = {
  id: "mgmt",
  name: "경영학원론",
  pass: "0909",
  url: "https://yeonsung-ac.github.io/courses/01-management/",

  intro: {
    title: "자기소개",
    button: "자기소개 모아보기",
    max: 500,
    prompt: "",
    fields: [
      { label: "자기소개 및 사진 설명을 간략하게 하세요.",
        ph: "어떤 사진인지, 그리고 자신을 짧게 소개해 주세요." },
    ],
  },

  films: [
    { v: "Ms46Os7YDOU", t: "경영학이란?" },
    { v: "F5ssIeGTQRw", t: "기업이란?" },
    { v: "mrqMTf_mxQE", t: "시장이란 무엇인가?" },
    { v: "3rTdcbIeaqE", t: "고객과 소비자에 대한 이해" },
    { v: "aSrDWh-61Gg", t: "시장과 고객에 대한 접근" },
    { v: "cnCaVcOEPP0", t: "동기부여와 리더십" },
    { v: "lD-CYKQug9k", t: "인적자원관리" },
    { v: "Yl3SX1CfsQQ", t: "조직의 이해와 설계" },
    { v: "CBhGGjzyoGM", t: "금융시스템과 증권시장" },
    { v: "ciev4GvU4gM", t: "회계와 재무의 이해" },
    { v: "rV7JOPq532o", t: "경영 전략의 이해" },
    { v: "1BAEEq-wj5s", t: "글로벌 경영" },
    { v: "1yBLCXtmRC4", t: "기업윤리와 책임" },
  ],
};

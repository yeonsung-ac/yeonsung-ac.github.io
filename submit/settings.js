/**
 * 제출함에서 교수가 직접 손보는 값들. 이 파일만 고치면 된다.
 * 고친 뒤 main 브랜치에 push 하면 몇 분 안에 사이트에 반영된다.
 */

/** 과제 목록. 위에서부터 순서대로 보인다. 학기 중에 자유롭게 추가·삭제한다. */
export const ASSIGNMENTS = [
  "1차 과제",
  "2차 과제",
  "3차 과제",
  "기말 프로젝트",
];

/** 파일 하나의 최대 크기(MB). storage.rules 의 값과 반드시 같아야 한다. */
export const MAX_FILE_MB = 50;

/** 교수 UID 는 사이트 전체가 professor.js 하나를 본다. */
export { PROFESSOR_UID } from "../professor.js";

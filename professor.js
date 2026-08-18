/**
 * 교수 계정의 구글 이메일. 사이트 전체가 이 파일 하나를 본다.
 *
 * 이 주소로 로그인하면
 *   - 게시판(/board/)에서 학생이 올린 비밀글을 볼 수 있고
 *   - 제출함(/submit/)에서 모든 학생의 제출물을 볼 수 있다.
 *
 * 여러 개를 넣어도 된다. 학교 계정과 개인 지메일을 번갈아 쓴다면 둘 다 적어
 * 두면 어느 쪽으로 로그인해도 교수로 인정된다.
 *
 * ⚠ firestore.rules 와 storage.rules 의 isProfessor() 안에도 같은 주소가
 *   적혀 있다. 여기만 고치면 화면은 바뀌지만 서버가 막으므로, 규칙 두 파일도
 *   함께 고치고 Firebase 콘솔에 다시 게시해야 한다.
 */
export const PROFESSOR_EMAILS = [
  "dasahee@yeonsung.ac.kr",
];

/**
 * 로그인한 사람이 교수인가.
 * 구글이 확인해 준 이메일만 인정한다. emailVerified 를 빼면 다른 로그인 수단으로
 * 교수 주소를 사칭할 여지가 생긴다.
 */
export function isProfessorUser(user) {
  return Boolean(user && user.emailVerified && PROFESSOR_EMAILS.includes(user.email));
}

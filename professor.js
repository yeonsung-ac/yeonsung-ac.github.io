/**
 * 교수 계정의 Firebase UID. 사이트 전체가 이 파일 하나를 본다.
 *
 * 이 UID 로 로그인하면
 *   - 게시판(/board/)에서 학생이 올린 비밀글을 볼 수 있고
 *   - 제출함(/submit/)에서 모든 학생의 제출물을 볼 수 있다.
 *
 * 값은 Firebase 콘솔 > Authentication > 사용자 탭의 '사용자 UID' 열에서 복사한다.
 * 비워 두면 아무도 전체를 못 볼 뿐, 나머지 기능은 정상 동작한다.
 *
 * ⚠ firestore.rules 와 storage.rules 의 PASTE_PROFESSOR_UID_HERE 도
 *   반드시 같은 값으로 바꾸고 콘솔에 게시해야 한다. 한 곳이라도 빠지면
 *   목록은 보이는데 파일이 안 열리는 식으로 어긋난다.
 */
export const PROFESSOR_UID = "";

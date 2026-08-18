/**
 * Firebase 설정값. 게시판과 같은 프로젝트(yeonsung-ac)를 쓰지만
 * 제출함이 게시판에 의존하지 않도록 파일은 따로 둔다.
 * 이 값들은 브라우저에 공개되는 식별자라 비밀번호가 아니다.
 * 실제 보안은 firestore.rules 와 storage.rules 가 담당한다.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCwZFjHzwQ58u28L1VMzQYgQqPmvkZOZHQ",
  authDomain: "yeonsung-ac.firebaseapp.com",
  projectId: "yeonsung-ac",
  storageBucket: "yeonsung-ac.firebasestorage.app",
  messagingSenderId: "448819895703",
  appId: "1:448819895703:web:c0b4258f785cd242f7f8d2",
};

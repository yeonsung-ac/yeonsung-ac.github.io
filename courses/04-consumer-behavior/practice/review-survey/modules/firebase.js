import {firebaseConfig as fileConfig} from '../config.js';
export const SDK='https://www.gstatic.com/firebasejs/12.5.0/';
export function configuration(){
 let local=null;
 try {local=JSON.parse(localStorage.getItem('reviewSurveyFirebase')||'null');}catch{}
 return local?.projectId?local:fileConfig;
}
export const configured=()=>Boolean(configuration().apiKey && configuration().projectId && configuration().appId);
const connections={};
export async function connect(role='admin'){
 if(connections[role])return connections[role];
 if(!configured())throw new Error('Firebase 연결 설정이 필요합니다.');
 connections[role]=(async()=>{
  const [appSDK,A,F]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);
  // 학생·관리자·기존 수업 로그인의 인증 저장 영역을 서로 분리합니다.
  const app=role==='student'?appSDK.initializeApp(configuration(),'review-survey-student'):appSDK.initializeApp(configuration()); const auth=A.getAuth(app),db=F.getFirestore(app);
  await auth.authStateReady();
  return {A,F,auth,db};
 })();return connections[role];
}
export async function studentConnection(){const c=await connect('student');if(!c.auth.currentUser)await c.A.signInAnonymously(c.auth);return c;}
export const SURVEY='reviewSurveys/online-reviews';
export function normalizeCode(s){return s.toUpperCase().replace(/[\s-]/g,'');}
export async function hashCode(s){const data=new TextEncoder().encode(normalizeCode(s));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');}
export function randomCode(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
export const prettyCode=c=>c.match(/.{1,4}/g).join('-');
export function errorText(e){
 const code=e?.code||'';
 if(code==='permission-denied')return '권한이 없거나 참여코드를 사용할 수 없습니다. 관리자에게 확인해 주세요.';
 if(code.includes('network')||code==='unavailable')return '네트워크 연결을 확인해 주세요. 제출 성공 여부를 확인한 뒤 다시 시도해 주세요.';
 if(code==='auth/operation-not-allowed')return 'Firebase Authentication에서 익명 또는 이메일 로그인을 활성화해 주세요.';
 if(code==='auth/unauthorized-domain')return '현재 도메인을 Firebase Authentication의 승인된 도메인에 등록해 주세요.';
 if(code==='auth/invalid-credential')return '이메일 또는 비밀번호를 확인해 주세요.';
 return e?.message||'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

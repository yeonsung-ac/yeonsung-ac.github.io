import {KEYS} from './stats.js';
// Firebase에 저장하지 않는 시연 전용 응답입니다. analyze는 live만 집계하므로
// 데모 화면에서만 별도 배열을 live로 변환하여 전달합니다.
export const demoConfig={isOpen:true,target:15,activeRound:'demo-round',codeRequired:false};
export function demoRows(){return Array.from({length:9},(_,i)=>({kind:'live',round:'demo-round',participantNo:`시연-${String(i+1).padStart(2,'0')}`,answers:Object.fromEntries(KEYS.map((k,j)=>[k,Math.max(1,Math.min(7,7-Math.floor(j/3)+(i%3)-1-(i===3?2:0)))])),otherText:i===0?'포장과 배송 상태':'',createdAt:Date.UTC(2026,10,11,3,i)}));}

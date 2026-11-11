export const ITEMS = ['제품 성능에 관한 리뷰','구매자의 만족을 표현한 리뷰','시간 경과 후 제품 품질에 관한 리뷰','제품 품질에 관한 리뷰','제품 설명의 정확도에 관한 리뷰','구체적인 질문에 답하는 리뷰','가격 대비 가치에 관한 리뷰','제품 사용에 대한 조언을 담은 리뷰','기대 이상의 경험을 표현한 리뷰','구매 이유에 관한 리뷰','기타 정보를 담은 리뷰','제품 리뷰의 전반적 중요성'];
export const US = [60,54,52,50,48,43,39,33,26,18,5];
export const USEFUL = ['전혀 유용하지 않다','유용하지 않다','별로 유용하지 않다','보통이다','약간 유용하다','유용하다','매우 유용하다'];
export const IMPORTANT = ['전혀 중요하지 않다','중요하지 않다','별로 중요하지 않다','보통이다','약간 중요하다','중요하다','매우 중요하다'];
export const KEYS = Array.from({length:12},(_,i)=>`q${i+1}`);
export const score = v => Number.isInteger(v) && v>=1 && v<=7;
export function validResponse(r) { return r && KEYS.every(k=>score(r.answers?.[k])); }
export function summarize(values) {
 const n=values.length;
 if(!n) return {n:0,total:0,mean:null,sd:null,min:null,max:null};
 const total=values.reduce((a,b)=>a+b,0), mean=total/n;
 return {n,total,mean,sd:n>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null,min:Math.min(...values),max:Math.max(...values)};
}
export function pearson(pairs) {
 const n=pairs.length;
 if(n<3) return {n,r:null,reason:'유효 응답이 3건 이상일 때 상관계수를 표시합니다.'};
 const mx=pairs.reduce((s,p)=>s+p[0],0)/n, my=pairs.reduce((s,p)=>s+p[1],0)/n;
 let xx=0,yy=0,xy=0;
 for(const [x,y] of pairs){xx+=(x-mx)**2; yy+=(y-my)**2; xy+=(x-mx)*(y-my);}
 if(xx===0 || yy===0) return {n,r:null,reason:'한 변수의 점수가 모두 같아 상관계수를 계산할 수 없습니다.'};
 return {n,r:Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))),reason:''};
}
export function analyze(records,round) {
 const rows=records.filter(r=>r.kind==='live' && r.round===round && validResponse(r));
 const stats=KEYS.map((k,i)=>({key:k,item:ITEMS[i],...summarize(rows.map(r=>r.answers[k]))}));
 for(const s of stats.slice(0,11)) s.rank=s.n ? 1+stats.slice(0,11).filter(t=>t.total>s.total).length:null;
 stats[11].rank=null;
 const ranking=[...stats.slice(0,11)].sort((a,b)=>(b.mean??-1)-(a.mean??-1)||KEYS.indexOf(a.key)-KEYS.indexOf(b.key));
 const correlation=pearson(rows.map(r=>[KEYS.slice(0,11).reduce((s,k)=>s+r.answers[k],0)/11,r.answers.q12]));
 const frequencies=Array.from({length:7},(_,i)=>({score:i+1,n:rows.filter(r=>r.answers.q12===i+1).length})).map(x=>({...x,percent:rows.length?100*x.n/rows.length:0}));
 return {rows,stats,ranking,correlation,frequencies};
}
export function rawTable(rows) {
 return [['익명 참여번호',...KEYS.map((k,i)=>`${k.toUpperCase()} ${ITEMS[i]}`),'Q1~Q11 개인평균','기타 정보 설명','제출시각'],...rows.map(r=>[r.participantNo,...KEYS.map(k=>r.answers[k]),KEYS.slice(0,11).reduce((s,k)=>s+r.answers[k],0)/11,r.otherText||'',formatDate(r.createdAt)])];
}
export function summaryTable(a) {
 return [['문항','항목','응답 인원','총점','평균','표본 표준편차','최솟값','최댓값','공동 순위'],...a.stats.map(s=>[s.key.toUpperCase(),s.item,s.n,s.total,s.mean,s.sd,s.min,s.max,s.rank])];
}
export function formatDate(t) {
 const d=t?.toDate?t.toDate():t instanceof Date?t:typeof t==='number'?new Date(t):null;
 return d?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(d):'—';
}
export const fmt=(n,d=2)=>n===null||n===undefined?'—':Number(n).toFixed(d);
export function csv(table) {
 // Excel에서 수식으로 실행될 수 있는 텍스트는 중화합니다.
 return '\uFEFF'+table.map(row=>row.map(v=>{let s=String(v??''); if(/^[=+@\-\t\r]/.test(s))s="'"+s; return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}

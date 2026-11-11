import {ITEMS,KEYS,US,analyze,rawTable,summaryTable,formatDate,fmt,csv} from './stats.js';
import {connect,configured,SURVEY,randomCode,hashCode,prettyCode,errorText} from './firebase.js';
import {demoConfig,demoRows} from './demo.js';
import {professorEmails} from '../config.js';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).get('demo')==='1';
let c,cfg={isOpen:false,target:15,activeRound:'',issued:0,codeRequired:false},records=[],codes=[],secrets=[],a=analyze([],''),charts={},unsubs=[],operation=false,dangerAction=null,qrData='';
const colors={purple:'#7460c5',navy:'#203451',light:'#d7cdef',green:'#368174'};
const table=(container,headers,rows)=>{const t=document.createElement('table');t.className='data-table';const head=document.createElement('thead'),tr=document.createElement('tr');headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th);});head.append(tr);t.append(head);const body=document.createElement('tbody');rows.forEach(row=>{const tr=document.createElement('tr');if(row[0]==='Q12')tr.className='importance-row';row.forEach(v=>{const td=document.createElement('td');td.textContent=v??'—';tr.append(td);});body.append(tr);});if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=headers.length;td.textContent='아직 제출된 응답이 없습니다.';tr.append(td);body.append(tr);}t.append(body);$(container).replaceChildren(t);};
let toastTimer;
function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,7000);}
function download(name,content,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function saveDataUrl(name,url){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
function syncState(){a=analyze(records,cfg.activeRound);render();}
function render(){
 const n=a.rows.length;$('metric-target').textContent=cfg.target;$('metric-completed').textContent=n;$('metric-remaining').textContent=Math.max(0,cfg.target-n);$('metric-rate').textContent=fmt(100*n/cfg.target,1)+'%';
 const last=[...a.rows].sort((x,y)=>time(y.createdAt)-time(x.createdAt))[0];$('metric-last').textContent=last?formatDate(last.createdAt):'—';
 $('target').value=cfg.target;$('target').disabled=Boolean(cfg.issued)||operation;$('save-target').disabled=Boolean(cfg.issued)||operation;
 $('open-badge').textContent=cfg.isOpen?'응답 접수 중':'응답 접수 종료';$('open-badge').classList.toggle('open',cfg.isOpen);$('toggle-open').textContent=cfg.isOpen?'조사 종료':'조사 시작';$('generate-codes').disabled=Boolean(cfg.issued)||operation;
 $('code-required').checked=Boolean(cfg.codeRequired);$('code-required').disabled=cfg.isOpen||a.rows.length>0||operation;
 $('code-controls').hidden=!cfg.codeRequired;
 $('entry-mode').textContent=cfg.codeRequired?'개별 참여코드로 입장':'코드·별도 로그인 없이 익명 응답';
 $('sample-limit').textContent=`목표 ${cfg.target}명 규모의 수업용 탐색 조사입니다. 표본이 작고 무작위 표본이 아니므로 일반화에 주의하세요. Q12는 중요성 문항이며 Q1~Q11의 유용성 순위에 포함하지 않습니다.`;
 const liveCodes=codes.filter(x=>x.kind==='live'&&x.round===cfg.activeRound),testCodes=codes.filter(x=>x.kind==='test'&&x.round===cfg.activeRound),testRows=records.filter(x=>x.kind==='test'&&x.round===cfg.activeRound);
 $('code-count').textContent=`실제 코드 ${liveCodes.length}개 · 제출 ${liveCodes.filter(x=>x.used).length}개 · 미사용 ${liveCodes.filter(x=>!x.used).length}개`;
 $('test-count').textContent=`테스트 코드 ${testCodes.length}개 · 테스트 응답 ${testRows.length}건 (집계 제외)`;
 $('generate-tests').disabled=testCodes.length>=3||operation;$('seed-tests').disabled=testRows.length>=3||operation;
 const sortedCodes=[...liveCodes,...testCodes].sort((x,y)=>x.participantNo.localeCompare(y.participantNo));
 table('codes-table',['참여번호','유형','참여코드 (관리자 전용)','상태','제출시각'],sortedCodes.map(x=>[x.participantNo,x.kind==='test'?'테스트':'실제',secrets.find(s=>s.id===x.id)?.rawCode||'불러오는 중',x.used?'제출 완료':'미사용',formatDate(x.usedAt)]));
 table('stats-table',['문항','항목','n','총점','평균','표본 표준편차','최솟값','최댓값','순위'],a.stats.map(s=>[s.key.toUpperCase(),s.item,s.n,s.total,fmt(s.mean),fmt(s.sd),s.min,s.max,s.rank?`${s.rank}위`:'—']));
 const q12=a.stats[11];$('q12-mean').textContent=fmt(q12.mean);$('q12-detail').textContent=`응답 ${q12.n}명 · 총점 ${q12.total} · 표본 표준편차 ${fmt(q12.sd)}`;
 $('correlation-r').textContent=fmt(a.correlation.r,3);$('correlation-n').textContent=`유효 응답 ${a.correlation.n}명`;$('correlation-help').textContent=a.correlation.reason||'두 점수의 선형 관계를 나타냅니다. 유의성이나 인과 효과를 검정한 결과가 아닙니다.';
 $('distribution').replaceChildren();a.frequencies.forEach(x=>{const span=document.createElement('span');span.textContent=`${x.score}점: ${x.n}명 (${fmt(x.percent,1)}%)`;$('distribution').append(span);});
 table('comparison-table',['정보 항목','미국 비율','미국 순위','우리 반 순위','순위 상승(+)'],a.stats.slice(0,11).map((s,i)=>[s.item,US[i]+'%',i+1,s.rank??'—',s.rank===null?'—':(i+1-s.rank>0?'+':'')+(i+1-s.rank)]));
 const raw=rawTable(a.rows);table('raw-table',raw[0],raw.slice(1).map(row=>row.map((v,i)=>i===13?fmt(v):v)));
 $('print-stamp').textContent=`분석 시각: ${formatDate(new Date())} · 실제 응답 ${n} / 목표 ${cfg.target}명`;
 renderCharts();
}
function time(t){return t?.toMillis?t.toMillis():typeof t==='number'?t:0;}
const valueLabel={id:'valueLabel',afterDatasetsDraw(chart){if(chart.config.type!=='bar')return;const ctx=chart.ctx;ctx.save();ctx.font='12px "Malgun Gothic", sans-serif';ctx.fillStyle=colors.navy;chart.data.datasets.forEach((ds,j)=>{chart.getDatasetMeta(j).data.forEach((bar,i)=>{const value=ds.data[i];if(value===null)return;let text=chart.canvas.id==='chart-c'?`${value}명 (${fmt(a.frequencies[i].percent,1)}%)`:fmt(value);if(chart.options.indexAxis==='y'){ctx.textAlign='left';ctx.fillText(text,bar.x+7,bar.y+4);}else{ctx.textAlign='center';ctx.fillText(text,bar.x,bar.y-9);}});});ctx.restore();}};
const whiteBackground={id:'whiteBackground',beforeDraw(chart){const ctx=chart.ctx;ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='white';ctx.fillRect(0,0,chart.width,chart.height);ctx.restore();}};
function renderCharts(){
 if(!window.Chart){$('live-status').textContent='통계는 표시 중입니다. 그래프 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';return;}
 Chart.defaults.font.family='"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';Chart.defaults.color='#657087';
 const options={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,min:0,max:7,ticks:{stepSize:1}}},layout:{padding:{top:25,right:35}}};
 const specs={
  'chart-a':{type:'bar',data:{labels:a.ranking.map(s=>wrapLabel(s.item)),datasets:[{data:a.ranking.map(s=>s.mean),backgroundColor:colors.purple,borderRadius:5}]},options:{...options,indexAxis:'y',scales:{x:{min:1,max:7,ticks:{stepSize:1},title:{display:true,text:'평균점수 (1~7점)'}},y:{grid:{display:false},ticks:{font:{size:11},autoSkip:false}}},layout:{padding:{right:45}}}},
  'chart-b':{type:'bar',data:{labels:KEYS.map(k=>k.toUpperCase()),datasets:[{data:a.stats.map(s=>s.mean),backgroundColor:KEYS.map((_,i)=>i===11?colors.navy:colors.purple),borderRadius:4}]},options:{...options,plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>ITEMS[items[0].dataIndex]}}},scales:{y:{min:1,max:7,ticks:{stepSize:1},title:{display:true,text:'평균점수 (1~7점)'}}}}},
  'chart-c':{type:'bar',data:{labels:a.frequencies.map(s=>`${s.score}점`),datasets:[{data:a.frequencies.map(s=>s.n),backgroundColor:colors.navy,borderRadius:4}]},options:{...options,scales:{y:{min:0,suggestedMax:Math.max(3,...a.frequencies.map(x=>x.n))+1,ticks:{stepSize:1},title:{display:true,text:'응답 인원 (명)'}}}}},
  'chart-d':{type:'line',data:{labels:['미국 조사 순위','우리 반 순위'],datasets:a.stats.slice(0,11).map((s,i)=>({label:s.item,data:[i+1,s.rank],borderColor:`hsl(${i*31+230},45%,${i%2?48:60}%)`,backgroundColor:'white',pointRadius:4,borderWidth:2,tension:0}))},options:{...options,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y}위`}}},scales:{y:{min:1,max:11,reverse:true,ticks:{stepSize:1},title:{display:true,text:'순위 (1위가 위쪽)'}}}}}
 };
 for(const [id,spec] of Object.entries(specs)){charts[id]?.destroy();charts[id]=new Chart($(id),{...spec,plugins:[whiteBackground,valueLabel]});}
}
document.querySelectorAll('[data-png]').forEach(b=>b.onclick=()=>{const chart=charts[b.dataset.png];if(chart)saveDataUrl(`${b.dataset.png}_조사분석.png`,chart.toBase64Image());else toast('그래프가 아직 준비되지 않았습니다.');});
$('download-csv').onclick=()=>download('리뷰조사_실제응답.csv',csv(rawTable(a.rows)));
$('download-summary').onclick=()=>download('리뷰조사_통계.csv',csv(summaryTable(a)));
$('download-xlsx').onclick=()=>{
 if(!window.XLSX){toast('Excel 라이브러리를 불러오지 못했습니다. CSV를 사용하거나 연결을 확인해 주세요.');return;}
 const workbook=XLSX.utils.book_new(),info=[['지표','값'],['실제 응답 수',a.rows.length],['목표 응답 인원',cfg.target],['표준편차','표본 표준편차(n-1), n<2는 공란'],['공동 순위','경쟁 순위 방식(1,1,3)'],['Q12','별도 중요성 문항, 유용성 순위에서 제외'],['상관계수 r',a.correlation.r],['상관 유효 n',a.correlation.n],['상관 안내',a.correlation.reason||'상관관계는 인과관계가 아님'],['비교 주의','미국 응답비율과 7점 척도는 직접 크기 비교 불가. 순위만 탐색적으로 비교'],['표본 한계','소규모 수업 표본, 모집단 일반화 제한'],['시연 여부',demo?'시연 전용 데이터':'실제 조사 데이터'],['테스트 응답','집계 및 내보내기에서 제외']];
 for(const [name,rows] of [['원자료',rawTable(a.rows)],['요약 통계',summaryTable(a)],['미국 순위 비교',[['항목','미국 비율(%)','미국 순위','우리 반 순위','상승 순위'],...a.stats.slice(0,11).map((s,i)=>[s.item,US[i],i+1,s.rank,s.rank===null?null:i+1-s.rank])]],['중요성 분포',[['점수','인원','비율(%)'],...a.frequencies.map(x=>[x.score,x.n,x.percent])]],['해석 안내',info]]){
  const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!cols']=rows[0].map((_,i)=>({wch:i===0?24:20}));XLSX.utils.book_append_sheet(workbook,sheet,name);
 }XLSX.writeFile(workbook,'리뷰조사_분석결과.xlsx');
};
$('print').onclick=()=>window.print();
async function runOperation(task){if(operation)return;operation=true;document.querySelectorAll('.settings-panel button').forEach(b=>b.disabled=true);try{await task();}catch(e){toast(errorText(e));}finally{operation=false;document.querySelectorAll('.settings-panel button').forEach(b=>b.disabled=false);render();}}
async function configTransaction(change){
 if(demo){cfg={...cfg,...change(cfg)};syncState();return;}
 await c.F.runTransaction(c.db,async tx=>{const ref=c.F.doc(c.db,SURVEY),snap=await tx.get(ref);if(!snap.exists())throw new Error('설정이 없습니다.');tx.update(ref,{...change(snap.data()),updatedAt:c.F.serverTimestamp()});});
}
$('save-target').onclick=()=>runOperation(async()=>{const target=Number($('target').value);if(!Number.isInteger(target)||target<1||target>100)throw new Error('목표 인원은 1~100명의 정수여야 합니다.');await configTransaction(current=>{if(current.issued)throw new Error('코드가 발급되어 목표 인원을 바꿀 수 없습니다.');return {target};});toast('목표 응답 인원을 저장했습니다.');});
$('toggle-open').onclick=()=>runOperation(async()=>{await configTransaction(current=>({isOpen:!current.isOpen}));toast('조사 접수 상태를 변경했습니다.');});
$('code-required').onchange=()=>runOperation(async()=>{const checked=$('code-required').checked;await configTransaction(current=>{if(current.isOpen||a.rows.length)throw new Error('응답이 없고 접수가 종료된 상태에서만 입장 방식을 바꿀 수 있습니다.');return {codeRequired:checked};});toast(checked?'참여코드 방식을 선택했습니다.':'코드 없이 익명으로 응답합니다.');});
async function createCodes(kind){
 if(demo){toast('시연 화면에서는 참여코드를 발급하지 않습니다.');return;}
 const count=kind==='live'?cfg.target:3;
 const existing=codes.filter(x=>x.round===cfg.activeRound&&x.kind===kind);
 if(existing.length)throw new Error('이미 발급한 코드가 있습니다. 기존 코드를 사용해 주세요.');
 const round=cfg.activeRound;
 const generated=await Promise.all(Array.from({length:count},async(_,i)=>{const raw=randomCode();return {id:await hashCode(raw),rawCode:prettyCode(raw),participantNo:`${kind==='test'?'T':'P'}${String(i+1).padStart(2,'0')}`,kind,round,used:false,usedBy:null,usedAt:null};}));
 await c.F.runTransaction(c.db,async tx=>{
  const ref=c.F.doc(c.db,SURVEY),snapshot=await tx.get(ref),current=snapshot.data();
  if(current.activeRound!==round)throw new Error('조사 회차가 바뀌었습니다. 새로고침해 주세요.');
  if(kind==='live'&&(current.issued||current.target!==count))throw new Error('이미 코드가 발급되었거나 목표 인원이 바뀌었습니다.');
  if(kind==='test'){
   const marker=c.F.doc(c.db,SURVEY,'codeSecrets','test-marker');const m=await tx.get(marker);if(m.exists())throw new Error('테스트 코드가 이미 발급되었습니다.');
   tx.set(marker,{round,kind:'marker'});
  }
  for(const {id,rawCode,...data} of generated){tx.set(c.F.doc(c.db,SURVEY,'codes',id),data);tx.set(c.F.doc(c.db,SURVEY,'codeSecrets',id),{rawCode,participantNo:data.participantNo,kind,round});}
  if(kind==='live')tx.update(ref,{issued:count,updatedAt:c.F.serverTimestamp()});
 });toast(`${kind==='live'?'실제':'테스트'} 참여코드 ${count}개를 발급했습니다. CSV로 내려받아 한 명에게 하나씩 배부하세요.`);
}
$('generate-codes').onclick=()=>runOperation(()=>createCodes('live'));
$('generate-tests').onclick=()=>runOperation(()=>createCodes('test'));
$('download-codes').onclick=()=>{
 const rows=codes.filter(x=>x.round===cfg.activeRound).sort((a,b)=>a.participantNo.localeCompare(b.participantNo));
 if(!rows.length){toast('먼저 코드를 생성해 주세요.');return;}
 download('참여코드_관리자배부용.csv',csv([['참여번호','유형','참여코드','제출 상태'],...rows.map(x=>[x.participantNo,x.kind==='live'?'실제':'테스트',secrets.find(s=>s.id===x.id)?.rawCode||'',x.used?'제출 완료':'미사용'])]));
};
function confirmDanger(title,message,phrase,action){dangerAction={phrase,action};$('danger-title').textContent=title;$('danger-message').textContent=message;$('danger-required').textContent=phrase;$('danger-phrase').value='';$('danger-confirm').disabled=true;$('danger-error').hidden=true;$('danger-dialog').showModal();}
$('danger-phrase').oninput=()=>{$('danger-confirm').disabled=$('danger-phrase').value!==dangerAction?.phrase;};
$('danger-cancel').onclick=()=>{if(!operation)$('danger-dialog').close();};
$('danger-dialog').addEventListener('cancel',e=>{if(operation)e.preventDefault();});
$('danger-confirm').onclick=()=>{if($('danger-phrase').value!==dangerAction?.phrase)return;const action=dangerAction.action;$('danger-dialog').close();runOperation(action);};
async function deleteDocuments(snapshots){const refs=snapshots.flatMap(s=>s.docs.map(d=>d.ref));for(let i=0;i<refs.length;i+=200){const batch=c.F.writeBatch(c.db);refs.slice(i,i+200).forEach(ref=>batch.delete(ref));await batch.commit();}}
$('delete-tests').onclick=()=>confirmDanger('테스트 데이터 삭제','테스트 응답·테스트 코드만 삭제합니다. 실제 응답은 유지됩니다.','테스트 삭제',async()=>{
 if(demo){toast('시연 화면에는 별도 테스트 데이터가 없습니다.');return;}
 const snaps=await Promise.all(['responses','codes','codeSecrets'].map(name=>c.F.getDocs(c.F.query(c.F.collection(c.db,SURVEY,name),c.F.where('kind','==','test')))));
 await deleteDocuments(snaps);await c.F.deleteDoc(c.F.doc(c.db,SURVEY,'codeSecrets','test-marker'));toast('테스트 데이터를 삭제했습니다.');
});
$('reset-all').onclick=()=>confirmDanger('전체 데이터 초기화','모든 실제·테스트 응답과 참여코드가 삭제됩니다. 복구할 수 없으니 필요한 데이터를 먼저 내려받으세요.','전체 초기화',async()=>{
 if(demo){records=[];codes=[];secrets=[];cfg={isOpen:false,target:15,issued:0,activeRound:crypto.randomUUID()};syncState();toast('시연 데이터를 초기화했습니다.');return;}
 await configTransaction(()=>({isOpen:false}));
 const snaps=await Promise.all(['responses','codes','codeSecrets','receipts'].map(name=>c.F.getDocs(c.F.collection(c.db,SURVEY,name))));
 await deleteDocuments(snaps);await configTransaction(()=>({isOpen:false,issued:0,activeRound:crypto.randomUUID()}));toast('전체 데이터와 코드를 초기화했습니다. 새 코드를 생성한 후 조사를 시작하세요.');
});
$('seed-tests').onclick=()=>runOperation(async()=>{
 if(demo){toast('이미 시연 데이터가 표시되어 있습니다.');return;}
 const tests=codes.filter(x=>x.kind==='test'&&x.round===cfg.activeRound&&!x.used).slice(0,3);if(!tests.length)throw new Error('미사용 테스트 코드가 필요합니다. 먼저 테스트 코드를 생성하세요.');
 const batch=c.F.writeBatch(c.db);tests.forEach((x,i)=>{batch.set(c.F.doc(c.db,SURVEY,'responses',x.id),{answers:Object.fromEntries(KEYS.map((k,j)=>[k,1+(i+j)%7])),otherText:'테스트용 샘플 응답 (실제 통계 제외)',participantNo:x.participantNo,submissionKey:x.id,round:x.round,kind:'test',uid:c.auth.currentUser.uid,createdAt:c.F.serverTimestamp()});batch.update(c.F.doc(c.db,SURVEY,'codes',x.id),{used:true,usedBy:c.auth.currentUser.uid,usedAt:c.F.serverTimestamp()});});await batch.commit();toast(`테스트 응답 ${tests.length}건을 생성했습니다. 실제 집계에는 포함하지 않습니다.`);
});
function setupQR(){
 const url=new URL('index.html',location.href);url.search='';url.hash='';$('survey-url').value=url.href;
 if(!window.qrcode){$('qr-error').textContent='QR 라이브러리를 불러오지 못했습니다. 주소를 직접 배포할 수 있습니다.';return;}
 drawQR(url.href);
 $('public-survey-url').value=url.href;
 $('qr-local-warning').hidden=!['localhost','127.0.0.1'].includes(url.hostname);
}
function drawQR(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error('http 또는 https 주소만 사용할 수 있습니다.');const qr=qrcode(0,'M');qr.addData(u.href);qr.make();const n=qr.getModuleCount(),scale=12,margin=4;const canvas=document.createElement('canvas');canvas.width=canvas.height=(n+margin*2)*scale;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#111111';for(let r=0;r<n;r++)for(let col=0;col<n;col++)if(qr.isDark(r,col))context.fillRect((col+margin)*scale,(r+margin)*scale,scale,scale);qrData=canvas.toDataURL('image/png');$('qr-code').src=qrData;$('qr-large-image').src=qrData;$('qr-large-url').textContent=u.href;$('survey-url').value=u.href;}
function wrapLabel(t){const words=t.split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>13)lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}return lines;}
$('copy-url').onclick=async()=>{try{await navigator.clipboard.writeText($('survey-url').value);toast('설문 주소를 복사했습니다.');}catch{$('survey-url').select();toast('주소를 선택했습니다. 복사해 주세요.');}};
$('save-qr').onclick=()=>qrData?saveDataUrl('리뷰조사_설문QR.png',qrData):toast('QR코드가 아직 준비되지 않았습니다.');
$('apply-public-url').onclick=()=>{try{drawQR($('public-survey-url').value.trim());$('qr-local-warning').hidden=!['localhost','127.0.0.1'].includes(new URL($('survey-url').value).hostname);toast('배포용 주소로 QR코드를 만들었습니다. 실제로 접속 가능한 주소인지 확인해 주세요.');}catch(e){toast(errorText(e));}};
$('show-qr').onclick=()=>{if(!qrData){toast('QR코드를 먼저 생성해 주세요.');return;}$('qr-dialog').showModal();};
$('qr-close').onclick=()=>$('qr-dialog').close();
$('qr-fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await $('qr-dialog').requestFullscreen();else await document.exitFullscreen();}catch{toast('브라우저에서 전체화면을 허용하지 않습니다. 큰 QR 화면으로 사용하세요.');}};
$('qr-print').onclick=()=>window.print();
function clearListeners(){unsubs.forEach(f=>f());unsubs=[];records=[];codes=[];secrets=[];}
async function authorized(user){
 clearListeners();$('dashboard').hidden=true;$('login-area').hidden=false;$('logout').hidden=!user;$('admin-user').textContent='';
 if(!user)return;
 try{
  const token=await c.A.getIdTokenResult(user);
  const professor=token.claims.email_verified===true&&professorEmails.includes(token.claims.email);
  const access=professor?null:await c.F.getDoc(c.F.doc(c.db,'reviewSurveyAdmins',user.uid));
  if(!professor&&!access?.exists()){$('admin-uid').textContent=`관리자 권한이 없습니다. Firebase Console에 등록할 UID: ${user.uid}`;return;}
  $('admin-uid').textContent='';$('login-area').hidden=true;$('dashboard').hidden=false;$('admin-user').textContent=user.email;
  const configRef=c.F.doc(c.db,SURVEY),configSnap=await c.F.getDoc(configRef);
  if(!configSnap.exists())await c.F.setDoc(configRef,{isOpen:false,target:15,issued:0,codeRequired:false,activeRound:crypto.randomUUID(),updatedAt:c.F.serverTimestamp()});
  const onError=e=>{$('live-status').textContent=errorText(e);toast(errorText(e));};
  unsubs.push(c.F.onSnapshot(configRef,s=>{if(!s.exists())return;cfg=s.data();syncState();},onError));
  for(const [name,set] of [['responses',v=>records=v],['codes',v=>codes=v],['codeSecrets',v=>secrets=v]]){
   unsubs.push(c.F.onSnapshot(c.F.collection(c.db,SURVEY,name),{includeMetadataChanges:true},snap=>{set(snap.docs.filter(d=>!d.metadata.hasPendingWrites).map(d=>({id:d.id,...d.data()})));$('live-status').textContent=snap.metadata.fromCache?'저장된 데이터 · 서버 연결 확인 중':'실시간 동기화 중 · 실제 제출된 응답만 집계';syncState();},onError));
  }
  setupQR();
 }catch(e){$('login-error').textContent=errorText(e);$('login-error').hidden=false;}
}
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-button').disabled=true;$('login-error').hidden=true;try{if(!c)c=await connect();await c.A.signInWithEmailAndPassword(c.auth,$('email').value.trim(),$('password').value);$('password').value='';}catch(err){$('login-error').textContent=errorText(err);$('login-error').hidden=false;}finally{$('login-button').disabled=false;}};
$('logout').onclick=async()=>{if(!c)return;clearListeners();await c.A.signOut(c.auth);location.reload();};
$('google-login').onclick=async()=>{try{if(!c)c=await connect();await c.A.signInWithPopup(c.auth,new c.A.GoogleAuthProvider());}catch(e){$('login-error').textContent=errorText(e);$('login-error').hidden=false;}};
async function init(){
 if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
 if(demo){cfg={...demoConfig,issued:15};records=demoRows();$('demo-banner').hidden=false;$('login-area').hidden=true;$('dashboard').hidden=false;$('live-status').textContent='시연 데이터 · 실제 서버에 연결하지 않음';syncState();setupQR();return;}
 if(!configured()){$('login-error').textContent='Firebase 연결 설정이 필요합니다. 아래 연결 설정을 열거나 대시보드 시연을 이용하세요.';$('login-error').hidden=false;return;}
 try{c=await connect();c.A.onAuthStateChanged(c.auth,user=>authorized(user));}catch(e){$('login-error').textContent=errorText(e);$('login-error').hidden=false;}
}
init();

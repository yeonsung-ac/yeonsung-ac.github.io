import {ITEMS,USEFUL,IMPORTANT,KEYS,validResponse} from './stats.js';
import {studentConnection,configured,SURVEY,normalizeCode,hashCode,errorText} from './firebase.js';
import {demoConfig} from './demo.js';
const $=id=>document.getElementById(id), demo=new URLSearchParams(location.search).get('demo')==='1';
if(new URLSearchParams(location.search).get('embedded')==='1'){
 document.querySelector('.site-head').hidden=true;document.querySelector('.page-foot').hidden=true;
 const resize=()=>parent.postMessage({type:'review-survey-resize',height:Math.ceil(document.body.getBoundingClientRect().height + 60)},location.origin);
 new ResizeObserver(resize).observe(document.body);window.addEventListener('load',resize);
}
let c,cfg=null,verified=null,busy=false,done=false,payload;
for(let i=0;i<12;i++){
 const field=document.createElement('fieldset');field.className='question';field.id=`field-q${i+1}`;
 const legend=document.createElement('legend');legend.innerHTML=`<span class="q-number">Q${i+1}</span> <span>${ITEMS[i]}</span>`;field.append(legend);
 const options=document.createElement('div');options.className='rating-options';
 (i===11?IMPORTANT:USEFUL).forEach((label,j)=>{
  const l=document.createElement('label');l.className='rating-option';
  const input=document.createElement('input');input.type='radio';input.name=`q${i+1}`;input.value=j+1;input.required=true;input.setAttribute('aria-label',`${j+1}점: ${label}`);
  const visual=document.createElement('span');visual.textContent=j+1;l.append(input,visual);options.append(l);
 });field.append(options);
 const selected=document.createElement('p');selected.className='selected-caption';selected.id=`caption-q${i+1}`;selected.textContent='점수를 선택해 주세요';field.append(selected);
 if(i===10){const label=document.createElement('label');label.className='other-label';label.htmlFor='other-text';label.textContent='어떤 기타 정보를 떠올렸나요? (선택)';const ta=document.createElement('textarea');ta.id='other-text';ta.maxLength=300;ta.rows=2;ta.placeholder='예: 배송 상태, 판매자의 응대 등 · 최대 300자';field.append(label,ta);}
 $(i===11?'importance-question':'usefulness-questions').append(field);
}
function answers(){return Object.fromEntries(KEYS.map(k=>[k,Number(document.querySelector(`input[name="${k}"]:checked`)?.value)||null]));}
function progress(){const a=answers(),n=Object.values(a).filter(Boolean).length;$('progress').value=n;$('progress-text').textContent=`${n} / 12문항 응답`;$('progress-percent').textContent=`${Math.round(n/12*100)}%`;
 KEYS.forEach((k,i)=>{$(`caption-${k}`).textContent=a[k]?`${a[k]}점 · ${(i===11?IMPORTANT:USEFUL)[a[k]-1]}`:'점수를 선택해 주세요';if(a[k])$(`field-${k}`).classList.remove('missing');});
 $('review-button').disabled=!cfg?.isOpen||done||busy||!verified||n<12;
}
$('survey-form').addEventListener('change',progress);
$('participation-code').addEventListener('input',()=>{verified=null;$('code-status').textContent='변경한 코드를 다시 확인해 주세요.';progress();});
function applyConfig(){
 document.querySelector('.code-panel').hidden=!cfg?.codeRequired||done;
 document.querySelector('.privacy').textContent=cfg?.codeRequired?'이름·학번을 묻지 않는 익명 조사입니다. 배부받은 참여코드로 한 번만 응답할 수 있습니다. 다른 학생의 응답은 공개되지 않습니다.':'이름·학번·참여코드 없이 응답합니다. 설문 전용 익명 ID를 사용하며 수업 로그인 정보와 연결하지 않습니다. 다른 기기나 시크릿 창을 통한 재참여는 삼가 주세요. 자유입력에는 개인정보를 적지 마세요.';
 if(!cfg?.codeRequired&&!done)verified={participantNo:demo?'시연-P01':`익명-${c.auth.currentUser.uid.slice(0,8)}`,kind:'live',round:cfg.activeRound,hash:demo?'demo':`${cfg.activeRound}_${c.auth.currentUser.uid}`,anonymous:true};
 $('survey-state').textContent=cfg?.isOpen?'응답 접수 중':'응답 접수 종료';$('survey-state').classList.toggle('open',Boolean(cfg?.isOpen));progress();
}
function storageKey(){return `review-survey-done:${c?.db?.app?.options?.projectId||'demo'}:${cfg?.activeRound||''}`;}
function finish(no){done=true;$('survey-form').hidden=true;document.querySelector('.code-panel').hidden=true;$('success').hidden=false;$('success-id').textContent=`익명 참여번호: ${no}`;$('success').focus();}
async function checkCode(){
 const raw=normalizeCode($('participation-code').value);verified=null;$('code-check').disabled=true;
 try {
  if(!cfg?.isOpen)throw new Error('현재 응답을 받지 않고 있습니다.');
  if(demo){if(raw!=='DEMO')throw new Error('시연 참여코드는 DEMO입니다.');verified={participantNo:'시연-P01',kind:'test',round:cfg.activeRound,hash:'demo'};}
  else {
   if(!/^[A-F0-9]{32}$/.test(raw))throw new Error('배부받은 32자리 참여코드를 확인해 주세요. 하이픈과 공백은 무시됩니다.');
   const hash=await hashCode(raw),snap=await c.F.getDoc(c.F.doc(c.db,SURVEY,'codes',hash));
   if(!snap.exists())throw new Error('등록되지 않은 참여코드입니다.');
   const data=snap.data();
   if(data.round!==cfg.activeRound)throw new Error('이전 조사 참여코드입니다. 새 코드를 받아 주세요.');
   if(data.used){if(data.usedBy===c.auth.currentUser.uid){finish(data.participantNo);return;}throw new Error('이미 제출된 참여코드입니다.');}
   verified={...data,hash};
  }
  $('code-status').textContent=`${verified.participantNo} · 사용 가능한 ${verified.kind==='test'?'테스트':'실제 조사'} 코드입니다.`;
 }catch(e){$('code-status').textContent=errorText(e);}finally{$('code-check').disabled=false;progress();}
}
$('code-check').onclick=checkCode;
$('survey-form').onsubmit=e=>{
 e.preventDefault();const a=answers(),missing=KEYS.filter(k=>!a[k]);
 if(missing.length){$('form-error').hidden=false;$('form-error').textContent=`미응답 문항: ${missing.map(k=>k.toUpperCase()).join(', ')}`;missing.forEach(k=>$(`field-${k}`).classList.add('missing'));document.querySelector(`input[name="${missing[0]}"]`).focus();return;}
 if(!verified||!cfg?.isOpen)return;
 $('form-error').hidden=true;payload={answers:a,otherText:$('other-text').value.trim()};$('review-content').replaceChildren();
 KEYS.forEach((k,i)=>{const p=document.createElement('p');p.className='review-row';p.textContent=`Q${i+1}. ${ITEMS[i]} — ${a[k]}점`; $('review-content').append(p);});
 if(payload.otherText){const p=document.createElement('p');p.textContent=`기타 정보: ${payload.otherText}`;$('review-content').append(p);}
 $('review-error').hidden=true;$('review-dialog').showModal();
};
for(const id of ['review-close','review-back'])$(id).onclick=()=>{if(!busy)$('review-dialog').close();};
$('review-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('confirm-submit').onclick=async()=>{
 if(busy||!verified||!validResponse(payload))return;busy=true;$('confirm-submit').disabled=true;$('review-back').disabled=true;$('confirm-submit').textContent='제출 중…';const v={...verified};
 try{
  if(!demo){await c.F.runTransaction(c.db,async tx=>{
   const configRef=c.F.doc(c.db,SURVEY),responseRef=c.F.doc(c.db,SURVEY,'responses',v.hash);
   const configSnap=await tx.get(configRef);
   if(!configSnap.exists()||!configSnap.data().isOpen)throw new Error('조사가 종료되어 제출할 수 없습니다.');
   if(configSnap.data().activeRound!==v.round || configSnap.data().codeRequired===v.anonymous)throw new Error('조사 설정이 바뀌었습니다. 화면을 새로고침해 주세요.');
   if(v.anonymous){
    const receiptRef=c.F.doc(c.db,SURVEY,'receipts',v.hash),receipt=await tx.get(receiptRef);
    if(receipt.exists())throw new Error('이미 제출했습니다. 화면을 새로고침하여 참여 완료 상태를 확인해 주세요.');
    tx.set(responseRef,{...payload,participantNo:v.participantNo,submissionKey:v.hash,round:v.round,kind:'live',uid:c.auth.currentUser.uid,createdAt:c.F.serverTimestamp()});
    tx.set(receiptRef,{uid:c.auth.currentUser.uid,round:v.round,participantNo:v.participantNo,createdAt:c.F.serverTimestamp()});return;
   }
   const codeRef=c.F.doc(c.db,SURVEY,'codes',v.hash),codeSnap=await tx.get(codeRef);
   if(!codeSnap.exists()||codeSnap.data().round!==configSnap.data().activeRound)throw new Error('현재 조사에서 사용할 수 없는 코드입니다.');
   if(codeSnap.data().used)throw new Error('이미 제출된 참여코드입니다. 코드 확인을 다시 눌러 제출 상태를 확인해 주세요.');
   const cd=codeSnap.data();
   tx.set(responseRef,{...payload,participantNo:cd.participantNo,submissionKey:v.hash,round:cd.round,kind:cd.kind,uid:c.auth.currentUser.uid,createdAt:c.F.serverTimestamp()});
   tx.update(codeRef,{used:true,usedBy:c.auth.currentUser.uid,usedAt:c.F.serverTimestamp()});
  });}
  $('review-dialog').close();try{sessionStorage.setItem(storageKey(),v.participantNo);}catch{}finish(v.participantNo);
 }catch(e){$('review-error').textContent=errorText(e);$('review-error').hidden=false;}
 finally{busy=false;$('confirm-submit').disabled=false;$('review-back').disabled=false;$('confirm-submit').textContent='최종 제출';progress();}
};
async function start(){
 if(demo){cfg=demoConfig;$('demo-banner').hidden=false;$('connection').textContent='시연 · 서버 저장 없음';applyConfig();return;}
 if(!configured()){$('setup-needed').hidden=false;$('connection').textContent='연결 설정 필요';$('code-check').disabled=true;$('survey-state').textContent='아직 연결되지 않음';return;}
 try{c=await studentConnection();c.F.onSnapshot(c.F.doc(c.db,SURVEY),snap=>{
  if(!snap.exists()){$('connection').textContent='관리자가 조사를 초기 설정해야 합니다.';return;}
  const previous=cfg?.activeRound;cfg=snap.data();if(previous&&previous!==cfg.activeRound){verified=null;done=false;location.reload();return;}
  $('connection').textContent=snap.metadata.fromCache?'저장된 상태 · 연결 확인 중':'실시간 연결됨';applyConfig();
  if(!cfg.codeRequired){const key=`${cfg.activeRound}_${c.auth.currentUser.uid}`;c.F.getDoc(c.F.doc(c.db,SURVEY,'receipts',key)).then(r=>{if(r.exists())finish(r.data().participantNo);}).catch(()=>{});}
  try{const no=sessionStorage.getItem(storageKey());if(no)finish(no);}catch{}
 },e=>{$('connection').textContent=errorText(e);});}catch(e){$('connection').textContent=errorText(e);}
}
start();

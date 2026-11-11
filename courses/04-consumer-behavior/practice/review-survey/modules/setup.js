const text=document.getElementById('config-json'),message=document.getElementById('setup-message');
try{text.value=localStorage.getItem('reviewSurveyFirebase')||'';}catch{}
document.getElementById('setup-form').onsubmit=e=>{
 e.preventDefault();
 try{
  // eval/Function을 사용하지 않고 JSON 또는 Firebase 설정 객체 리터럴만 읽습니다.
  let value=text.value.trim();const left=value.indexOf('{'),right=value.lastIndexOf('}');if(left<0||right<left)throw new Error('설정 객체의 중괄호를 확인해 주세요.');
  value=value.slice(left,right+1).replace(/^\s*\/\/.*$/gm,'').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g,'$1"$2":').replace(/,\s*}/g,'}');
  const parsed=JSON.parse(value),allowed=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId'];
  if(Object.keys(parsed).some(k=>!allowed.includes(k)))throw new Error('공개 Firebase 웹 설정에 해당하지 않는 필드가 있습니다. 비밀키를 입력하지 마세요.');
  for(const k of ['apiKey','authDomain','projectId','appId'])if(typeof parsed[k]!=='string'||!parsed[k].trim())throw new Error(`${k} 값을 확인해 주세요.`);
  localStorage.setItem('reviewSurveyFirebase',JSON.stringify(parsed));message.textContent=`${parsed.projectId} 프로젝트 설정을 이 브라우저에 저장했습니다. 설문 또는 관리자 화면으로 이동하세요.`;message.hidden=false;
 }catch(e){message.textContent=e.message;message.hidden=false;}
};
document.getElementById('clear-config').onclick=()=>{try{localStorage.removeItem('reviewSurveyFirebase');text.value='';message.textContent='이 브라우저의 설정을 지웠습니다. config.js의 기본 설정이 사용됩니다.';message.hidden=false;}catch{message.textContent='브라우저 저장소에 접근할 수 없습니다.';message.hidden=false;}};

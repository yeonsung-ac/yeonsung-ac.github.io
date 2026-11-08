/* One daily browser estimate; no IP, URL, referrer or name is transmitted. */
(() => {
  'use strict';
  const sites = {'yeonsung-ac.github.io':'yeonsung', 'neopix-korea.github.io':'neopix-github'};
  const site = sites[location.hostname];
  if (!site || navigator.doNotTrack === '1' || window.__consultingVisitSent) return;
  window.__consultingVisitSent = true;
  try {
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
    const key = 'consulting-visitor-daily';
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
    if (!saved || saved.day !== day || !/^[a-f0-9]{32}$/.test(saved.id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      saved = {day, id:Array.from(bytes, v=>v.toString(16).padStart(2,'0')).join('')};
      localStorage.setItem(key, JSON.stringify(saved));
    }
    const url = 'https://kvbs.co.kr/consulting-pages-stats.php?site=' + encodeURIComponent(site);
    fetch(url, {method:'POST', mode:'cors', credentials:'omit', keepalive:true,
      headers:{'Content-Type':'text/plain'}, body:JSON.stringify({id:saved.id})}).catch(()=>{});
  } catch (_) { /* Storage or tracking blocked: leave the page unaffected. */ }
})();

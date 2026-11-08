const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function githubPagesUrls(text) {
  const candidates = String(text || '').match(/(?:https?:\/\/[^\s<>"'`\u3000-\uD7FF]+|(?<![\w./@-])[a-z0-9-]+\.github\.io[^\s<>"'`\u3000-\uD7FF]*)/gi) || [];
  const urls = [];
  for (let candidate of candidates) {
    candidate = candidate.replace(/[.,;:!?)}\]]*$/, '');
    try {
      const url = new URL(/^https?:/.test(candidate) ? candidate : 'https://' + candidate);
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.github\.io$/i.test(url.hostname) || url.username || url.password || url.port) continue;
      url.protocol = 'https:';
      if (!urls.includes(url.href)) urls.push(url.href);
    } catch {}
  }
  return urls;
}

function submittedAt(row) {
  const time = row.updatedAt || row.createdAt;
  return time?.toMillis?.() || time?.toDate?.().getTime() || (time instanceof Date ? time.getTime() : 0);
}

export function studentSiteRows(works, taskId = '', search = '') {
  const latest = new Map();
  const query = search.trim().toLowerCase();
  const ordered = works.filter(w => !taskId || w.taskId === taskId).slice().sort((a,b) => submittedAt(b)-submittedAt(a));
  for (const work of ordered) {
    const urls = githubPagesUrls([work.url, work.text].filter(Boolean).join(' '));
    if (!urls.length) continue;
    const key = String(work.sid || work.uid || work.id);
    if (!latest.has(key)) latest.set(key, { ...work, sites: urls });
  }
  return [...latest.values()].filter(w => `${w.name || ''} ${w.sid || ''} ${w.sites.join(' ')}`.toLowerCase().includes(query))
    .sort((a,b) => String(a.sid || '').localeCompare(String(b.sid || ''), 'ko', {numeric:true}));
}

export function studentSitesMarkup(rows, tasks) {
  if (!rows.length) return '<p class="empty">제출 글에서 GitHub Pages 주소를 찾지 못했습니다. 과제 선택이나 검색어를 확인해 주세요.</p>';
  return `<div class="student-sites-grid">${rows.map(row => {
    const task = tasks.find(t => t.id === row.taskId);
    const url = row.sites[0];
    return `<article class="student-site"><a class="student-site-preview" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(row.name)} 홈페이지 새 창으로 열기"><iframe src="${escapeHtml(url)}" title="${escapeHtml(row.name)} 홈페이지 미리보기" loading="lazy" sandbox="allow-scripts" referrerpolicy="no-referrer" credentialless tabindex="-1" aria-hidden="true"></iframe></a><div class="student-site-body"><h4>${escapeHtml(row.name || '학생')} <span>${escapeHtml(row.sid)}</span></h4><p class="student-site-task">${escapeHtml(task ? `${task.week}주차 · ${task.title}` : '제출한 과제')}</p>${row.sites.map((site,i) => `<a class="student-site-link" href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">${i ? '추가 홈페이지' : '홈페이지 열기'} ↗<small>${escapeHtml(site)}</small></a>`).join('')}</div></article>`;
  }).join('')}</div>`;
}

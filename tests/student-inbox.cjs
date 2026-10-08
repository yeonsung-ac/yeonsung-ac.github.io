const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync('courses/_class/class.js', 'utf8');
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
(async () => {
  fs.mkdirSync('../tmp', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const folder of ['01-management', '03-advertising', '04-consumer-behavior']) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const html = fs.readFileSync(`courses/${folder}/index.html`, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
        await page.setContent(html);
        await page.addStyleTag({ content: fs.readFileSync('styles.css', 'utf8') + fs.readFileSync('courses/_class/class.css', 'utf8') });
        await page.evaluate(code => {
          window.$ = id => document.getElementById(id);
          window.OWN_SUBMISSIONS = true;
          window.C = { intro: { title: '자기소개' } };
          window.state = { isProfessor: true, view: 'room', uid: 'professor-uid',
            worksStatus: 'ready', introsStatus: 'ready', answersStatus: 'ready', scoresStatus: 'ready',
            roster: [{ name: '학생 A', sid: '1001' }, { name: '학생 B', sid: '1002' }],
            tasks: [{ id: 't1', week: 3, title: '광고 분석 과제' }],
            allWorks: [
              { id: 't1_phone-a', taskId: 't1', uid: 'phone-a', sid: '1001', name: '학생 A', text: '학생 A의 기존 제출물', createdAt: new Date(), updatedAt: new Date() },
              { id: 't2_old-phone-a', taskId: 't2', uid: 'old-phone-a', sid: '1001', name: '학생 A', text: '학생 A의 이전 기기 제출물', createdAt: new Date(), updatedAt: new Date() },
              { id: 't1_phone-b', taskId: 't1', uid: 'phone-b', sid: '1002', name: '학생 B', text: '학생 B의 비공개 제출물', createdAt: new Date(), updatedAt: new Date() }],
            intros: [{ id: 'phone-a', uid: 'phone-a', sid: '1001', text: '<script>alert(1)</script>', updatedAt: new Date() }],
            all: [{ id: 'q1_phone-a', uid: 'phone-a', sid: '1001', quizId: 'q1', picks: [1, '서술형 답안'], submittedAt: new Date() }],
            quizzes: [{ id: 'q1', title: '수업 퀴즈', questions: [{ type: 'choice', text: '객관식 질문', options: ['보기 1', '보기 2'] }, { type: 'text', text: '서술형 질문' }] }],
            scores: { 't1_phone-a': { score: 95, memo: '교수 피드백' } } };
          window.esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
          window.when = value => value instanceof Date ? value : value?.toDate?.() || null;
          window.stamp = value => value?.toLocaleString('ko-KR') || '';
          window.ASKS = [{ label: '자기소개' }];
          window.renderProf = () => { $('prof-body').textContent = '교수 화면'; };
          (0, eval)(code);
          $('gate').hidden = true; $('room').hidden = false; $('prof').hidden = false;
          $('qr-band').hidden = true;
          installStudentInbox();
        }, source.match(/const partsOf = [^\n]+/)[0] + '\n' + ['saidHtml', 'installStudentInbox', 'refreshStudentInbox', 'inboxStudents', 'inboxRows', 'inboxStatus', 'renderStudentInbox'].map(extract).join('\n'));
        await page.getByRole('button', { name: '학생별 제출함', exact: true }).click();
        await page.locator('#inbox-student').selectOption('1001');
        const body = page.locator('#prof-body');
        const text = await body.innerText();
        assert.match(text, /학생 A의 기존 제출물/);
        assert.match(text, /학생 A의 이전 기기 제출물/);
        assert.doesNotMatch(text, /학생 B의 비공개 제출물/);
        assert.match(text, /95점/);
        assert.match(text, /교수 피드백/);
        assert.match(text, /보기 2/);
        assert.match(text, /서술형 답안/);
        assert.equal(await body.locator('script').count(), 0);
        assert.equal(await body.locator('input,textarea').count(), 0);
        assert.equal(await page.evaluate(() => state.uid), 'professor-uid');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await body.screenshot({ path: `../tmp/${folder}-${width}-student-inbox.png` });
        await page.locator('#inbox-student').selectOption('1002');
        assert.doesNotMatch(await body.innerText(), /학생 A의 기존|학생 A의 이전 기기|서술형 답안/);
        assert.match(await body.innerText(), /학생 B의 비공개 제출물/);
        await page.evaluate(() => { state.worksStatus = 'error'; refreshStudentInbox(); });
        assert.match(await body.innerText(), /불러오지 못했습니다/);
        await page.evaluate(() => { $('prof-body').textContent = 'student-safe'; state.isProfessor = false; renderStudentInbox(); });
        assert.equal(await body.innerText(), 'student-safe');
        console.log(`${folder}/${width}: professor-only, SID grouping across UIDs, content, errors and layout passed`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

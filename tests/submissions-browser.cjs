const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync('courses/_class/class.js', 'utf8');
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
(async () => {
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
          window.state = { me: { name: 'Test' }, uid: 'test-owner', isProfessor: false, worksStatus: 'ready',
            tasks: [{ id: 't1', week: 3, title: '제출 내역 확인 테스트', guide: '', open: true }],
            works: { t1: { taskId: 't1', uid: 'test-owner', text: '학생이 제출한 과제 내용입니다. 다시 로그인한 뒤에도 확인합니다.', createdAt: new Date(), updatedAt: new Date(), photoUrl: '' } }, scores: {} };
          window.esc = value => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
          window.when = value => value instanceof Date ? value : value?.toDate?.() || null;
          window.stamp = value => value?.toLocaleString('ko-KR') || '';
          window.dueText = () => '마감 없음'; window.dueOf = () => null;
          window.lateDays = () => 0; window.toast = () => {};
          window.markMemoSeen = () => {}; window.renderNotice = () => {};
          window.watchWorks = () => {};
          (0, eval)(code);
          $('gate').hidden = true; $('room').hidden = false;
          renderMySubmissions();
        }, ['renderMySubmissions', 'setTaskEditing', 'openTask'].map(extract).join('\n'));
        await page.getByRole('button', { name: /제출 내역 확인 테스트/ }).click();
        assert.equal(await page.locator('#tv-text').inputValue(), '학생이 제출한 과제 내용입니다. 다시 로그인한 뒤에도 확인합니다.');
        assert.equal(await page.locator('#tv-text').evaluate(el => el.readOnly), true);
        assert.equal(await page.locator('#tv-send').isVisible(), false);
        await page.screenshot({ path: `../tmp/${folder}-${width}-submission.png`, fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${folder}/${width} overflow`);
        await page.getByRole('button', { name: '제출 내용 수정', exact: true }).click();
        assert.equal(await page.locator('#tv-text').evaluate(el => el.readOnly), false);
        assert.equal(await page.locator('#tv-send').isVisible(), true);
        await page.getByRole('button', { name: '수정 취소', exact: true }).click();
        assert.equal(await page.locator('#tv-text').evaluate(el => el.readOnly), true);
        console.log(`${folder}/${width}: saved content, read-only, edit/cancel and layout passed`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

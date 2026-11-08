const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('courses/_class/student-sites.js','utf8').replaceAll('export function','function');
const {githubPagesUrls,studentSiteRows,studentSitesMarkup,studentSitesCsv} = new Function(source + '\nreturn {githubPagesUrls,studentSiteRows,studentSitesMarkup,studentSitesCsv}')();
assert.deepEqual(githubPagesUrls('홈페이지 https://alice.github.io/project/ 입니다'), ['https://alice.github.io/']);
assert.deepEqual(githubPagesUrls('(bob.github.io/demo/).'), ['https://bob.github.io/']);
assert.deepEqual(githubPagesUrls('https://alice.github.io.evil.com/ https://alice.github.io@evil.com/ https://evil.com/alice.github.io/'), []);
assert.deepEqual(githubPagesUrls('https://github.com/alice/repo javascript:alert(1)'), []);
const works=[
 {id:'old',sid:'1001',name:'학생 A',taskId:'one',text:'https://alice.github.io/old/',updatedAt:new Date(1)},
 {id:'new',sid:'1001',name:'학생 A',taskId:'two',text:'https://alice.github.io/new/',updatedAt:new Date(2)},
 {id:'other',sid:'1002',name:'학생 B',taskId:'two',text:'https://bob.github.io/',updatedAt:new Date(3)},
 {id:'no-site',sid:'1001',text:'주소 없이 보완 제출',updatedAt:new Date(4)}];
assert.equal(studentSiteRows(works).length,2);
assert.equal(studentSiteRows(works)[0].id,'new');
assert.equal(studentSiteRows(works,'one')[0].id,'old');
assert.equal(studentSiteRows(works)[0].sites[0],'https://alice.github.io/');
assert.equal(studentSiteRows([...works,{...works[0],sid:'1003'}]).length,3);
assert.equal(githubPagesUrls('https://alice.github.io/game/ https://alice.github.io/demo/?a=1#test').length,1);
assert.equal(studentSiteRows(works,'','학생 B')[0].id,'other');
assert.equal(studentSiteRows(works,'','no-match').length,0);
const html=studentSitesMarkup([{...works[0],name:'<img src=x onerror=alert(1)>',sites:['https://alice.github.io/']}],[]);
assert.ok(html.includes('&lt;img'));
assert.ok(!html.includes('<img src=x'));
assert.ok(html.includes('sandbox="allow-scripts"'));
assert.ok(!html.includes('allow-same-origin'));
assert.ok(html.includes('referrerpolicy="no-referrer"'));
const app=fs.readFileSync('courses/_class/class.js','utf8');
assert.ok(app.includes("if (!state.isProfessor || C.id !== 'cb') return;"));
console.log('PASS: GitHub host validation, latest student site, task and name filters, escaping and sandboxed previews.');

const csv=studentSitesCsv(studentSiteRows(works));
assert.ok(csv.includes('"1001","학생 A","https://alice.github.io/"'));
assert.ok(!csv.includes('/old/') && !csv.includes('/new/'));
assert.equal(studentSiteRows([...works,{id:'different',sid:'1001',text:'https://second.github.io/game/',updatedAt:new Date(5)}]).length,3);
console.log('PASS: root-domain-only CSV and multiple domains per student.');

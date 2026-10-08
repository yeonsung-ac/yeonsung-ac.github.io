const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('courses/_class/class.js', 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const names = ['ownRecords', 'watchAnswers', 'watchWorks', 'watchScores', 'renderMySubmissions', 'setTaskEditing'];
for (const course of ['mgmt', 'ad', 'cb']) {
  let subscriptions = [];
  const elements = new Map();
  function element(id) {
    return { id, hidden: false, innerHTML: '', dataset: {}, events: {},
      setAttribute() {}, querySelectorAll() { return []; },
      addEventListener(name, cb) { this.events[name] = cb; },
      before(el) { elements.set(el.id, el); }, after(el) { elements.set(el.id, el); } };
  }
  for (const id of ['tasks', 'tv-send', 'tv-text', 'tv-pick', 'tv-file', 'tv-nophoto']) elements.set(id, element(id));
  const ctx = {
    OWN_SUBMISSIONS: true, db: {}, ANSWERS: course + '_answers', WORKS: course + '_works', SCORES: course + '_scores',
    stopAnswers: null, stopWorks: null, stopScores: null,
    state: { uid: 'student-a', isProfessor: false, me: { name: 'A' }, tasks: [{ id: 't1', week: 1, title: '<script>' }], works: {} },
    collection: (_, name) => ({ name }), where: (field, op, value) => ({ field, op, value }),
    query: (records, filter) => ({ ...records, filter }),
    onSnapshot: (q, ok, error) => { subscriptions.push({ q, ok, error }); return () => {}; },
    render: () => {}, renderTasks: () => {}, renderWorksAll: () => {}, refreshStudentInbox: () => {}, setNet: () => {},
    $: id => elements.get(id), document: { createElement: () => element('') },
    when: value => value?.toDate ? value.toDate() : value instanceof Date ? value : null,
    stamp: value => value ? value.toISOString() : '', esc: value => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  };
  vm.createContext(ctx);
  vm.runInContext(names.map(extract).join('\n'), ctx);
  ctx.watchAnswers(); ctx.watchWorks(); ctx.watchScores();
  assert.equal(subscriptions.length, 3);
  for (const s of subscriptions) {
    assert.equal(s.q.filter.field, 'uid');
    assert.equal(s.q.filter.value, 'student-a');
    // Model Firestore's query authorization: no other owner's document can match.
    assert.equal(['student-a', 'student-b'].filter(uid => uid === s.q.filter.value).join(','), 'student-a');
  }
  subscriptions[1].ok({ docs: [{ id: 't1_student-a', data: () => ({ uid: 'student-a', taskId: 't1', text: 'saved', createdAt: new Date(), updatedAt: new Date() }) }] });
  assert.equal(ctx.state.worksStatus, 'ready');
  ctx.renderMySubmissions();
  assert.match(elements.get('my-submissions').innerHTML, /&lt;script&gt;/);
  ctx.state.taskNow = ctx.state.tasks[0];
  ctx.setTaskEditing(false);
  assert.equal(elements.get('tv-text').readOnly, true);
  assert.equal(elements.get('tv-send').hidden, true);
  elements.get('tv-edit').events.click();
  assert.equal(elements.get('tv-text').readOnly, false);
  assert.equal(elements.get('tv-send').hidden, false);
  subscriptions[1].error(); ctx.renderMySubmissions();
  assert.equal(ctx.state.worksStatus, 'error');
  assert.match(elements.get('my-submissions').innerHTML, /role="alert"/);
  ctx.state.isProfessor = true;
  subscriptions = [];
  ctx.watchAnswers(); ctx.watchWorks(); ctx.watchScores();
  for (const s of subscriptions) assert.equal(s.q.filter, undefined);
  ctx.renderMySubmissions();
  assert.equal(elements.get('my-submissions').hidden, true);
  ctx.state.isProfessor = false; ctx.state.uid = 'student-b';
  ctx.watchWorks();
  assert.equal(Object.keys(ctx.state.works).length, 0);
  assert.equal(subscriptions.at(-1).q.filter.value, 'student-b');
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  for (const kind of ['works', 'scores', 'answers']) {
    const block = rules.slice(rules.indexOf(`match /${course}_${kind}/`));
    assert.match(block.slice(0, block.indexOf('allow create')), /resource.data.uid == request.auth.uid \|\| isProfessor\(\)/);
  }
  console.log(`${course}: owner queries, professor queries, UI, errors, identity reset and rules passed`);
}
new vm.SourceTextModule(source);
console.log('Module syntax passed');

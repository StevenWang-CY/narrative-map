/* Regression checks for migration, isolated projects, and non-destructive imports. */
const assert = require('node:assert/strict');
const M = require('../dist/model.js');
const results = [];
function test(name, run) { run(); results.push({name, status:'passed'}); }
function other() { const d = M.initial(); d.plan.title = 'Research talk'; d.activeVersionId = null; d.versions = []; return d; }
test('Legacy workspace migrates without losing any draft or saved-version content', () => {
  const old = M.initial(); old.plan.blocks[0].seconds = 57; old.activeVersionId = null;
  const library = M.libraryFrom(old);
  assert(M.validLibrary(library)); assert.deepEqual(library.projects[0].data, old);
  library.projects[0].data.plan.blocks[0].seconds = 3;
  assert.equal(old.plan.blocks[0].seconds, 57);
});
test('Reloading a multi-project backup restores the selected project and all projects', () => {
  const library = M.addProject(M.libraryFrom(M.initial()), 'research', other());
  assert.deepEqual(M.libraryFrom(JSON.parse(JSON.stringify(library))), library);
  assert.equal(library.activeProjectId, 'research');
});
test('New projects have independent drafts and version collections', () => {
  const original = M.libraryFrom(M.initial()); const workspace = other();
  const added = M.addProject(original, 'research', workspace);
  added.projects[1].data.plan.blocks[0].seconds = 8;
  assert.equal(added.projects[0].data.plan.blocks[0].seconds, 90);
  assert.equal(added.projects[0].data.versions.length, 3);
  assert.equal(added.projects[1].data.versions.length, 0);
  assert.equal(workspace.plan.blocks[0].seconds, 90);
  assert.equal(original.projects.length, 1);
});
test('Duplicate project identities and names are rejected', () => {
  const l = M.libraryFrom(M.initial());
  assert.throws(() => M.addProject(l, l.activeProjectId, other()));
  assert.throws(() => M.addProject(l, 'other', M.initial()));
});
test('Invalid active-project pointers, malformed projects, and invalid nested versions are rejected', () => {
  const l = M.libraryFrom(M.initial()); l.activeProjectId = 'missing'; assert(!M.validLibrary(l));
  assert.equal(M.libraryFrom({schema:3,projects:[null]}), null);
  const bad = M.libraryFrom(M.initial()); bad.projects[0].data.versions[0].plan.blocks[0] = null;
  assert.equal(M.libraryFrom(bad), null);
});
test('Importing the same backup twice adds no extra projects', () => {
  const l = M.libraryFrom(M.initial());
  assert.deepEqual(M.mergeLibraries(l, l), l);
});
test('An imported edited project never overwrites the existing project', () => {
  const l = M.libraryFrom(M.initial()); const incoming = M.libraryFrom(M.initial());
  incoming.projects[0].data.plan.blocks[0].seconds = 54;
  incoming.projects[0].data.activeVersionId = null;
  const merged = M.mergeLibraries(l, incoming);
  assert.equal(merged.projects.length, 2); assert(M.validLibrary(merged));
  assert.equal(merged.projects[0].data.plan.blocks[0].seconds, 90);
  assert.equal(merged.projects[1].data.plan.blocks[0].seconds, 54);
  assert.notEqual(merged.projects[0].id, merged.projects[1].id);
  assert.notEqual(merged.projects[0].name, merged.projects[1].name);
  assert.equal(merged.activeProjectId, l.activeProjectId);
});
test('Different project IDs with identical names import as distinct projects', () => {
  const l = M.libraryFrom(M.initial()); const incoming = M.libraryFrom(M.initial());
  incoming.activeProjectId = incoming.projects[0].id = 'elsewhere';
  incoming.projects[0].data.versions.pop();
  const merged = M.mergeLibraries(l, incoming);
  assert.equal(merged.projects.length, 2); assert(M.validLibrary(merged));
});
test('Repeated collision imports recognize the previously renamed copy', () => {
  const l = M.libraryFrom(M.initial()); const incoming = M.libraryFrom(M.initial());
  incoming.projects[0].data.plan.blocks[0].seconds = 54;
  incoming.projects[0].data.activeVersionId = null;
  const once = M.mergeLibraries(l, incoming);
  assert.deepEqual(M.mergeLibraries(once, incoming), once);
});
test('Reimporting preserves an edited imported copy and adds the backup separately', () => {
  const l = M.libraryFrom(M.initial()); const incoming = M.libraryFrom(M.initial());
  incoming.projects[0].data.plan.blocks[0].seconds = 54;
  incoming.projects[0].data.activeVersionId = null;
  const once = M.mergeLibraries(l, incoming);
  once.projects[1].data.plan.blocks[0].seconds = 25;
  const merged = M.mergeLibraries(once, incoming);
  assert.equal(merged.projects.length, 3);
  assert.equal(merged.projects[1].data.plan.blocks[0].seconds, 25);
  assert.equal(merged.projects[2].data.plan.blocks[0].seconds, 54);
  assert.deepEqual(M.mergeLibraries(merged, incoming), merged);
});
test('Legacy backup imports remain supported in a library with other projects', () => {
  const l = M.addProject(M.libraryFrom(M.initial()), 'research', other());
  const merged = M.mergeLibraries(l, M.libraryFrom(M.initial()));
  assert.equal(merged.projects.length, 2);
  assert.equal(merged.activeProjectId, 'research');
});
test('Excessive project imports are rejected atomically', () => {
  const l = M.libraryFrom(M.initial());
  for(let i=1;i<100;i++) { const d=other(); d.plan.title='Talk '+i; l.projects.push({id:'p'+i,name:d.plan.title,data:d}); }
  const copy=M.clone(l);
  assert.throws(() => M.addProject(l, 'overflow', other()));
  assert.throws(() => M.mergeLibraries(l, M.libraryFrom(other())));
  assert.deepEqual(l, copy);
});
console.log(JSON.stringify({checks:results.length,results},null,2));

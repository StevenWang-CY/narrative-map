/* Behavior checks grounded in the supplied narrative and wireframes. */
const assert = require("node:assert/strict");
const M = require("../dist/model.js");
const results = [];
function test(name, fn) {
  fn();
  results.push({ name, status: "passed" });
}
function block(p, id) {
  return p.blocks.find((b) => b.id === id);
}
test("New wireframe uses eight blocks and a 4:00 / 5:00 / 3:00 speaker split", () => {
  const p = M.sample(),
    a = M.analyze(p);
  assert.equal(p.blocks.length, 8);
  assert.equal(a.total, 720);
  assert.deepEqual(
    a.bySpeaker.map((s) => s.seconds),
    [240, 300, 180],
  );
  assert.equal(a.ready, false);
  assert.equal(a.issues.length, 0);
});
test("Setting aside the definition saves 1:00 and breaks Interpretation", () => {
  const p = M.sample();
  block(p, "b02").included = false;
  const a = M.analyze(p);
  assert.equal(a.total, 660);
  assert.deepEqual(a.issues, [
    { kind: "missing", block: "b08", prerequisite: "b02" },
  ]);
  assert.equal(a.ready, false);
});
test("Restoring the definition and cutting Extra detail is 10:00 Ready", () => {
  const p = M.sample();
  block(p, "b06").included = false;
  const a = M.analyze(p);
  assert.equal(a.total, 600);
  assert.equal(a.ready, true);
});
test("The alternative cuts Example and changes Intro from 1:30 to 1:00", () => {
  const p = M.sample();
  block(p, "b03").included = false;
  block(p, "b01").seconds = 60;
  assert.equal(M.analyze(p).total, 600);
  assert.equal(M.analyze(p).ready, true);
});
test("Time fit does not hide a missing prerequisite", () => {
  const p = M.sample();
  block(p, "b02").included = false;
  block(p, "b01").seconds = 30;
  assert.equal(M.analyze(p).total, 600);
  assert.equal(M.analyze(p).ready, false);
});
test("An excluded dependent no longer demands its prerequisite", () => {
  const p = M.sample();
  block(p, "b02").included = false;
  block(p, "b08").included = false;
  assert.equal(M.analyze(p).issues.length, 0);
});
test("Reordering a whole speaker section checks prerequisite order", () => {
  const p = M.sample();
  p.speakers.reverse();
  assert.equal(M.analyze(p).issues[0].kind, "order");
});
test("Same-speaker later prerequisites can be repaired by moving the block", () => {
  const p = M.sample();
  block(p, "b01").requires = ["b02"];
  assert.equal(M.analyze(p).issues[0].kind, "order");
  M.moveBlock(p, "b02", "b01");
  assert.equal(M.analyze(p).issues.length, 0);
});
test("Moving across speaker rows reassigns the speaker and remains valid", () => {
  const p = M.sample();
  M.moveBlock(p, "b03", "b04");
  assert.equal(block(p, "b03").speaker, "priya");
  assert.equal(M.validate(p), true);
});
test("Empty plans and all-excluded plans are never Ready", () => {
  const p = M.sample();
  p.blocks = [];
  assert.equal(M.validate(p), true);
  assert.equal(M.analyze(p).ready, false);
  const q = M.sample();
  q.blocks.forEach((b) => (b.included = false));
  assert.equal(M.analyze(q).ready, false);
});
test("Multiple prerequisites are all checked", () => {
  const p = M.sample();
  block(p, "b08").requires.push("b05");
  block(p, "b02").included = false;
  block(p, "b05").included = false;
  assert.equal(M.analyze(p).issues.length, 2);
});
test("Cycles are rejected including cycles involving excluded blocks", () => {
  const p = M.sample();
  block(p, "b02").requires = ["b08"];
  block(p, "b02").included = false;
  assert.equal(M.validate(p), false);
});
test("Duration parsing rejects zero, bad seconds, nonnumeric and oversized input", () => {
  for (const value of [
    "0",
    "0:00",
    "1:60",
    "-1",
    "abc",
    "1:2",
    "1000:00",
    "600:00",
  ])
    assert.equal(M.parseDuration(value), null, value);
  assert.equal(M.parseDuration("1:30"), 90);
  assert.equal(M.parseDuration("10"), 600);
  assert.equal(M.parseDuration(" 0:01 "), 1);
});
test("Saved plans are independent snapshots with stable block identities", () => {
  const d = M.initial();
  d.plan.blocks[0].seconds = 10;
  assert.equal(d.versions[0].plan.blocks[0].seconds, 90);
  assert.equal(d.versions[1].plan.blocks[0].seconds, 90);
});
test("Comparison identifies precisely the three blocks different between the two example cuts", () => {
  const d = M.initial();
  assert.deepEqual(
    M.compare(d.versions[1].plan, d.versions[2].plan)
      .filter((r) => r.changed)
      .map((r) => r.id),
    ["b01", "b03", "b06"],
  );
});
test("Comparison detects changed prerequisites and notes, not only time", () => {
  const p = M.sample(),
    q = M.clone(p);
  block(q, "b08").requires = [];
  block(q, "b03").notes = "A revised speaking note.";
  assert.deepEqual(
    M.compare(p, q)
      .filter((r) => r.changed)
      .map((r) => r.id),
    ["b03", "b08"],
  );
});
test("Backups reject malformed blocks, duplicate speaker names, and missing prerequisites", () => {
  const d = M.initial();
  assert.equal(M.validBackup(d), true);
  const a = M.clone(d);
  a.plan.blocks[0] = null;
  assert.equal(M.validBackup(a), false);
  const b = M.clone(d);
  b.plan.speakers[1].name = "alex";
  assert.equal(M.validBackup(b), false);
  const c = M.clone(d);
  c.plan.blocks[0].requires = ["missing"];
  assert.equal(M.validBackup(c), false);
});
test("Backups reject ambiguous saved version names and identities", () => {
  const d = M.initial();
  d.versions[1].id = d.versions[0].id;
  assert.equal(M.validBackup(d), false);
  const e = M.initial();
  e.versions[1].name = e.versions[0].name.toUpperCase();
  assert.equal(M.validBackup(e), false);
});
test("Import retains different colliding copies and does not duplicate identical originals", () => {
  const d = M.initial();
  assert.equal(M.mergeVersions(d.versions, d.versions).length, 3);
  const incoming = M.clone(d.versions[0]);
  incoming.plan.blocks[0].seconds = 60;
  const merged = M.mergeVersions(d.versions, [incoming]);
  assert.equal(merged.length, 4);
  assert.notEqual(merged[0].id, merged[3].id);
  assert.notEqual(merged[0].name, merged[3].name);
  assert.equal(merged[0].plan.blocks[0].seconds, 90);
});
test("Every one of the 256 possible cuts has correct arithmetic and prerequisite status", () => {
  for (let mask = 0; mask < 256; mask++) {
    const p = M.sample();
    p.blocks.forEach((b, i) => (b.included = !!(mask & (1 << i))));
    const a = M.analyze(p),
      sum = p.blocks
        .filter((b) => b.included)
        .reduce((s, b) => s + b.seconds, 0);
    assert.equal(a.total, sum);
    assert.equal(
      a.ready,
      sum > 0 &&
        sum <= 600 &&
        (!block(p, "b08").included || block(p, "b02").included),
    );
  }
});
console.log(
  JSON.stringify(
    { checks: results.length, cutCombinations: 256, results },
    null,
    2,
  ),
);

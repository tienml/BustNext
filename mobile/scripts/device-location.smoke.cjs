const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/utils/deviceLocation.ts');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: mod, exports: mod.exports, setTimeout, clearTimeout, Date, Promise });
const { acquireLocation, isUsableLocation, describeLocation } = mod.exports;
const fix = (timestamp = Date.now(), accuracy = 25) => ({ timestamp,
  coords: { latitude: 10.7, longitude: 106.7, accuracy } });
async function main() {
  assert.equal(isUsableLocation(fix()), true);
  assert.equal(isUsableLocation(fix(Date.now() - 300001)), false);
  assert.equal(isUsableLocation(fix(Date.now() + 60000)), false);
  assert.equal(isUsableLocation(fix(Date.now(), null)), false);
  assert.equal(isUsableLocation(fix(Date.now(), 1001)), false);
  assert.equal(isUsableLocation({ ...fix(), coords: { latitude: NaN, longitude: 106, accuracy: 10 } }), false);
  assert.match(describeLocation(fix(), true), /đã lưu.*25 m/);
  let removed = 0;
  const signal = new AbortController().signal;
  const subscription = { remove: () => { removed++; } };
  const current = fix();
  assert.equal(await acquireLocation(async (next) => { next(current); return subscription; }, signal), current);
  await new Promise(setImmediate);
  assert.equal(removed, 1, 'Synchronous callback before setup must remove late subscription');

  let resolveSetup;
  const controller = new AbortController();
  const pending = acquireLocation(() => new Promise((resolve) => { resolveSetup = resolve; }), controller.signal);
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(pending, /location_cancelled/);
  resolveSetup(subscription);
  await new Promise(setImmediate); await Promise.resolve(); await Promise.resolve();
  assert.equal(removed, 2, 'Late subscription after unmount must be removed');

  let emit;
  const timed = acquireLocation(async (next) => { emit = next; return subscription; }, signal, 5);
  await assert.rejects(timed, /location_timeout/);
  assert.equal(removed, 3);
  emit(current);
  assert.equal(removed, 3, 'Callbacks after settlement must be ignored');

  await assert.rejects(acquireLocation(async (_, fail) => { fail(new Error('denied')); return subscription; }, signal), /denied/);
  await new Promise(setImmediate);
  assert.equal(removed, 4);
  await assert.rejects(acquireLocation(async () => { throw new Error('setup'); }, signal), /setup/);
  const aborted = new AbortController(); aborted.abort();
  let started = false;
  await assert.rejects(acquireLocation(async () => { started = true; return subscription; }, aborted.signal), /cancelled/);
  assert.equal(started, false);
  const filtered = acquireLocation(async (next) => {
    next(fix(Date.now() - 120000)); next(fix(Date.now(), 5000)); next(current);
    return subscription;
  }, signal);
  assert.equal(await filtered, current, 'Ignore stale or overly coarse live fixes');
  console.log('PASS: cache validation/disclosure, fresh fix filtering, timeout, abort, errors, late subscription cleanup, and late callback guard');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

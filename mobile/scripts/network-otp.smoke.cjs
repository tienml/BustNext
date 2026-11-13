// Isolated mocks only: no network, SMTP, environment files, or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, globals = {}, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, AbortController, FormData, URLSearchParams,
    setTimeout, clearTimeout, process: { env: {} },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
    ...globals,
  }, { filename: file });
  return module.exports;
}
const instances = [];
class MockXHR {
  constructor() { instances.push(this); this.headers = {}; this.status = 200; this.responseText = '{"data":{"ok":true}}'; }
  open(method, url, async) { Object.assign(this, { method, url, async }); }
  setRequestHeader(key, value) { this.headers[key] = value; }
  send(body) { this.body = body; }
  abort() { this.aborted = true; this.onabort?.(); }
  complete(status, text = this.responseText) { this.status = status; this.responseText = text; this.onload?.(); }
}
const transport = load('src/api/transport.ts', {
  XMLHttpRequest: MockXHR,
  Response() { throw new Error('Must never construct Response'); },
}, { 'react-native': { Platform: { OS: 'android' } } });
function client(globals = {}) {
  return load('src/api/client.ts', globals, { './transport': transport }).apiClient.withToken('mock-token');
}
const latest = () => instances.at(-1);
async function main() {
  for (const status of [0, 199, 600]) {
    const pending = client().health();
    latest().complete(status);
    await assert.rejects(pending, error => error.code === 'NETWORK_ERROR');
    assert.equal(latest().onload, null);
  }
  for (const event of ['onerror', 'ontimeout']) {
    const pending = client().health(); latest()[event]();
    await assert.rejects(pending, error => error.code === 'NETWORK_ERROR');
  }
  const api = client();
  let pending = api.post('/test', { value: 1 });
  assert.equal(latest().headers.Authorization, 'Bearer mock-token');
  assert.equal(latest().headers['Content-Type'], 'application/json');
  assert.equal(latest().body, '{"value":1}');
  latest().complete(201);
  assert.equal((await pending).data.ok, true);
  pending = api.delete('/test'); latest().complete(204, '');
  assert.equal((await pending).data, null);
  pending = api.health(); latest().complete(422, '{"errors":[{"code":"INVALID","message":"Invalid input"}]}');
  await assert.rejects(pending, error => error.code === 'INVALID' && error.status === 422);
  pending = api.health(); latest().complete(502, '<html>bad gateway</html>');
  await assert.rejects(pending, error => error.code === 'INVALID_RESPONSE' && error.status === 502);
  for (const preAborted of [true, false]) {
    const controller = new AbortController();
    const count = instances.length;
    if (preAborted) controller.abort();
    pending = api.get('/test', controller.signal);
    if (!preAborted) controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(instances.length, count + (preAborted ? 0 : 1));
    if (!preAborted) assert.equal(latest().aborted, true);
  }
  let fireTimeout, cleared;
  pending = client({
    setTimeout(fn, ms) { assert.equal(ms, 20000); fireTimeout = fn; return 77; },
    clearTimeout(id) { cleared = id; },
  }).health();
  const lateCallback = latest().onload;
  fireTimeout();
  await assert.rejects(pending, error => error.code === 'TIMEOUT');
  assert.equal(latest().aborted, true);
  assert.equal(cleared, 77);
  lateCallback(); // A late native callback must neither resolve nor throw.
  const form = new FormData(); form.append('label', 'test');
  pending = transport.requestJson('https://example.test/upload', {
    method: 'POST', headers: {}, body: form, signal: new AbortController().signal,
  });
  assert.equal(latest().body, form);
  assert.equal(latest().headers['Content-Type'], undefined);
  latest().complete(200); await pending;
  pending = api.importVersion(1, { uri: 'file:///mock.zip', name: 'mock.zip' });
  assert.ok(latest().body instanceof FormData);
  assert.equal(latest().headers['Content-Type'], undefined);
  latest().complete(422, '{"status":"failed","version":{"id":1},"errors":[],"warnings":[]}');
  assert.equal((await pending).status, 'failed');
  let webCalls = 0;
  const web = load('src/api/transport.ts', { fetch: async () => { webCalls++; return { status: 200 }; } }, {
    'react-native': { Platform: { OS: 'web' } },
  });
  await web.requestJson('https://example.test', { method: 'GET', headers: {}, signal: new AbortController().signal });
  assert.equal(webCalls, 1);
  const timing = load('src/utils/otpTiming.ts');
  const start = 1000000, resendAt = start + 60000;
  assert.equal(timing.remainingSeconds(resendAt, start), 60);
  assert.equal(timing.remainingSeconds(resendAt, start + 59001), 1);
  assert.equal(timing.remainingSeconds(resendAt, start + 60000), 0);
  assert.equal(timing.remainingSeconds(resendAt, start + 300000), 0);
  assert.equal(timing.otpValidityLabel(300), '5 phút');
  // Contract guards, not database/runtime tests.
  const service = fs.readFileSync(path.join(root, '../backend/app/Services/PasswordResetOtpService.php'), 'utf8');
  assert.match(service, /EXPIRES_SECONDS = 300/);
  assert.match(service, /RESEND_SECONDS = 60/);
  assert.match(service, /addSeconds\(self::EXPIRES_SECONDS\)/);
  assert.match(service, /lessThanOrEqualTo\(CarbonImmutable::now\(\)\)/);
  const screen = fs.readFileSync(path.join(root, 'src/screens/AccountScreen.tsx'), 'utf8');
  assert.match(screen, /setOtpExpiresIn\(response.data.expires_in\)/);
  assert.match(screen, /remainingSeconds\(resendAt\)/);
  console.log('PASS: native status 0/invalid status, network events, 20s timeout, pre-abort/abort, late callback, JSON/204/HTTP errors, invalid JSON, FormData/upload 422, web fetch, OTP 300s vs resend 60s contract and wall-clock cooldown.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

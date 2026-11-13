// Local-only test: transpiles existing TypeScript in memory; no build output or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relativePath, globals = {}, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    module, exports: module.exports, URL, URLSearchParams, AbortController, FormData,
    setTimeout, clearTimeout,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: relativePath });
  return module.exports;
}

const configuration = load('src/utils/apiConfiguration.ts');
const resolve = configuration.resolveApiConfiguration;
const validUrl = 'https://api.example.com/api';
const invalidReleaseUrls = [
  undefined, '', '   ', 'garbage', '/api', '//api.example.com/api',
  'http://api.example.com/api', 'ftp://api.example.com/api',
  'https://localhost/api', 'https://LOCALHOST./api', 'https://test.localhost/api',
  'https://127.0.0.1/api', 'https://127.1/api', 'https://2130706433/api',
  'https://0x7f000001/api', 'https://0.0.0.0/api', 'https://[::1]/api',
  'https://[::]/api', 'https://[::ffff:127.0.0.1]/api',
  'https://[::ffff:7f00:1]/api', 'https://user:password@api.example.com/api',
  'https://api.example.com/api?token=secret', 'https://api.example.com/api#fragment',
  'https://api.example.com\\api',
];
for (const value of invalidReleaseUrls) {
  const result = resolve(value, false);
  assert.ok(result.error?.includes('EXPO_PUBLIC_API_URL'), `Must reject ${value}`);
  assert.equal(result.baseUrl, '');
  assert.ok(!result.error.includes('password@'), 'Do not expose supplied credentials');
}
assert.equal(resolve(`  ${validUrl}///  `, false).baseUrl, validUrl);
assert.equal(resolve('https://api.example.com:8443/api', false).error, undefined);
assert.equal(resolve(undefined, true).baseUrl, 'http://localhost:8000/api');
assert.equal(resolve('http://192.168.1.2:8000/api', true).error, undefined);
assert.ok(resolve('https://user:password@api.example.com', true).error);

function clientModule(value, development, fetch, extra = {}) {
  return load('src/api/client.ts', {
    __DEV__: development, process: { env: { EXPO_PUBLIC_API_URL: value } }, fetch, ...extra,
  }, { '../utils/apiConfiguration': configuration });
}

async function main() {
  let fetchCalls = 0;
  const success = async () => {
    fetchCalls++;
    return { ok: true, status: 200, json: async () => ({ data: { status: 'ok' } }) };
  };
  // Import and construction must never throw, even in an unconfigured release.
  for (const value of invalidReleaseUrls) {
    const { apiClient, ApiError } = clientModule(value, false, success);
    for (const client of [apiClient, apiClient.withToken('test-token')]) {
      await assert.rejects(client.health(), error => error instanceof ApiError &&
        error.code === 'API_CONFIGURATION_ERROR' && error.message.includes('EXPO_PUBLIC_API_URL'));
    }
  }
  assert.equal(fetchCalls, 0, 'Invalid configuration must never reach fetch');

  let captured;
  const { apiClient } = clientModule(validUrl + '/', false, async (url, options) => {
    captured = { url, options };
    return success();
  });
  await apiClient.withToken('test-token').post('/v1/test', { name: 'test' });
  assert.equal(captured.url, `${validUrl}/v1/test`);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
  assert.equal(captured.options.body, '{"name":"test"}');
  assert.equal(captured.options.signal.aborted, false);

  const development = clientModule(undefined, true, async url => {
    assert.equal(url, 'http://localhost:8000/api/health');
    return success();
  });
  await development.apiClient.health();

  const abortError = new Error('cancelled');
  const cancellation = clientModule(validUrl, false, (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(abortError);
    else options.signal.addEventListener('abort', () => reject(abortError), { once: true });
  }));
  for (const preAborted of [true, false]) {
    const controller = new AbortController();
    if (preAborted) controller.abort();
    const request = cancellation.apiClient.get('/health', controller.signal);
    if (!preAborted) controller.abort();
    await assert.rejects(request, error => error === abortError);
  }

  const network = clientModule(validUrl, false, async () => { throw new Error('offline'); });
  await assert.rejects(network.apiClient.health(), error => error.code === 'NETWORK_ERROR');
  let fireTimeout;
  let cleared = false;
  const timeout = clientModule(validUrl, false, (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(abortError), { once: true });
  }), {
    setTimeout(callback) { fireTimeout = callback; return 1; },
    clearTimeout(id) { assert.equal(id, 1); cleared = true; },
  });
  const request = timeout.apiClient.health();
  fireTimeout();
  await assert.rejects(request, error => error.code === 'TIMEOUT');
  assert.ok(cleared);
  console.log(`PASS: ${invalidReleaseUrls.length} invalid release configurations; HTTPS normalization; development fallback; safe import; token cloning; request headers/body; cancellation; timeout; network errors.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });

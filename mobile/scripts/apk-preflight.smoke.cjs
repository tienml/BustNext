'use strict';

const assert = require('node:assert/strict');
const { check, isPublicHttps } = require('./apk-preflight.cjs');
let cases = 0;
function test(name, fn) {
  fn();
  cases += 1;
  console.log(`PASS: ${name}`);
}

function fixture(profile = 'preview') {
  return {
    // Synthetic test-only UUID; never written to app.json or used for EAS.
    app: { expo: { name: 'Test', slug: 'test', version: '1.0.0', android: { package: 'org.example.test' }, extra: { eas: { projectId: '12345678-1234-4123-8123-123456789abc' } } } },
    eas: { build: { preview: { distribution: 'internal', android: { buildType: 'apk' } }, production: { distribution: 'store', android: { buildType: 'app-bundle' } } } },
    env: { EXPO_PUBLIC_API_URL: 'https://api.example.com/api' },
    profile,
  };
}

for (const profile of ['preview', 'production']) {
  test(`valid ${profile} synthetic configuration`, () => assert.deepEqual(check(fixture(profile)), []));
}
test('default is preview', () => {
  const input = fixture();
  delete input.profile;
  assert.deepEqual(check(input), []);
});
const invalidUrls = [undefined, '', ' https://api.example.com', 'http://api.example.com', 'ftp://api.example.com', 'https:api.example.com', 'https://user:secret@api.example.com', 'https://api.example.com?token=secret', 'https://api.example.com/#secret', 'https://localhost', 'https://LOCALHOST.', 'https://test.localhost', 'https://backend.local', 'https://backend.internal', 'https://backend', 'https://0.0.0.0', 'https://127.1', 'https://2130706433', 'https://0x7f000001', 'https://10.0.2.2', 'https://192.168.1.2', 'https://172.16.1.2', 'https://169.254.1.2', 'https://100.64.1.2', 'https://[::1]', 'https://[::]', 'https://[::ffff:127.0.0.1]', 'https://[fc00::1]', 'https://[fe80::1]', 'https://api.example.test', 'https://api.example.invalid', 'https://api.example.com\\@localhost'];
invalidUrls.forEach((url, i) => test(`reject unsafe URL case ${i + 1} without printing input`, () => {
  assert.equal(isPublicHttps(url), false);
  const input = fixture();
  input.env.EXPO_PUBLIC_API_URL = url;
  const errors = check(input);
  assert.ok(errors.length > 0);
  assert.ok(!JSON.stringify(errors).includes('secret'));
}));
for (const url of ['https://api.example.com:8443/api', 'https://8.8.8.8/api', 'https://[2606:4700:4700::1111]/api']) {
  test('accept global HTTPS syntax', () => assert.equal(isPublicHttps(url), true));
}
const mutations = [
  ['missing explicit API', input => { input.env = {}; }],
  ['missing project link', input => { delete input.app.expo.extra; }],
  ['invalid project UUID', input => { input.app.expo.extra.eas.projectId = 'placeholder'; }],
  ['missing package', input => { delete input.app.expo.android.package; }],
  ['missing version', input => { delete input.app.expo.version; }],
  ['missing profile', input => { delete input.eas.build.preview; }],
  ['unsupported profile', input => { input.profile = 'development'; }],
  ['development client', input => { input.eas.build.preview.developmentClient = true; }],
  ['wrong artifact type', input => { input.eas.build.preview.android.buildType = 'app-bundle'; }],
  ['wrong distribution', input => { input.eas.build.preview.distribution = 'store'; }],
  ['profile API override', input => { input.eas.build.preview.env = { EXPO_PUBLIC_API_URL: 'https://other.example.com' }; }],
  ['cyclic inheritance', input => { input.eas.build.preview.extends = 'preview'; }],
  ['missing inherited profile', input => { input.eas.build.preview.extends = 'missing'; }],
];
for (const [name, mutate] of mutations) test(`reject ${name}`, () => {
  const input = fixture();
  mutate(input);
  assert.ok(check(input).length > 0);
});
test('inherit valid profile', () => {
  const input = fixture();
  input.eas.build.base = input.eas.build.preview;
  input.eas.build.preview = { extends: 'base' };
  assert.deepEqual(check(input), []);
});
test('inherited unsafe override remains blocked', () => {
  const input = fixture();
  input.eas.build.base = { env: { EXPO_PUBLIC_API_URL: 'http://localhost' } };
  input.eas.build.preview.extends = 'base';
  assert.ok(check(input).length > 0);
});
console.log(`Completed ${cases} local synthetic cases; no network, environment files or EAS CLI used.`);

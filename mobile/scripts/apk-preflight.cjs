'use strict';

// Local only: never loads .env, invokes Expo/EAS, resolves DNS, or logs values.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

function isPublicHttps(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return false;
  try {
    // Require an explicit, ordinary URL; reject query/fragment to avoid embedded tokens.
    if (!/^https:\/\//i.test(value) || /[\\\s]/.test(value)) return false;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (net.isIP(host) === 4) {
      const [a, b] = host.split('.').map(Number);
      return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
    }
    if (net.isIP(host) === 6) {
      // Restrict literals to global unicast; excludes loopback, mapped IPv4,
      // unspecified, link-local and unique-local addresses.
      return /^[23][0-9a-f]{3}:/.test(host);
    }
    return host.includes('.') && !host.endsWith('.test') && !host.endsWith('.invalid');
  } catch {
    return false;
  }
}

function resolveProfile(build, name, seen = new Set()) {
  if (!build || !Object.hasOwn(build, name) || seen.has(name)) throw new Error('profile');
  const own = build[name];
  if (!own || typeof own !== 'object' || Array.isArray(own)) throw new Error('profile');
  seen.add(name);
  const base = own.extends ? resolveProfile(build, own.extends, seen) : {};
  return { ...base, ...own, android: { ...base.android, ...own.android }, env: { ...base.env, ...own.env } };
}

function check({ app, eas, env = {}, profile = 'preview' }) {
  const errors = [];
  if (!['preview', 'production'].includes(profile)) return ['Profile must be preview or production.'];
  const api = env.EXPO_PUBLIC_API_URL;
  if (!isPublicHttps(api)) errors.push('Set EXPO_PUBLIC_API_URL explicitly to a public HTTPS backend URL without credentials, query or fragment.');
  const expo = app && app.expo;
  if (!expo || !['name', 'slug', 'version'].every(key => typeof expo[key] === 'string' && expo[key].trim())) {
    errors.push('app.json must define expo.name, expo.slug and expo.version.');
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(expo?.android?.package || '')) {
    errors.push('app.json must define a valid expo.android.package.');
  }
  const projectId = expo?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    errors.push('Link the real Expo project first: expo.extra.eas.projectId must be a valid project UUID (never invent one).');
  }
  try {
    const selected = resolveProfile(eas?.build, profile);
    if (selected.developmentClient === true) errors.push('Standalone builds cannot enable developmentClient.');
    const expectedType = profile === 'preview' ? 'apk' : 'app-bundle';
    if (selected.android.buildType !== expectedType) errors.push(`The ${profile} Android buildType must be ${expectedType}.`);
    const expectedDistribution = profile === 'preview' ? 'internal' : 'store';
    if (selected.distribution !== expectedDistribution) errors.push(`The ${profile} distribution must be ${expectedDistribution}.`);
    if (selected.env.EXPO_PUBLIC_API_URL !== undefined && selected.env.EXPO_PUBLIC_API_URL !== api) {
      errors.push('The selected EAS profile API URL differs from the explicitly checked environment. Align both before building.');
    }
  } catch {
    errors.push('eas.json must define the selected build profile with valid, non-cyclic inheritance.');
  }
  return errors;
}

function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args[0] && !['preview', 'production'].includes(args[0]))) {
    console.error('Usage: node scripts/apk-preflight.cjs [preview|production]');
    return 1;
  }
  const profile = args[0] || 'preview';
  const root = path.resolve(__dirname, '..');
  try {
    if (['app.config.js', 'app.config.ts', 'app.config.cjs', 'app.config.mjs'].some(name => fs.existsSync(path.join(root, name)))) {
      console.error('FAIL: Dynamic Expo configuration needs a separate resolved-config review; static preflight cannot approve it.');
      return 1;
    }
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
    const errors = check({ app, eas, env: process.env, profile });
    for (const error of errors) console.error(`FAIL: ${error}`);
    if (errors.length) return 1;
    console.log(`PASS: Local ${profile} configuration checks only; no network, upload or signing performed.`);
    console.log('Review EAS remote environment overrides and the source archive before authorizing a cloud build. This does not prove backend reachability or native build success.');
    return 0;
  } catch {
    // Do not print parser errors: configuration contents may contain secrets.
    console.error('FAIL: Cannot read valid app.json/eas.json. No configuration values were logged.');
    return 1;
  }
}

module.exports = { check, isPublicHttps, resolveProfile, main };
if (require.main === module) process.exitCode = main();

/**
 * Run: npx tsx scripts/test-native-update-policy.ts
 * Exercises src/native/updatePolicy.ts: when an install may take a web bundle and when it must be
 * offered a new APK instead.
 */
import assert from 'node:assert/strict';
import { decideUpdate, isTrustedApkUrl, parseInstalledBuild, type AppVersionRow } from '../src/native/updatePolicy';

const BASE = 'https://oujijpepbkqpgzgegoqf.supabase.co';
const SHA = 'AB'.repeat(32); // uppercase on purpose: the offer must be normalised to lowercase
const apkUrl = (code: number) => `${BASE}/storage/v1/object/public/app-updates/apks/xpresso-${code}.apk`;

function row(over: Partial<AppVersionRow> = {}): AppVersionRow {
  return {
    version: '1.0.60',
    bundle_url: `${BASE}/storage/v1/object/public/app-updates/bundles/1.0.60.zip`,
    min_native_version: 58,
    native_version: 60,
    apk_url: apkUrl(60),
    apk_sha256: SHA,
    apk_size: 31_000_000,
    ...over,
  };
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e: any) { console.error('  FAIL ' + name + '\n       ' + (e?.message ?? e)); process.exitCode = 1; }
};

console.log('decideUpdate');
test('install new enough: web bundle allowed, no APK offer', () => {
  const d = decideUpdate(row(), 58, BASE);
  assert.deepEqual([d.allowWebBundle, d.nativeUpdate, d.nativeUpdateRequired], [true, null, false]);
});
test('install newer than min: allowed', () => {
  assert.equal(decideUpdate(row(), 70, BASE).allowWebBundle, true);
});
test('install too old: bundle blocked, verified APK offered', () => {
  const d = decideUpdate(row(), 57, BASE);
  assert.equal(d.allowWebBundle, false);
  assert.equal(d.nativeUpdateRequired, true);
  assert.deepEqual(d.nativeUpdate, {
    version: '1.0.60', nativeVersion: 60, apkUrl: apkUrl(60), sha256: SHA.toLowerCase(), size: 31_000_000,
  });
});
test('very old install (versionCode 1) is offered the APK', () => {
  assert.equal(decideUpdate(row(), 1, BASE).nativeUpdate?.nativeVersion, 60);
});
test('too old but APK not published yet: blocked, no offer', () => {
  const d = decideUpdate(row({ apk_url: null, apk_sha256: null, native_version: null }), 57, BASE);
  assert.deepEqual([d.allowWebBundle, d.nativeUpdate, d.nativeUpdateRequired], [false, null, true]);
});
test('unknown installed build behaves like before native gating', () => {
  const d = decideUpdate(row(), null, BASE);
  assert.deepEqual([d.allowWebBundle, d.nativeUpdate], [true, null]);
});
test('row from the old publisher (no native columns) is always allowed', () => {
  const d = decideUpdate({ version: '1.0.50', bundle_url: 'x' }, 1, BASE);
  assert.equal(d.allowWebBundle, true);
});
test('min_native_version null / 0 / negative / fractional counts as 1', () => {
  for (const m of [null, 0, -3, 2.5, undefined]) {
    assert.equal(decideUpdate(row({ min_native_version: m as any }), 1, BASE).allowWebBundle, true, String(m));
  }
});

console.log('offer is refused when the row cannot be trusted');
test('APK on another host', () => {
  const bad = 'https://evil.example.com/storage/v1/object/public/app-updates/apks/xpresso-60.apk';
  assert.equal(decideUpdate(row({ apk_url: bad }), 57, BASE).nativeUpdate, null);
});
test('http instead of https', () => {
  assert.equal(decideUpdate(row({ apk_url: apkUrl(60).replace('https', 'http') }), 57, BASE).nativeUpdate, null);
});
test('path outside apks/ (e.g. the bundles zip)', () => {
  const bad = `${BASE}/storage/v1/object/public/app-updates/bundles/1.0.60.zip`;
  assert.equal(decideUpdate(row({ apk_url: bad }), 57, BASE).nativeUpdate, null);
});
test('private storage path', () => {
  const bad = `${BASE}/storage/v1/object/authenticated/app-updates/apks/xpresso-60.apk`;
  assert.equal(decideUpdate(row({ apk_url: bad }), 57, BASE).nativeUpdate, null);
});
test('not an .apk', () => {
  assert.equal(decideUpdate(row({ apk_url: apkUrl(60).replace('.apk', '.zip') }), 57, BASE).nativeUpdate, null);
});
test('missing or malformed sha256', () => {
  for (const s of [null, '', 'abc', 'z'.repeat(64), 'a'.repeat(63)]) {
    assert.equal(decideUpdate(row({ apk_sha256: s as any }), 57, BASE).nativeUpdate, null, String(s));
  }
});
test('APK older than min_native_version', () => {
  assert.equal(decideUpdate(row({ native_version: 57 }), 50, BASE).nativeUpdate, null);
});
test('APK not newer than what is installed', () => {
  // Installed 59 < min 60, but the published APK is also 59: installing it would be a no-op loop.
  assert.equal(decideUpdate(row({ min_native_version: 60, native_version: 59 }), 59, BASE).nativeUpdate, null);
});
test('missing native_version', () => {
  assert.equal(decideUpdate(row({ native_version: null }), 57, BASE).nativeUpdate, null);
});
test('size is null when absent or not a number', () => {
  assert.equal(decideUpdate(row({ apk_size: null }), 57, BASE).nativeUpdate?.size, null);
});

console.log('isTrustedApkUrl');
test('accepts the exact published shape', () => assert.equal(isTrustedApkUrl(apkUrl(7), BASE), true));
test('rejects path traversal', () => {
  assert.equal(isTrustedApkUrl(`${BASE}/storage/v1/object/public/app-updates/apks/../../x.apk`, BASE), false);
});
test('rejects garbage', () => assert.equal(isTrustedApkUrl('not a url', BASE), false));
test('rejects look-alike host', () => {
  assert.equal(isTrustedApkUrl(apkUrl(7).replace('supabase.co', 'supabase.co.evil.com'), BASE), false);
});

console.log('parseInstalledBuild');
test('string from App.getInfo()', () => assert.equal(parseInstalledBuild('57'), 57));
test('number', () => assert.equal(parseInstalledBuild(57), 57));
test('garbage / empty / zero / negative -> null', () => {
  for (const v of ['abc', '', '0', '-4', undefined, null, NaN]) assert.equal(parseInstalledBuild(v), null, String(v));
});

console.log(`\n${passed} passed${process.exitCode ? ', with FAILURES' : ''}`);

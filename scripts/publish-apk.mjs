// Publishes the signed release APK so installed apps can update themselves (see XpressoUpdaterPlugin).
//
// Runs in CI after the APK is built and after scripts/publish-live-update.mjs created the
// app_versions row for BUNDLE_VERSION. It uploads apks/xpresso-<VERSION_CODE>.apk to the public
// app-updates bucket and fills apk_url / apk_sha256 / apk_size / native_version on that row.
//
//   node scripts/publish-apk.mjs            publish
//   node scripts/publish-apk.mjs --dry-run  validate the APK and print the row, touch nothing
//
// Env: APK_PATH, BUNDLE_VERSION (e.g. 1.0.57), VERSION_CODE (e.g. 57), SUPABASE_URL,
//      SUPABASE_SERVICE_ROLE_KEY

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // Not supported on this runtime; ignore.
}

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'app-updates';
const KNOWN_PROJECT_URL = 'https://oujijpepbkqpgzgegoqf.supabase.co';

function fail(message) {
  console.error(`::error title=APK publish failed::${message}`);
  process.exit(1);
}

function clean(raw) {
  return String(raw ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

const version = (process.env.BUNDLE_VERSION || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`BUNDLE_VERSION must look like 1.0.57, got "${version}".`);

const versionCode = Number.parseInt(process.env.VERSION_CODE ?? '', 10);
if (!Number.isInteger(versionCode) || versionCode < 1) {
  fail(`VERSION_CODE must be a positive integer, got "${process.env.VERSION_CODE}".`);
}

const apkPath = process.env.APK_PATH || 'android/app/build/outputs/apk/release/app-release.apk';
let apk;
try {
  apk = await readFile(apkPath);
} catch (err) {
  fail(`Cannot read APK at ${apkPath}: ${err.message}`);
}
if (apk.length < 1024 * 1024) fail(`APK at ${apkPath} is only ${apk.length} bytes; refusing to publish.`);
// An APK is a zip: it must start with the "PK" local file header.
if (apk[0] !== 0x50 || apk[1] !== 0x4b) fail(`File at ${apkPath} is not a zip/APK (bad magic bytes).`);

const sha256 = createHash('sha256').update(apk).digest('hex');
const objectPath = `apks/xpresso-${versionCode}.apk`;

if (DRY_RUN) {
  console.log(JSON.stringify({
    dryRun: true, version, native_version: versionCode, objectPath, apk_size: apk.length, apk_sha256: sha256,
  }, null, 2));
  process.exit(0);
}

let url = clean(process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL);
if (!url || url.startsWith('sb_') || url.startsWith('eyJ') || url.includes('YOUR_PROJECT_ID')) {
  url = KNOWN_PROJECT_URL;
} else if (!/^https?:\/\//i.test(url)) {
  url = url.includes('.') ? `https://${url}` : `https://${url}.supabase.co`;
}
url = url.replace(/\/+$/, '');

const key = clean(
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || '')
    .replace(/^([A-Z0-9_]+)=/i, '')
    .replace(/^Bearer\s+/i, ''),
);
if (!key) fail('Supabase service-role key is missing. Configure the SUPABASE_SERVICE_ROLE_KEY secret.');
if (key.startsWith('sb_publishable_')) fail('The configured Supabase key is publishable, not a service-role key.');

// Loaded here, not at the top, so --dry-run works without installed dependencies.
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function withRetry(fn, retries = 3, delayMs = 2000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        console.warn(`[ApkPublish] Attempt ${i + 1} failed (${err?.message || err}). Retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

try {
  console.log(`[ApkPublish] ${version}: uploading ${(apk.length / 1048576).toFixed(1)} MB to ${BUCKET}/${objectPath}`);

  await withRetry(async () => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, apk, { contentType: 'application/vnd.android.package-archive', upsert: true });
    if (error) throw error;
  });

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const rows = await withRetry(async () => {
    const { data, error } = await supabase
      .from('app_versions')
      .update({
        native_version: versionCode,
        apk_url: urlData.publicUrl,
        apk_sha256: sha256,
        apk_size: apk.length,
      })
      .eq('version', version)
      .select('version');
    if (error) throw error;
    return data;
  });

  if (!rows || rows.length === 0) {
    fail(`No app_versions row for ${version}. The web bundle must be published first (scripts/publish-live-update.mjs).`);
  }

  console.log(`[ApkPublish] Published ${version} (versionCode ${versionCode}) -> ${urlData.publicUrl}`);
} catch (err) {
  const hint = /size|too large|413|exceeded/i.test(err?.message || '')
    ? ' The Supabase plan may cap upload size (free plan: 50 MB per file).'
    : '';
  fail(`Could not publish the APK: ${err?.message || err}.${hint}`);
}

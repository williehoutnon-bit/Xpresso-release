import { readFile } from 'node:fs/promises';
import dns from 'node:dns';
import { createClient } from '@supabase/supabase-js';

// Prefer IPv4 in GitHub Actions / CI environments to avoid IPv6 connectivity hangs
try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // Ignore on runtimes where not supported
}

const KNOWN_PROJECT_URL = 'https://oujijpepbkqpgzgegoqf.supabase.co';
const BUCKET = 'app-updates';

function fail(message) {
  console.error(`::error title=Live update publish failed::${message}`);
  process.exit(1);
}

function describeError(err) {
  const cause = err?.cause;
  const parts = [err?.message || String(err)];
  if (cause) {
    parts.push(`cause: ${cause.code ? `${cause.code} ` : ''}${cause.message || cause}`);
  }
  return parts.join(' | ');
}

function isMissingBucketError(err) {
  const status = String(err?.statusCode ?? err?.status ?? '');
  const message = String(err?.message || err?.error || '');
  return status === '404' || /bucket not found/i.test(message);
}

function resolveSupabaseUrl(candidates) {
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = String(raw).trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    if (!cleaned || cleaned === 'undefined' || cleaned === 'null') continue;
    // Reject secrets mistakenly put into the URL variable (e.g. sb_secret_..., sb_publishable_..., eyJ...)
    if (cleaned.startsWith('sb_') || cleaned.startsWith('eyJ') || cleaned.includes('YOUR_PROJECT_ID')) {
      console.warn(`[LiveUpdate] Ignoring invalid SUPABASE_URL candidate (looks like key or placeholder): "${cleaned.substring(0, 14)}..."`);
      continue;
    }
    let url = cleaned;
    if (!/^https?:\/\//i.test(url)) {
      url = url.includes('.') ? `https://${url}` : `https://${url}.supabase.co`;
    }
    try {
      new URL(url);
      return url;
    } catch {
      // Not a valid URL, try next candidate
    }
  }
  return KNOWN_PROJECT_URL;
}

function resolveSupabaseKey(candidates) {
  for (const raw of candidates) {
    if (!raw) continue;
    let key = String(raw).trim().replace(/^["']|["']$/g, '');
    key = key.replace(/^([A-Z0-9_]+)=/i, ''); // e.g. SUPABASE_SERVICE_ROLE_KEY=...
    key = key.replace(/^Bearer\s+/i, '');
    key = key.replace(/\s+/g, '');
    if (!key || key === 'undefined' || key === 'null') continue;
    return key;
  }
  return '';
}

const rawUrl = resolveSupabaseUrl([
  process.env.SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_URL,
]);

const rawKey = resolveSupabaseKey([
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.VITE_SUPABASE_SERVICE_KEY,
  process.env.SUPABASE_SERVICE_KEY,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
]);

if (!rawKey) {
  fail('Supabase service-role key is missing or empty. Configure the SUPABASE_SERVICE_ROLE_KEY GitHub Actions secret.');
}

if (rawKey.startsWith('sb_publishable_')) {
  fail('The configured Supabase key is publishable, not a server-side service key. Configure SUPABASE_SERVICE_ROLE_KEY with a service-role/secret key.');
}

const version = process.env.BUNDLE_VERSION || `1.0.${Date.now()}`;
const bundlePath = process.env.BUNDLE_PATH || 'bundle.zip';
const objectPath = `bundles/${version}.zip`;

// Lowest installed APK (versionCode) that can run this bundle. Devices below it do not download the
// bundle; they are offered the new APK instead. Read from android/min-native-version.txt by CI.
const minNativeVersion = Number.parseInt(process.env.MIN_NATIVE_VERSION ?? '1', 10);
if (!Number.isInteger(minNativeVersion) || minNativeVersion < 1) {
  fail(`MIN_NATIVE_VERSION must be a positive integer, got "${process.env.MIN_NATIVE_VERSION}".`);
}

console.log(`[LiveUpdate] Target URL: ${rawUrl}`);
console.log(`[LiveUpdate] Publishing bundle version ${version}...`);

const supabase = createClient(rawUrl, rawKey, { auth: { persistSession: false } });

async function withRetry(fn, retries = 3, delayMs = 1500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        console.warn(`[LiveUpdate] Attempt ${i + 1} failed (${describeError(err)}). Retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

try {
  const file = await readFile(bundlePath);
  if (file.length === 0) throw new Error('Bundle ZIP is empty; refusing to publish.');

  // 1. Retry bucket lookup errors; create only when Supabase confirms the bucket is missing.
  const bucketResult = await withRetry(async () => {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error && !isMissingBucketError(error)) throw error;
    return { data, missing: Boolean(error) };
  }, 3, 1500);

  if (bucketResult.missing || !bucketResult.data) {
    await withRetry(async () => {
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (error && !/already exists/i.test(error.message || '')) throw error;
      return true;
    }, 3, 1500);
  }

  // 2. Upload zip bundle with retry
  const uploadResult = await withRetry(async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, file, { contentType: 'application/zip', upsert: true });
    if (error) throw error;
    return data;
  }, 3, 2000);

  console.log(`[LiveUpdate] Uploaded ${bundlePath} to ${BUCKET}/${objectPath}`);

  // 3. Obtain public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const bundleUrl = urlData.publicUrl;

  // 4. Record new version in app_versions table with retry
  await withRetry(async () => {
    const { error: insertError } = await supabase
      .from('app_versions')
      .upsert({ version, bundle_url: bundleUrl, min_native_version: minNativeVersion }, { onConflict: 'version' });
    if (insertError) throw insertError;
  }, 3, 2000);

  console.log(`Successfully published live update ${version} -> ${bundleUrl}`);
} catch (err) {
  fail(`Unexpected error publishing live update to ${rawUrl}: ${describeError(err)}`);
}

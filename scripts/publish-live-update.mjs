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
  console.warn('::warning::Supabase service role key is missing or empty. Skipping live update publish.');
  process.exit(0);
}

if (rawKey.startsWith('sb_publishable_')) {
  console.warn('::warning::The service key provided starts with "sb_publishable_". If storage upload fails, make sure you configure the secret with the service_role key instead of the anon/publishable key.');
}

const version = process.env.BUNDLE_VERSION || `1.0.${Date.now()}`;
const bundlePath = process.env.BUNDLE_PATH || 'bundle.zip';
const objectPath = `bundles/${version}.zip`;

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

  // 1. Ensure bucket exists or create it
  try {
    const { data: bucket, error: bucketLookupError } = await withRetry(() => supabase.storage.getBucket(BUCKET), 2, 1000);
    if (bucketLookupError || !bucket) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (createError && !/already exists/i.test(createError.message)) {
        console.warn(`[LiveUpdate] Bucket create warning: ${createError.message}. Continuing with upload attempt...`);
      }
    }
  } catch (bucketErr) {
    console.warn(`[LiveUpdate] Bucket verification notice: ${describeError(bucketErr)}. Continuing with upload...`);
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
      .upsert({ version, bundle_url: bundleUrl }, { onConflict: 'version' });
    if (insertError) throw insertError;
  }, 3, 2000);

  console.log(`Successfully published live update ${version} -> ${bundleUrl}`);
} catch (err) {
  fail(`Unexpected error publishing live update to ${rawUrl}: ${describeError(err)}`);
}

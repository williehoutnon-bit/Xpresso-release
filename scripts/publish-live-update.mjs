import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_SERVICE_KEY,
  BUNDLE_VERSION,
  BUNDLE_PATH = 'bundle.zip',
} = process.env;

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

// Secrets pasted into GitHub often carry quotes or whitespace/newlines that make fetch throw "fetch failed".
const rawKey = (SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_SERVICE_KEY || '')
  .replace(/^["']|["']$/g, '')
  .replace(/\s+/g, '');
if (!rawKey || rawKey === 'undefined' || rawKey === 'null') {
  console.warn('::warning::Supabase service role key is missing or empty. Skipping live update publish.');
  process.exit(0);
}
if (!/^[A-Za-z0-9._-]+$/.test(rawKey)) {
  fail('The service role key contains characters that are not valid in a key. Re-create the GitHub secret with only the raw key value.');
}

let rawUrl = (SUPABASE_URL || PUBLIC_SUPABASE_URL || VITE_SUPABASE_URL || '').replace(/\s+/g, '').replace(/^["']|["']$/g, '');
if (!rawUrl || rawUrl === 'undefined' || rawUrl === 'null') {
  rawUrl = 'https://oujijpepbkqpgzgegoqf.supabase.co';
} else if (!/^https?:\/\//i.test(rawUrl)) {
  rawUrl = rawUrl.includes('.') ? `https://${rawUrl}` : `https://${rawUrl}.supabase.co`;
}
rawUrl = rawUrl.replace(/\/+$/, '');

try {
  new URL(rawUrl);
} catch {
  fail(`Supabase URL "${rawUrl}" is not a valid URL.`);
}

const version = BUNDLE_VERSION || `1.0.${Date.now()}`;
const objectPath = `bundles/${version}.zip`;

const supabase = createClient(rawUrl, rawKey, { auth: { persistSession: false } });

try {
  const file = await readFile(BUNDLE_PATH);

  // Create the bucket when missing so the first publish does not depend on manual setup.
  const { error: bucketLookupError } = await supabase.storage.getBucket(BUCKET);
  if (bucketLookupError) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createError && !/already exists/i.test(createError.message)) {
      fail(`Could not find or create the "${BUCKET}" bucket: ${createError.message}`);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file, { contentType: 'application/zip', upsert: true });
  if (uploadError) {
    fail(`Bundle upload to "${BUCKET}" failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const { error: insertError } = await supabase
    .from('app_versions')
    .upsert({ version, bundle_url: urlData.publicUrl }, { onConflict: 'version' });
  if (insertError) {
    fail(
      `Could not write to app_versions: ${insertError.message}. ` +
        'Run supabase/migrations/20261021_live_updates.sql in the Supabase SQL editor.',
    );
  }

  console.log(`Successfully published live update ${version} -> ${urlData.publicUrl}`);
} catch (err) {
  fail(`Unexpected error contacting ${rawUrl}: ${describeError(err)}`);
}

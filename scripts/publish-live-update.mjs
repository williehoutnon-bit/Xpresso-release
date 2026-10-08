import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const { 
  SUPABASE_URL, 
  PUBLIC_SUPABASE_URL, 
  VITE_SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY, 
  VITE_SUPABASE_SERVICE_KEY, 
  BUNDLE_VERSION, 
  BUNDLE_PATH = 'bundle.zip' 
} = process.env;

const rawKey = (SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_SERVICE_KEY || '').trim();
if (!rawKey || rawKey === 'undefined' || rawKey === 'null') {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is missing or empty. Skipping live update publish.');
  process.exit(0);
}

// Robust URL normalization: handles missing scheme, domain-only, project-id only, or empty values
let rawUrl = (SUPABASE_URL || PUBLIC_SUPABASE_URL || VITE_SUPABASE_URL || '').trim();
if (!rawUrl || rawUrl === 'undefined' || rawUrl === 'null') {
  rawUrl = 'https://oujijpepbkqpgzgegoqf.supabase.co';
} else if (!/^https?:\/\//i.test(rawUrl)) {
  if (rawUrl.includes('.')) {
    rawUrl = `https://${rawUrl}`;
  } else {
    rawUrl = `https://${rawUrl}.supabase.co`;
  }
}
rawUrl = rawUrl.replace(/\/+$/, '');

const version = BUNDLE_VERSION || `1.0.${Date.now()}`;
const BUCKET = 'app-updates';
const objectPath = `bundles/${version}.zip`;

try {
  const supabase = createClient(rawUrl, rawKey, {
    auth: { persistSession: false },
  });

  const file = await readFile(BUNDLE_PATH);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file, { contentType: 'application/zip', upsert: true });

  if (uploadError) {
    console.warn(`Bundle upload warning: ${uploadError.message}. Continuing build without live update.`);
    process.exit(0);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const { error: insertError } = await supabase
    .from('app_versions')
    .upsert({ version, bundle_url: urlData.publicUrl }, { onConflict: 'version' });

  if (insertError) {
    console.warn(`Version row insert warning: ${insertError.message}. Continuing build.`);
    process.exit(0);
  }

  console.log(`Successfully published live update ${version} -> ${urlData.publicUrl}`);
} catch (err) {
  console.warn('Live update publish warning:', err?.message || err);
  process.exit(0);
}


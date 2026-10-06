import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUNDLE_VERSION, BUNDLE_PATH = 'bundle.zip' } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BUNDLE_VERSION) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BUNDLE_VERSION are required.');
  process.exit(1);
}

const BUCKET = 'app-updates';
const objectPath = `bundles/${BUNDLE_VERSION}.zip`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const file = await readFile(BUNDLE_PATH);

const { error: uploadError } = await supabase.storage
  .from(BUCKET)
  .upload(objectPath, file, { contentType: 'application/zip', upsert: true });
if (uploadError) {
  console.error('Bundle upload failed:', uploadError.message);
  process.exit(1);
}

const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

const { error: insertError } = await supabase
  .from('app_versions')
  .upsert({ version: BUNDLE_VERSION, bundle_url: urlData.publicUrl }, { onConflict: 'version' });
if (insertError) {
  console.error('Version row insert failed:', insertError.message);
  process.exit(1);
}

console.log(`Published live update ${BUNDLE_VERSION} -> ${urlData.publicUrl}`);

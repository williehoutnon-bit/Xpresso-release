import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMBEDDED_VERSION: string = import.meta.env.VITE_BUNDLE_VERSION || 'builtin';

interface AppVersionRow {
  version: string;
  bundle_url: string;
}

const MIN_CHECK_INTERVAL_MS = 60_000;

let checking = false;
let lastCheckAt = 0;
let queuedVersion: string | null = null;

async function fetchLatestVersion(): Promise<AppVersionRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_versions?select=version,bundle_url&order=created_at.desc&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  );
  if (!res.ok) throw new Error(`app_versions query failed: ${res.status}`);
  const rows: AppVersionRow[] = await res.json();
  return rows[0] ?? null;
}

async function checkForUpdate() {
  if (checking || !SUPABASE_URL || !SUPABASE_KEY) return;
  if (Date.now() - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
  checking = true;
  lastCheckAt = Date.now();
  try {
    const latest = await fetchLatestVersion();
    if (!latest || latest.version === queuedVersion) return;

    const { bundle: current } = await CapacitorUpdater.current();
    const currentVersion = current.id === 'builtin' ? EMBEDDED_VERSION : current.version;
    if (latest.version === currentVersion) return;

    const { bundles } = await CapacitorUpdater.list();
    const existing = bundles.find((b) => b.version === latest.version && b.status !== 'error');
    const bundle = existing ?? (await CapacitorUpdater.download({ url: latest.bundle_url, version: latest.version }));

    // Applied the next time the app is backgrounded, so the user is never interrupted mid-task.
    await CapacitorUpdater.next({ id: bundle.id });
    queuedVersion = latest.version;
    console.info(`[LiveUpdate] Bundle ${latest.version} queued for next launch.`);
  } catch (err) {
    console.warn('[LiveUpdate] Update check failed:', err);
  } finally {
    checking = false;
  }
}

export async function initLiveUpdates() {
  // Must run on every launch, otherwise Capgo rolls back to the previous bundle.
  await CapacitorUpdater.notifyAppReady().catch(() => {});

  checkForUpdate();

  // Long-lived sessions would otherwise never see a new version until a cold start.
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) checkForUpdate();
  });
}

/**
 * Pure decision logic for live updates (no Capacitor / DOM imports, so it can be tested with tsx).
 *
 * Two kinds of update exist:
 *   - web bundle: HTML/JS/CSS, applied silently through Capgo.
 *   - native APK: needed only when a bundle depends on newer native (Java) code than the installed APK.
 *
 * The app_versions row names the lowest APK versionCode able to run its bundle (min_native_version).
 * An installed APK below that must NOT download the bundle (new JS would call native methods that do
 * not exist); it is offered the APK published in the same row instead.
 */

export interface AppVersionRow {
  version: string;
  bundle_url: string;
  min_native_version?: number | null;
  native_version?: number | null;
  apk_url?: string | null;
  apk_sha256?: string | null;
  apk_size?: number | null;
}

export interface NativeUpdateOffer {
  /** Release label, e.g. "1.0.57". */
  version: string;
  /** versionCode of the APK being offered. */
  nativeVersion: number;
  apkUrl: string;
  sha256: string;
  size: number | null;
}

export interface UpdateDecision {
  /** Whether the web bundle of this row may be downloaded on this install. */
  allowWebBundle: boolean;
  /** Set only when the install is too old for the bundle AND a verifiable APK is published. */
  nativeUpdate: NativeUpdateOffer | null;
  /** True when the install is too old for the bundle (even if no APK is published yet). */
  nativeUpdateRequired: boolean;
}

const SHA256_HEX = /^[0-9a-f]{64}$/i;

export function isTrustedApkUrl(raw: string, supabaseUrl: string): boolean {
  try {
    const url = new URL(raw);
    const base = new URL(supabaseUrl);
    return (
      url.protocol === 'https:' &&
      url.host === base.host &&
      url.pathname.startsWith('/storage/v1/object/public/app-updates/apks/') &&
      url.pathname.endsWith('.apk') &&
      !url.pathname.includes('..')
    );
  } catch {
    return false;
  }
}

/** The versionCode the installed APK reports (Capacitor App.getInfo().build), or null if unreadable. */
export function parseInstalledBuild(build: unknown): number | null {
  const n = typeof build === 'number' ? build : Number.parseInt(String(build ?? ''), 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function decideUpdate(
  row: AppVersionRow,
  installedBuild: number | null,
  supabaseUrl: string,
): UpdateDecision {
  const min =
    Number.isInteger(row.min_native_version) && (row.min_native_version as number) >= 1
      ? (row.min_native_version as number)
      : 1;

  // Unknown installed build: behave like before native gating existed.
  if (installedBuild === null || installedBuild >= min) {
    return { allowWebBundle: true, nativeUpdate: null, nativeUpdateRequired: false };
  }

  const nativeVersion = row.native_version;
  const offerable =
    typeof row.apk_url === 'string' &&
    isTrustedApkUrl(row.apk_url, supabaseUrl) &&
    typeof row.apk_sha256 === 'string' &&
    SHA256_HEX.test(row.apk_sha256) &&
    Number.isInteger(nativeVersion) &&
    (nativeVersion as number) >= min &&
    (nativeVersion as number) > installedBuild;

  return {
    allowWebBundle: false,
    nativeUpdateRequired: true,
    nativeUpdate: offerable
      ? {
          version: row.version,
          nativeVersion: nativeVersion as number,
          apkUrl: row.apk_url as string,
          sha256: (row.apk_sha256 as string).toLowerCase(),
          size: Number.isFinite(row.apk_size) ? (row.apk_size as number) : null,
        }
      : null,
  };
}

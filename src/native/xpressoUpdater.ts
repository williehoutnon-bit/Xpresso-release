import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Bridge to XpressoUpdaterPlugin.java: downloads and installs a new APK for beta builds
 * distributed outside Google Play. Only present in APKs built after the updater was added;
 * check Capacitor.isPluginAvailable('XpressoUpdater') before calling.
 */
export type InstallStatus =
  | 'success'
  | 'pending-user-action'
  | 'aborted'
  | 'conflict'
  | 'incompatible'
  | 'invalid'
  | 'storage'
  | 'blocked'
  | 'failure';

export interface XpressoUpdaterPlugin {
  /** Whether Android currently lets Xpresso install apps ("Install unknown apps"). */
  canInstall(): Promise<{ value: boolean }>;
  /** Opens the system screen where the user grants that permission. */
  openInstallSettings(): Promise<void>;
  /** Downloads the APK to the app cache and verifies its SHA-256. */
  download(options: { url: string; sha256?: string }): Promise<{ bytes: number; sha256: string }>;
  /** Hands the downloaded APK to Android's installer. The result arrives as an installStatus event. */
  install(): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listener: (event: { percent: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'installStatus',
    listener: (event: { status: InstallStatus; message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const XpressoUpdater = registerPlugin<XpressoUpdaterPlugin>('XpressoUpdater');

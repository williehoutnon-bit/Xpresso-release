import { writable, get } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { XpressoUpdater } from '../native/xpressoUpdater';
import type { NativeUpdateOffer } from '../native/updatePolicy';

/**
 * State machine behind the "Update available" banner (components/UpdatePrompt.svelte).
 *
 * idle -> available -> (needs-permission ->) downloading -> installing -> [app restarts]
 *                          ^                                    |
 *                          +---- aborted by user / error <------+
 * 'manual' is used when the installed APK predates the updater plugin and cannot update itself.
 */
export type NativeUpdatePhase =
  | 'idle'
  | 'available'
  | 'needs-permission'
  | 'downloading'
  | 'installing'
  | 'error'
  | 'manual';

export interface NativeUpdateState {
  phase: NativeUpdatePhase;
  offer: NativeUpdateOffer | null;
  /** 0-100 while downloading. */
  progress: number;
  message: string;
  /** "Later" was tapped for this offer; stays hidden until the next launch. */
  dismissed: boolean;
}

const initial: NativeUpdateState = { phase: 'idle', offer: null, progress: 0, message: '', dismissed: false };

export const nativeUpdateState = writable<NativeUpdateState>({ ...initial });

let listenersReady = false;

function patch(p: Partial<NativeUpdateState>) {
  nativeUpdateState.update((s) => ({ ...s, ...p }));
}

function setupListeners() {
  if (listenersReady) return;
  listenersReady = true;

  // After the user grants "install unknown apps" in system settings, continue automatically.
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && get(nativeUpdateState).phase === 'needs-permission') {
      void startNativeUpdate();
    }
  });

  if (!Capacitor.isPluginAvailable('XpressoUpdater')) return;

  XpressoUpdater.addListener('downloadProgress', ({ percent }) => patch({ progress: percent }));

  XpressoUpdater.addListener('installStatus', ({ status, message }) => {
    switch (status) {
      case 'success':
        break; // Android restarts the app with the new version.
      case 'pending-user-action':
        patch({ phase: 'installing', message: 'Confirm the install on the screen that just opened.' });
        break;
      case 'aborted':
        patch({ phase: 'available', message: 'Install cancelled. You can update whenever you are ready.' });
        break;
      case 'conflict':
      case 'incompatible':
        patch({
          phase: 'error',
          message: 'This build cannot replace the installed app (different signing key). Install the latest APK manually once.',
        });
        break;
      default:
        patch({ phase: 'error', message: message || 'The update could not be installed.' });
    }
  });
}

/** Called by live-update.ts when the installed APK is too old for the newest web bundle. */
export function offerNativeUpdate(offer: NativeUpdateOffer) {
  const current = get(nativeUpdateState);
  if (['downloading', 'installing'].includes(current.phase)) return;

  setupListeners();

  const sameOffer = current.offer?.nativeVersion === offer.nativeVersion;
  if (!Capacitor.isPluginAvailable('XpressoUpdater')) {
    nativeUpdateState.set({
      phase: 'manual',
      offer,
      progress: 0,
      message: 'A new version needs a fresh install of the app. Ask for the latest APK link and install it once; updates will be automatic after that.',
      dismissed: sameOffer ? current.dismissed : false,
    });
    return;
  }

  nativeUpdateState.set({
    phase: current.phase === 'needs-permission' && sameOffer ? 'needs-permission' : 'available',
    offer,
    progress: 0,
    message: '',
    dismissed: sameOffer ? current.dismissed : false,
  });
}

export function dismissNativeUpdate() {
  patch({ dismissed: true });
}

export async function startNativeUpdate() {
  const { offer, phase } = get(nativeUpdateState);
  if (!offer || phase === 'downloading' || phase === 'installing') return;
  if (!Capacitor.isPluginAvailable('XpressoUpdater')) return;

  try {
    const { value: allowed } = await XpressoUpdater.canInstall();
    if (!allowed) {
      patch({
        phase: 'needs-permission',
        message: 'Turn on "Allow from this source" for Xpresso in the settings screen, then come back.',
      });
      await XpressoUpdater.openInstallSettings();
      return;
    }

    patch({ phase: 'downloading', progress: 0, message: '' });
    await XpressoUpdater.download({ url: offer.apkUrl, sha256: offer.sha256 });

    patch({ phase: 'installing', progress: 100, message: 'Starting the install…' });
    await XpressoUpdater.install();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    patch({ phase: 'error', message: message || 'The update failed.' });
  }
}

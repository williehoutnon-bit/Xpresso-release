import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();

export const NATIVE_BACK_EVENT = 'xpresso:native-back';

export function hideSplashScreen(fadeOutDuration = 300) {
  if (isNative) {
    SplashScreen.hide({ fadeOutDuration }).catch(() => {});
  }
}

export function hideSystemKeyboard() {
  if (isNative) Keyboard.hide().catch(() => {});
}

export function keyHaptic() {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      // Ignore vibration errors if not permitted
    }
  }
}

export async function initNative() {
  if (!isNative) return;

  document.documentElement.classList.add('native-app');

  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#FF5B14' }).catch(() => {});

  // Components that own an overlay (e.g. the math keyboard) cancel this event to consume the back press.
  App.addListener('backButton', ({ canGoBack }) => {
    const event = new CustomEvent(NATIVE_BACK_EVENT, { cancelable: true });
    const notHandled = window.dispatchEvent(event);
    if (!notHandled) return;
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });
}

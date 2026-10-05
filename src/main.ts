import './websocket-patch';
import { mount } from 'svelte';
import App from './App.svelte';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { isNative, initNative, hideSplashScreen } from './native';

// The native app ships its assets in the APK, so a service worker would only serve stale files after updates.
if (isNative) {
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  initNative();
} else {
  // Register service worker without forcing page reload
  registerSW({
    onNeedRefresh() {
      console.info('[PWA] New version ready for next launch.');
    },
    onOfflineReady() {
      console.info('[PWA] App ready for offline use.');
    }
  });
}

const app = mount(App, {
  target: document.getElementById('root')!
});

if (isNative) {
  hideSplashScreen();
}

export default app;

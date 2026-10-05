import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xpresso.app',
  appName: 'Xpresso',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#FF5B14',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeInDuration: 200,
      backgroundColor: '#FF5B14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;

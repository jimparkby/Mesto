import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'by.mesto.app',
  appName: 'Mesto',
  webDir: 'dist',
  android: {
    backgroundColor: '#0d0e10',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0d0e10',
      showSpinner: false,
    },
  },
};

export default config;

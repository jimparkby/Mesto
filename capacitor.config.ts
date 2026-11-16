import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'by.mesto.app',
  appName: 'Mesto',
  webDir: 'dist',
  android: {
    backgroundColor: '#6c151e',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#6c151e',
      showSpinner: false,
    },
  },
};

export default config;

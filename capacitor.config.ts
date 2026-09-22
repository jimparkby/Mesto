import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'by.sportryadom.app',
  appName: 'СпортРядом',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f1115',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#16a34a',
      showSpinner: false,
    },
  },
};

export default config;

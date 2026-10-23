import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.prayaspoint.app',
  appName: 'PRAYAS POINT',
  webDir: 'public',
  server: {
    url: 'https://prayas-point.vercel.app',
    cleartext: true
  }
};
export default config;
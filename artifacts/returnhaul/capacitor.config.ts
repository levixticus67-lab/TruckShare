import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.levixticus67.truckshare",
  appName: "TruckShare",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;

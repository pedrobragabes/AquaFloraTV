const apiUrl = process.env.API_URL ?? '';

module.exports = {
  expo: {
    name: 'AquaTV',
    slug: 'aquatv-player',
    version: '1.0.0',
    platforms: ['android'],
    orientation: 'default',
    userInterfaceStyle: 'dark',
    icon: './assets/brand/aquaflora-symbol.png',
    splash: {
      image: './assets/brand/aquaflora-agroshop.png',
      resizeMode: 'contain',
      backgroundColor: '#050309',
    },
    plugins: [
      // Manifest mods run in reverse order; kiosk preserves the configured orientation after config-tv runs.
      './plugins/with-android-tv-kiosk.cjs',
      [
        '@react-native-tvos/config-tv',
        {
          isTV: true,
          androidTVRequired: true,
        },
      ],
      'expo-secure-store',
    ],
    android: {
      package: 'com.aquatv.player',
      versionCode: 2,
      adaptiveIcon: {
        foregroundImage: './assets/brand/aquaflora-symbol.png',
        backgroundColor: '#050309',
      },
      allowBackup: false,
      usesCleartextTraffic: true,
      permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.REQUEST_INSTALL_PACKAGES',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
      ],
    },
    extra: {
      apiUrl,
    },
  },
};

const apiUrl = process.env.API_URL ?? '';

module.exports = {
  expo: {
    name: 'AquaTV Player',
    slug: 'aquatv-player',
    version: '0.1.0',
    platforms: ['android'],
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    plugins: [
      // Manifest mods run in reverse order; kiosk must restore portrait after config-tv removes it.
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
      versionCode: 1,
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

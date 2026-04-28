const apiUrl = process.env.API_URL ?? 'http://IP-DO-PC:7741/api';

module.exports = {
  expo: {
    name: 'AquaTV Player',
    slug: 'aquatv-player',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    android: {
      package: 'com.aquatv.player',
      versionCode: 1,
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.REQUEST_INSTALL_PACKAGES',
      ],
    },
    extra: {
      apiUrl,
    },
  },
};

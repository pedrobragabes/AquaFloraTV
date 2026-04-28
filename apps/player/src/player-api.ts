import { ApiClient } from '@aquatv/api-client';

import type { DeviceCredentials, PlayerRuntimeConfig } from './types.js';

export function createDeviceApi(apiUrl: string, credentials?: DeviceCredentials): ApiClient {
  return new ApiClient({
    baseUrl: apiUrl,
    ...(credentials ? { token: credentials.token } : {}),
  });
}

export async function registerPlayerDevice(
  config: PlayerRuntimeConfig,
): Promise<DeviceCredentials> {
  const api = createDeviceApi(config.apiUrl);
  const registered = await api.registerDevice({
    name: config.deviceName,
    deviceModel: config.deviceModel,
    ...(config.androidVersion ? { androidVersion: config.androidVersion } : {}),
  });

  return {
    id: registered.id,
    token: registered.token,
  };
}

export async function reportPlayerBoot(
  apiUrl: string,
  credentials: DeviceCredentials,
  appVersion: string,
): Promise<void> {
  const api = createDeviceApi(apiUrl, credentials);
  await api.sendDeviceLog(credentials.id, {
    level: 'INFO',
    event: 'boot',
    message: `Player iniciado (${appVersion})`,
  });
}

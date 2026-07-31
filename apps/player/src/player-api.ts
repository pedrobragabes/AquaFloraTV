import type {
  CurrentPlaylistResponse,
  DeviceHeartbeatRequest,
  HealthResponse,
  RegisterDeviceResponse,
} from '@aquatv/types';

import type { DeviceCredentials, PlayerRuntimeConfig } from './types.js';

const requestTimeoutMs = 15_000;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function getServerUrl(apiUrl: string): string {
  const normalized = trimTrailingSlash(apiUrl);
  return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized;
}

function createHeaders(credentials?: DeviceCredentials, json = false): Headers {
  const headers = new Headers();
  if (json) {
    headers.set('Content-Type', 'application/json');
  }
  if (credentials) {
    headers.set('Authorization', `Bearer ${credentials.token}`);
  }
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('A API demorou demais para responder');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) {
    throw new Error(`API respondeu ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function checkPlayerHealth(apiUrl: string): Promise<HealthResponse> {
  return requestJson<HealthResponse>(`${getServerUrl(apiUrl)}/health`);
}

export async function registerPlayerDevice(
  config: PlayerRuntimeConfig,
): Promise<DeviceCredentials> {
  const registered = await requestJson<RegisterDeviceResponse>(
    `${trimTrailingSlash(config.apiUrl)}/devices`,
    {
      method: 'POST',
      headers: createHeaders(undefined, true),
      body: JSON.stringify({
        name: config.deviceName,
        deviceModel: config.deviceModel,
        ...(config.androidVersion ? { androidVersion: config.androidVersion } : {}),
      }),
    },
  );

  return {
    id: registered.id,
    token: registered.token,
  };
}

export async function getPlayerPlaylist(
  apiUrl: string,
  credentials: DeviceCredentials,
): Promise<CurrentPlaylistResponse | null> {
  const response = await fetchWithTimeout(
    `${trimTrailingSlash(apiUrl)}/devices/${credentials.id}/current-playlist`,
    { headers: createHeaders(credentials) },
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`API respondeu ${response.status}`);
  }

  return (await response.json()) as CurrentPlaylistResponse;
}

export async function sendPlayerHeartbeat(
  apiUrl: string,
  credentials: DeviceCredentials,
  payload: DeviceHeartbeatRequest,
): Promise<void> {
  const response = await fetchWithTimeout(
    `${trimTrailingSlash(apiUrl)}/devices/${credentials.id}/heartbeat`,
    {
      method: 'POST',
      headers: createHeaders(credentials, true),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Heartbeat respondeu ${response.status}`);
  }
}

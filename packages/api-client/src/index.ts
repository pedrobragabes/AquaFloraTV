import type {
  AppRelease,
  CurrentPlaylistResponse,
  DeviceHeartbeatRequest,
  DeviceLogRequest,
  HealthResponse,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
} from '@aquatv/types';

export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
}

export class ApiClient {
  private readonly apiUrl: string;
  private readonly serverUrl: string;
  private readonly token: string | undefined;

  constructor(options: ApiClientOptions) {
    this.apiUrl = options.baseUrl.replace(/\/$/, '');
    this.serverUrl = this.apiUrl.endsWith('/api') ? this.apiUrl.slice(0, -4) : this.apiUrl;
    this.token = options.token;
  }

  private createHeaders(extraHeaders?: HeadersInit): Headers {
    const headers = new Headers(extraHeaders);

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: this.createHeaders(init.headers),
    });

    if (!response.ok) {
      throw new Error(`API request failed ${path}: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async requestNoContent(path: string, init: RequestInit = {}): Promise<void> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: this.createHeaders(init.headers),
    });

    if (!response.ok) {
      throw new Error(`API request failed ${path}: ${response.status}`);
    }
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.serverUrl}/health`, {
      headers: this.createHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Health request failed: ${response.status}`);
    }

    const data = (await response.json()) as HealthResponse;
    return data;
  }

  registerDevice(payload: RegisterDeviceRequest): Promise<RegisterDeviceResponse> {
    return this.requestJson<RegisterDeviceResponse>('/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  getCurrentPlaylist(deviceId: string): Promise<CurrentPlaylistResponse> {
    return this.requestJson<CurrentPlaylistResponse>(`/devices/${deviceId}/current-playlist`);
  }

  sendHeartbeat(deviceId: string, payload: DeviceHeartbeatRequest): Promise<void> {
    return this.requestNoContent(`/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  sendDeviceLog(deviceId: string, payload: DeviceLogRequest): Promise<void> {
    return this.requestJson<unknown>(`/devices/${deviceId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(() => undefined);
  }

  getLatestRelease(channel: 'STABLE' | 'BETA' = 'STABLE'): Promise<AppRelease> {
    return this.requestJson<AppRelease>(`/app/latest?channel=${channel}`);
  }
}

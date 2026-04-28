export type MediaKind = 'video' | 'image';

export interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  freeDiskMb?: number;
  appVersion?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
}

export interface RegisterDeviceRequest {
  name: string;
  deviceModel?: string;
  androidVersion?: string;
}

export interface RegisterDeviceResponse {
  id: string;
  name: string;
  token: string;
}

export interface DeviceHeartbeatRequest {
  uptimeSeconds?: number;
  freeDiskMb?: number;
  totalDiskMb?: number;
  appVersion?: string;
  currentMediaId?: string;
  networkType?: string;
  ipAddress?: string;
}

export interface DeviceLogRequest {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  event: string;
  message?: string;
  payload?: unknown;
}

export interface PlaybackMedia {
  id: string;
  storedName: string;
  url: string;
  md5: string;
  sizeBytes: number;
  mimetype: string;
}

export interface CurrentPlaylistItem {
  id: string;
  order: number;
  durationOverrideMs: number | null;
  media: PlaybackMedia;
}

export interface CurrentPlaylistResponse {
  playlist: {
    id: string;
    name: string;
    hash: string;
  };
  items: CurrentPlaylistItem[];
}

export interface AppRelease {
  id: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  apkSizeBytes: number;
  apkMd5: string;
  releaseNotes: string | null;
  channel: 'STABLE' | 'BETA';
  mandatory: boolean;
  active: boolean;
  createdAt: string;
}

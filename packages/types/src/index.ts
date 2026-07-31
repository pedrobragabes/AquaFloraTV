export interface HealthResponse {
  status: 'ok';
  service: string;
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
  currentMediaId?: string | null;
  networkType?: string;
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

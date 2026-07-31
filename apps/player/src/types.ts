import type { CurrentPlaylistItem, CurrentPlaylistResponse } from '@aquatv/types';

export interface DeviceCredentials {
  id: string;
  token: string;
}

export interface CachedMedia {
  mediaId: string;
  storedName: string;
  md5: string;
  sizeBytes: number;
  mimetype: string;
  localUri: string;
  downloadedAt: string;
}

export interface PlayerManifest {
  version: 1;
  sourceApiUrl: string | null;
  activePlaylistHash: string | null;
  activePlaylist: CurrentPlaylistResponse | null;
  cachedMedia: Record<string, CachedMedia>;
  lastSyncAt: string | null;
}

export interface MediaDownloadTask {
  media: CurrentPlaylistItem['media'];
  remoteUrl: string;
}

export interface MediaEvictionTask {
  mediaId: string;
  localUri: string;
}

export interface SyncPlan {
  playlistChanged: boolean;
  nextPlaylist: CurrentPlaylistResponse;
  downloads: MediaDownloadTask[];
  evictions: MediaEvictionTask[];
}

export interface PlayerRuntimeConfig {
  apiUrl: string;
  deviceName: string;
  deviceModel: string;
  androidVersion?: string;
}

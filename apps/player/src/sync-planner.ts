import type { CurrentPlaylistResponse } from '@aquatv/types';

import type { CachedMedia, PlayerManifest, SyncPlan } from './types.js';

export function createEmptyManifest(): PlayerManifest {
  return {
    version: 1,
    activePlaylistHash: null,
    activePlaylist: null,
    cachedMedia: {},
    lastSyncAt: null,
  };
}

export function resolveRemoteMediaUrl(apiUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const serverUrl = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${serverUrl}${pathOrUrl}`;
}

function isCachedMediaValid(cached: CachedMedia | undefined, md5: string): boolean {
  return cached !== undefined && cached.md5 === md5;
}

export function createSyncPlan(
  apiUrl: string,
  manifest: PlayerManifest,
  nextPlaylist: CurrentPlaylistResponse,
): SyncPlan {
  const requiredMediaIds = new Set(nextPlaylist.items.map((item) => item.media.id));
  const downloads = nextPlaylist.items
    .filter((item) => !isCachedMediaValid(manifest.cachedMedia[item.media.id], item.media.md5))
    .map((item) => ({
      media: item.media,
      remoteUrl: resolveRemoteMediaUrl(apiUrl, item.media.url),
    }));

  const evictions = Object.values(manifest.cachedMedia)
    .filter((cached) => !requiredMediaIds.has(cached.mediaId))
    .map((cached) => ({
      mediaId: cached.mediaId,
      localUri: cached.localUri,
    }));

  return {
    playlistChanged: manifest.activePlaylistHash !== nextPlaylist.playlist.hash,
    nextPlaylist,
    downloads,
    evictions,
  };
}

export function applyCompletedSyncPlan(
  manifest: PlayerManifest,
  plan: SyncPlan,
  downloadedMedia: CachedMedia[],
): PlayerManifest {
  const cachedMedia = { ...manifest.cachedMedia };

  for (const eviction of plan.evictions) {
    delete cachedMedia[eviction.mediaId];
  }

  for (const media of downloadedMedia) {
    cachedMedia[media.mediaId] = media;
  }

  return {
    version: 1,
    activePlaylistHash: plan.nextPlaylist.playlist.hash,
    activePlaylist: plan.nextPlaylist,
    cachedMedia,
    lastSyncAt: new Date().toISOString(),
  };
}

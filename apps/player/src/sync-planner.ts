import type { CurrentPlaylistResponse } from '@aquatv/types';

import type { CachedMedia, PlayerManifest, SyncPlan } from './types.js';

export function createEmptyManifest(sourceApiUrl: string | null = null): PlayerManifest {
  return {
    version: 1,
    sourceApiUrl,
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
  const requiredMedia = new Map<string, CurrentPlaylistResponse['items'][number]['media']>();

  for (const item of nextPlaylist.items) {
    const existing = requiredMedia.get(item.media.id);
    if (existing && existing.md5 !== item.media.md5) {
      throw new Error(`Midia ${item.media.id} possui hashes diferentes na mesma playlist`);
    }

    requiredMedia.set(item.media.id, item.media);
  }

  const downloads = Array.from(requiredMedia.values())
    .filter((media) => !isCachedMediaValid(manifest.cachedMedia[media.id], media.md5))
    .map((media) => ({
      media,
      remoteUrl: resolveRemoteMediaUrl(apiUrl, media.url),
    }));

  const evictions = Object.values(manifest.cachedMedia)
    .filter((cached) => requiredMedia.get(cached.mediaId)?.md5 !== cached.md5)
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
  sourceApiUrl: string | null = manifest.sourceApiUrl,
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
    sourceApiUrl,
    activePlaylistHash: plan.nextPlaylist.playlist.hash,
    activePlaylist: plan.nextPlaylist,
    cachedMedia,
    lastSyncAt: new Date().toISOString(),
  };
}

export function applyNoPlaybackState(
  manifest: PlayerManifest,
  sourceApiUrl: string,
  syncedAt: string = new Date().toISOString(),
): PlayerManifest {
  return {
    version: 1,
    sourceApiUrl,
    activePlaylistHash: null,
    activePlaylist: null,
    cachedMedia: { ...manifest.cachedMedia },
    lastSyncAt: syncedAt,
  };
}

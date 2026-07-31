import * as FileSystem from 'expo-file-system/legacy';

import type { CurrentPlaylistItem, CurrentPlaylistResponse } from '@aquatv/types';

import {
  applyCompletedSyncPlan,
  applyNoPlaybackState,
  createEmptyManifest,
  createSyncPlan,
} from '../sync-planner';
import type { CachedMedia, PlayerManifest } from '../types';

export interface CacheProgress {
  done: number;
  total: number;
  currentName: string | null;
}

const appDirectoryName = 'aquatv-player';
const mediaDirectoryName = 'media';
const manifestFileName = 'manifest.v1.json';
const previousManifestFileName = 'manifest.previous.v1.json';
const downloadTimeoutMs = 2 * 60_000;
const storageReserveBytes = 256 * 1024 * 1024;
const verifiedPlaylistCaches = new Set<string>();

function getRequiredDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Diretorio interno indisponivel');
  }
  return FileSystem.documentDirectory;
}

function joinUri(baseUri: string, segment: string): string {
  return `${baseUri.replace(/\/$/, '')}/${segment}`;
}

function getAppDirectoryUri(): string {
  return joinUri(getRequiredDocumentDirectory(), appDirectoryName);
}

function getMediaDirectoryUri(): string {
  return joinUri(getAppDirectoryUri(), mediaDirectoryName);
}

function getManifestUri(): string {
  return joinUri(getAppDirectoryUri(), manifestFileName);
}

function getPreviousManifestUri(): string {
  return joinUri(getAppDirectoryUri(), previousManifestFileName);
}

function sanitizeFilename(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getCachedMediaFilename(mediaId: string, md5: string, storedName: string): string {
  const safeStoredName = sanitizeFilename(storedName) || 'media';
  return `${sanitizeFilename(mediaId)}-${sanitizeFilename(md5)}-${safeStoredName}`;
}

async function ensureDirectory(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

async function ensureStorageReady(): Promise<void> {
  await ensureDirectory(getAppDirectoryUri());
  await ensureDirectory(getMediaDirectoryUri());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaybackMedia(value: unknown): value is CurrentPlaylistItem['media'] {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.storedName === 'string' &&
    typeof value.url === 'string' &&
    typeof value.md5 === 'string' &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    typeof value.mimetype === 'string'
  );
}

function isPlaylistItem(value: unknown): value is CurrentPlaylistItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.order === 'number' &&
    (value.durationOverrideMs === null || typeof value.durationOverrideMs === 'number') &&
    isPlaybackMedia(value.media)
  );
}

function isCurrentPlaylist(value: unknown): value is CurrentPlaylistResponse {
  if (!isRecord(value) || !isRecord(value.playlist) || !Array.isArray(value.items)) {
    return false;
  }
  const shapeIsValid =
    typeof value.playlist.id === 'string' &&
    typeof value.playlist.name === 'string' &&
    typeof value.playlist.hash === 'string' &&
    value.items.every(isPlaylistItem);
  if (!shapeIsValid) {
    return false;
  }

  const mediaHashes = new Map<string, string>();
  for (const item of value.items) {
    const existingHash = mediaHashes.get(item.media.id);
    if (existingHash && existingHash !== item.media.md5) {
      return false;
    }
    mediaHashes.set(item.media.id, item.media.md5);
  }
  return true;
}

function isCachedMedia(value: unknown): value is CachedMedia {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.mediaId === 'string' &&
    typeof value.storedName === 'string' &&
    typeof value.md5 === 'string' &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    typeof value.mimetype === 'string' &&
    typeof value.localUri === 'string' &&
    typeof value.downloadedAt === 'string'
  );
}

function parsePlayerManifest(value: unknown): PlayerManifest | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const cachedMedia = value.cachedMedia;
  if (
    !isRecord(cachedMedia) ||
    !Object.entries(cachedMedia).every(
      ([mediaId, media]) => isCachedMedia(media) && media.mediaId === mediaId,
    )
  ) {
    return null;
  }
  if (value.activePlaylist !== null && !isCurrentPlaylist(value.activePlaylist)) {
    return null;
  }
  if (value.activePlaylistHash !== null && typeof value.activePlaylistHash !== 'string') {
    return null;
  }
  if (value.activePlaylist === null && value.activePlaylistHash !== null) {
    return null;
  }
  if (
    value.activePlaylist !== null &&
    value.activePlaylistHash !== value.activePlaylist.playlist.hash
  ) {
    return null;
  }
  if (value.lastSyncAt !== null && typeof value.lastSyncAt !== 'string') {
    return null;
  }
  if (
    value.sourceApiUrl !== undefined &&
    value.sourceApiUrl !== null &&
    typeof value.sourceApiUrl !== 'string'
  ) {
    return null;
  }

  return {
    version: 1,
    sourceApiUrl: typeof value.sourceApiUrl === 'string' ? value.sourceApiUrl : null,
    activePlaylistHash: value.activePlaylistHash,
    activePlaylist: value.activePlaylist,
    cachedMedia: cachedMedia as Record<string, CachedMedia>,
    lastSyncAt: value.lastSyncAt,
  };
}

async function readManifest(uri: string): Promise<PlayerManifest | null> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    return null;
  }

  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(uri)) as unknown;
    return parsePlayerManifest(parsed);
  } catch {
    return null;
  }
}

async function isCachedFileUsable(media: CachedMedia, verifyMd5 = false): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(media.localUri, { md5: verifyMd5 });
  return (
    info.exists &&
    !info.isDirectory &&
    info.size === media.sizeBytes &&
    (!verifyMd5 || info.md5?.toLowerCase() === media.md5.toLowerCase())
  );
}

async function isManifestUsable(
  manifest: PlayerManifest | null,
  expectedApiUrl?: string,
): Promise<boolean> {
  if (!manifest) {
    return false;
  }
  if (
    expectedApiUrl &&
    manifest.sourceApiUrl !== null &&
    manifest.sourceApiUrl !== expectedApiUrl
  ) {
    return false;
  }
  if (!manifest.activePlaylist) {
    return true;
  }

  const requiredMedia = new Map(
    manifest.activePlaylist.items.map((item) => [item.media.id, item.media]),
  );
  for (const media of requiredMedia.values()) {
    const cached = manifest.cachedMedia[media.id];
    if (!cached || cached.md5 !== media.md5 || !(await isCachedFileUsable(cached))) {
      return false;
    }
  }
  return true;
}

async function writeManifestAtomically(uri: string, manifest: PlayerManifest): Promise<void> {
  const pendingUri = `${uri}.pending`;
  await FileSystem.deleteAsync(pendingUri, { idempotent: true });
  await FileSystem.writeAsStringAsync(pendingUri, JSON.stringify(manifest));

  const pendingManifest = await readManifest(pendingUri);
  if (!pendingManifest) {
    await FileSystem.deleteAsync(pendingUri, { idempotent: true });
    throw new Error('Falha ao validar manifesto local');
  }

  await FileSystem.deleteAsync(uri, { idempotent: true });
  await FileSystem.moveAsync({ from: pendingUri, to: uri });
}

async function commitManifest(
  currentManifest: PlayerManifest,
  nextManifest: PlayerManifest,
): Promise<void> {
  await writeManifestAtomically(getPreviousManifestUri(), currentManifest);
  await writeManifestAtomically(getManifestUri(), nextManifest);
}

async function commitNoPlaybackManifest(manifest: PlayerManifest): Promise<void> {
  await writeManifestAtomically(getPreviousManifestUri(), manifest);
  await writeManifestAtomically(getManifestUri(), manifest);
}

function getReferencedUris(manifests: PlayerManifest[]): Set<string> {
  return new Set(
    manifests.flatMap((manifest) =>
      Object.values(manifest.cachedMedia).map((media) => media.localUri),
    ),
  );
}

async function cleanupOrphanedMedia(manifests: PlayerManifest[]): Promise<void> {
  const mediaDirectoryUri = getMediaDirectoryUri();
  const referencedUris = getReferencedUris(manifests);
  const filenames = await FileSystem.readDirectoryAsync(mediaDirectoryUri).catch(() => []);

  await Promise.all(
    filenames.map(async (filename) => {
      const uri = joinUri(mediaDirectoryUri, filename);
      if (!referencedUris.has(uri)) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
    }),
  );
}

function getManifestSyncTime(manifest: PlayerManifest | null): number {
  if (!manifest?.lastSyncAt) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = Date.parse(manifest.lastSyncAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export async function loadPlayerManifest(expectedApiUrl?: string): Promise<PlayerManifest> {
  await ensureStorageReady();

  const active = await readManifest(getManifestUri());
  const previous = await readManifest(getPreviousManifestUri());
  const [activeIsUsable, previousIsUsable] = await Promise.all([
    isManifestUsable(active, expectedApiUrl),
    isManifestUsable(previous, expectedApiUrl),
  ]);

  if (
    previousIsUsable &&
    previous?.activePlaylist === null &&
    previous.lastSyncAt !== null &&
    (!activeIsUsable || getManifestSyncTime(previous) > getManifestSyncTime(active))
  ) {
    return previous;
  }
  if (activeIsUsable && active) {
    return active;
  }
  if (previousIsUsable && previous) {
    return previous;
  }

  return createEmptyManifest(expectedApiUrl ?? null);
}

async function downloadWithTimeout(remoteUrl: string, tempUri: string): Promise<void> {
  const download = FileSystem.createDownloadResumable(remoteUrl, tempUri, { md5: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancellation: Promise<void> | undefined;

  try {
    const result = await Promise.race([
      download.downloadAsync(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          cancellation = download.cancelAsync().catch(() => undefined);
          void cancellation.finally(() => reject(new Error('Download excedeu dois minutos')));
        }, downloadTimeoutMs);
      }),
    ]);

    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Download respondeu ${result?.status ?? 'sem status'}`);
    }
  } catch (error) {
    await cancellation;
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function downloadMedia(
  mediaDirectoryUri: string,
  task: ReturnType<typeof createSyncPlan>['downloads'][number],
): Promise<CachedMedia> {
  const filename = getCachedMediaFilename(task.media.id, task.media.md5, task.media.storedName);
  const finalUri = joinUri(mediaDirectoryUri, filename);
  const tempUri = `${finalUri}.tmp`;
  const existing = await FileSystem.getInfoAsync(finalUri, { md5: true });

  if (
    !existing.exists ||
    existing.isDirectory ||
    existing.size !== task.media.sizeBytes ||
    existing.md5?.toLowerCase() !== task.media.md5.toLowerCase()
  ) {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
    try {
      await downloadWithTimeout(task.remoteUrl, tempUri);
    } catch (error) {
      await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
      throw error;
    }

    const downloaded = await FileSystem.getInfoAsync(tempUri, { md5: true });
    if (
      !downloaded.exists ||
      downloaded.isDirectory ||
      downloaded.size !== task.media.sizeBytes ||
      downloaded.md5?.toLowerCase() !== task.media.md5.toLowerCase()
    ) {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      throw new Error(`Arquivo invalido: ${task.media.storedName}`);
    }

    await FileSystem.deleteAsync(finalUri, { idempotent: true });
    await FileSystem.moveAsync({ from: tempUri, to: finalUri });
  }

  return {
    mediaId: task.media.id,
    storedName: task.media.storedName,
    md5: task.media.md5,
    sizeBytes: task.media.sizeBytes,
    mimetype: task.media.mimetype,
    localUri: finalUri,
    downloadedAt: new Date().toISOString(),
  };
}

async function assertEnoughDiskSpace(downloadBytes: number): Promise<void> {
  if (downloadBytes === 0) {
    return;
  }
  const freeBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
  if (freeBytes !== null && freeBytes < downloadBytes + storageReserveBytes) {
    throw new Error('Espaco insuficiente para atualizar a playlist com seguranca');
  }
}

function getPlaylistCacheKey(apiUrl: string, playlist: CurrentPlaylistResponse): string {
  return `${apiUrl}:${playlist.playlist.hash}`;
}

async function removeCorruptedRequiredMedia(
  manifest: PlayerManifest,
  playlist: CurrentPlaylistResponse,
): Promise<PlayerManifest> {
  const cachedMedia = { ...manifest.cachedMedia };
  const requiredMedia = new Map(playlist.items.map((item) => [item.media.id, item.media]));
  let changed = false;

  for (const media of requiredMedia.values()) {
    const cached = cachedMedia[media.id];
    if (cached && cached.md5 === media.md5 && !(await isCachedFileUsable(cached, true))) {
      delete cachedMedia[media.id];
      changed = true;
    }
  }

  return changed ? { ...manifest, cachedMedia } : manifest;
}

export async function synchronizePlaylistCache(
  apiUrl: string,
  nextPlaylist: CurrentPlaylistResponse,
  onProgress: (progress: CacheProgress) => void,
): Promise<PlayerManifest> {
  await ensureStorageReady();

  const cacheKey = getPlaylistCacheKey(apiUrl, nextPlaylist);
  let currentManifest = await loadPlayerManifest(apiUrl);
  if (!verifiedPlaylistCaches.has(cacheKey)) {
    currentManifest = await removeCorruptedRequiredMedia(currentManifest, nextPlaylist);
  }
  const plan = createSyncPlan(apiUrl, currentManifest, nextPlaylist);
  if (
    currentManifest.sourceApiUrl === apiUrl &&
    !plan.playlistChanged &&
    plan.downloads.length === 0 &&
    plan.evictions.length === 0
  ) {
    verifiedPlaylistCaches.add(cacheKey);
    return currentManifest;
  }

  await assertEnoughDiskSpace(
    plan.downloads.reduce((total, task) => total + task.media.sizeBytes, 0),
  );

  const mediaDirectoryUri = getMediaDirectoryUri();
  const downloadedMedia: CachedMedia[] = [];
  onProgress({ done: 0, total: plan.downloads.length, currentName: null });

  for (const [index, task] of plan.downloads.entries()) {
    onProgress({
      done: index,
      total: plan.downloads.length,
      currentName: task.media.storedName,
    });
    downloadedMedia.push(await downloadMedia(mediaDirectoryUri, task));
  }

  const nextManifest = applyCompletedSyncPlan(currentManifest, plan, downloadedMedia, apiUrl);
  if (!(await isManifestUsable(nextManifest, apiUrl))) {
    throw new Error('A nova playlist nao ficou integra no cache');
  }

  await commitManifest(currentManifest, nextManifest);
  await cleanupOrphanedMedia([currentManifest, nextManifest]);
  verifiedPlaylistCaches.add(cacheKey);
  onProgress({ done: plan.downloads.length, total: plan.downloads.length, currentName: null });

  return nextManifest;
}

export async function synchronizeNoPlaybackState(apiUrl: string): Promise<PlayerManifest> {
  await ensureStorageReady();
  verifiedPlaylistCaches.clear();

  const storedActive = await readManifest(getManifestUri());
  if (
    storedActive?.sourceApiUrl === apiUrl &&
    storedActive.activePlaylist === null &&
    storedActive.activePlaylistHash === null &&
    storedActive.lastSyncAt !== null &&
    (await isManifestUsable(storedActive, apiUrl))
  ) {
    return storedActive;
  }

  const currentManifest = await loadPlayerManifest(apiUrl);
  const nextManifest = applyNoPlaybackState(currentManifest, apiUrl);
  await commitNoPlaybackManifest(nextManifest);
  return nextManifest;
}

export function getCachedMediaUris(manifest: PlayerManifest): Record<string, string> {
  return Object.fromEntries(
    Object.values(manifest.cachedMedia).map((media) => [media.mediaId, media.localUri]),
  );
}

export async function getDiskStatsMb(): Promise<{
  freeDiskMb?: number;
  totalDiskMb?: number;
}> {
  const [freeBytes, totalBytes] = await Promise.all([
    FileSystem.getFreeDiskStorageAsync().catch(() => null),
    FileSystem.getTotalDiskCapacityAsync().catch(() => null),
  ]);

  return {
    ...(freeBytes !== null ? { freeDiskMb: Math.floor(freeBytes / 1024 / 1024) } : {}),
    ...(totalBytes !== null ? { totalDiskMb: Math.floor(totalBytes / 1024 / 1024) } : {}),
  };
}

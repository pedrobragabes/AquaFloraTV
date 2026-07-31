import assert from 'node:assert/strict';
import test from 'node:test';

import type { CurrentPlaylistItem, CurrentPlaylistResponse } from '@aquatv/types';

import {
  applyCompletedSyncPlan,
  applyNoPlaybackState,
  createEmptyManifest,
  createSyncPlan,
} from './sync-planner.js';
import type { CachedMedia } from './types.js';

function media(id: string, md5 = `${id}-hash`): CurrentPlaylistItem['media'] {
  return {
    id,
    storedName: `${id}.mp4`,
    url: `/storage/${id}.mp4`,
    md5,
    sizeBytes: 100,
    mimetype: 'video/mp4',
  };
}

function playlist(items: CurrentPlaylistItem['media'][]): CurrentPlaylistResponse {
  return {
    playlist: {
      id: 'playlist-1',
      name: 'Principal',
      hash: items.map((item) => item.md5).join(':'),
    },
    items: items.map((item, index) => ({
      id: `item-${index}`,
      order: index,
      durationOverrideMs: null,
      media: item,
    })),
  };
}

function cached(mediaId: string, md5: string): CachedMedia {
  return {
    mediaId,
    storedName: `${mediaId}.mp4`,
    md5,
    sizeBytes: 100,
    mimetype: 'video/mp4',
    localUri: `file:///cache/${mediaId}-${md5}.mp4`,
    downloadedAt: '2026-07-30T12:00:00.000Z',
  };
}

test('deduplica downloads sem remover repeticoes da playlist', () => {
  const repeatedMedia = media('video-1');
  const nextPlaylist = playlist([repeatedMedia, repeatedMedia]);
  const plan = createSyncPlan('http://localhost:7741/api', createEmptyManifest(), nextPlaylist);

  assert.equal(plan.downloads.length, 1);
  assert.equal(plan.nextPlaylist.items.length, 2);
});

test('troca de MD5 baixa a versao nova e marca a antiga para limpeza', () => {
  const manifest = createEmptyManifest('http://localhost:7741/api');
  manifest.cachedMedia['video-1'] = cached('video-1', 'hash-antigo');
  const plan = createSyncPlan(
    'http://localhost:7741/api',
    manifest,
    playlist([media('video-1', 'hash-novo')]),
  );

  assert.equal(plan.downloads.length, 1);
  assert.deepEqual(
    plan.evictions.map((item) => item.mediaId),
    ['video-1'],
  );
});

test('aplica a playlist somente com as midias concluidas', () => {
  const manifest = createEmptyManifest('http://localhost:7741/api');
  const nextPlaylist = playlist([media('video-1')]);
  const plan = createSyncPlan('http://localhost:7741/api', manifest, nextPlaylist);
  const downloaded = cached('video-1', 'video-1-hash');
  const result = applyCompletedSyncPlan(manifest, plan, [downloaded], 'http://localhost:7741/api');

  assert.equal(manifest.activePlaylist, null);
  assert.equal(result.activePlaylist?.playlist.id, 'playlist-1');
  assert.equal(result.cachedMedia['video-1']?.localUri, downloaded.localUri);
});

test('rejeita o mesmo ID de midia com hashes conflitantes', () => {
  assert.throws(
    () =>
      createSyncPlan(
        'http://localhost:7741/api',
        createEmptyManifest(),
        playlist([media('video-1', 'hash-a'), media('video-1', 'hash-b')]),
      ),
    /hashes diferentes/,
  );
});

test('persiste pausa sem apagar os arquivos em cache', () => {
  const manifest = createEmptyManifest('http://localhost:7741/api');
  manifest.activePlaylist = playlist([media('video-1')]);
  manifest.activePlaylistHash = manifest.activePlaylist.playlist.hash;
  manifest.cachedMedia['video-1'] = cached('video-1', 'video-1-hash');

  const paused = applyNoPlaybackState(
    manifest,
    'http://localhost:7741/api',
    '2026-07-30T15:00:00.000Z',
  );

  assert.equal(paused.activePlaylist, null);
  assert.equal(paused.activePlaylistHash, null);
  assert.equal(paused.lastSyncAt, '2026-07-30T15:00:00.000Z');
  assert.equal(paused.cachedMedia['video-1']?.localUri, manifest.cachedMedia['video-1']?.localUri);
  assert.notEqual(paused.cachedMedia, manifest.cachedMedia);
  assert.notEqual(manifest.activePlaylist, null);
});

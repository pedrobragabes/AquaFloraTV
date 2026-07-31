import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlayerPlaylist } from './player-api.js';

const credentials = { id: 'device-1', token: 'secret-token' };

test('interpreta 404 da playlist atual como ausencia de playback', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(null, { status: 404 });

  const result = await getPlayerPlaylist('http://localhost:7741/api', credentials);

  assert.equal(result, null);
});

test('mantem outros status HTTP como falha de sincronizacao', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(null, { status: 503 });

  await assert.rejects(
    getPlayerPlaylist('http://localhost:7741/api', credentials),
    /API respondeu 503/,
  );
});

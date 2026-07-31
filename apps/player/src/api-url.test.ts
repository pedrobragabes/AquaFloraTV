import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeApiUrl } from './api-url.js';

test('normaliza IP local sem protocolo e acrescenta /api', () => {
  assert.equal(normalizeApiUrl('192.168.1.10:7741'), 'http://192.168.1.10:7741/api');
});

test('preserva HTTPS e um caminho que ja termina em /api', () => {
  assert.equal(
    normalizeApiUrl('https://tv.exemplo.com/aquatv/api/'),
    'https://tv.exemplo.com/aquatv/api',
  );
});

test('remove query e rejeita protocolos ou credenciais inadequados', () => {
  assert.equal(normalizeApiUrl('http://localhost:7741?debug=1'), 'http://localhost:7741/api');
  assert.equal(normalizeApiUrl('ftp://localhost:7741'), null);
  assert.equal(normalizeApiUrl('http://usuario:senha@localhost:7741'), null);
  assert.equal(normalizeApiUrl(''), null);
});

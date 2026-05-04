'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveApiBaseUrl } from '../../lib/api-base';

type DeviceCredentials = {
  id: string;
  token: string;
};

type PlaylistItem = {
  id: string;
  order: number;
  durationOverrideMs: number | null;
  media: {
    id: string;
    storedName: string;
    url: string;
    md5: string;
    sizeBytes: number;
    mimetype: string;
  };
};

type CurrentPlaylistResponse = {
  playlist: {
    id: string;
    name: string;
    hash: string;
  };
  items: PlaylistItem[];
};

type PlayerStatus = 'starting' | 'registering' | 'syncing' | 'playing' | 'empty' | 'offline';

type PlayerRotation = 0 | 90 | 180 | 270;

const credentialsStorageKey = 'aquatv.player.credentials.v1';
const rotationStorageKey = 'aquatv.player.rotation.v1';
const playerStartedAt = Date.now();
const imageFallbackDurationMs = 10_000;
const playlistPollMs = 60_000;
const heartbeatMs = 30_000;

function getMediaUrl(apiBaseUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  return `${apiBaseUrl}${pathOrUrl}`;
}

function readStoredCredentials(): DeviceCredentials | null {
  const rawValue = window.localStorage.getItem(credentialsStorageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DeviceCredentials>;
    if (typeof parsed.id === 'string' && typeof parsed.token === 'string') {
      return { id: parsed.id, token: parsed.token };
    }
  } catch {
    window.localStorage.removeItem(credentialsStorageKey);
  }

  return null;
}

function storeCredentials(credentials: DeviceCredentials): void {
  window.localStorage.setItem(credentialsStorageKey, JSON.stringify(credentials));
}

function getDeviceName(): string {
  if (typeof window === 'undefined') {
    return 'AquaTV Web Player';
  }

  return `AquaTV Web Player - ${window.location.hostname}`;
}

function parseRotation(value: string | null): PlayerRotation | null {
  if (value === '0' || value === '90' || value === '180' || value === '270') {
    return Number(value) as PlayerRotation;
  }

  return null;
}

function readInitialRotation(): PlayerRotation {
  if (typeof window === 'undefined') {
    return 0;
  }

  const params = new URLSearchParams(window.location.search);
  return (
    parseRotation(params.get('rotation')) ??
    parseRotation(params.get('rotate')) ??
    parseRotation(window.localStorage.getItem(rotationStorageKey)) ??
    0
  );
}

function getNextRotation(rotation: PlayerRotation): PlayerRotation {
  if (rotation === 0) return 90;
  if (rotation === 90) return 180;
  if (rotation === 180) return 270;
  return 0;
}

export function TvPlayer() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [playlist, setPlaylist] = useState<CurrentPlaylistResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>('starting');
  const [message, setMessage] = useState('Inicializando player');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [rotation, setRotation] = useState<PlayerRotation>(readInitialRotation);

  const currentItem = playlist?.items[currentIndex] ?? null;
  const currentMediaUrl = currentItem ? getMediaUrl(apiBaseUrl, currentItem.media.url) : null;

  const changeRotation = useCallback((nextRotation: PlayerRotation): void => {
    setRotation(nextRotation);
    window.localStorage.setItem(rotationStorageKey, String(nextRotation));

    const url = new URL(window.location.href);
    if (nextRotation === 0) {
      url.searchParams.delete('rotation');
      url.searchParams.delete('rotate');
    } else {
      url.searchParams.set('rotation', String(nextRotation));
      url.searchParams.delete('rotate');
    }
    window.history.replaceState(null, '', url);
  }, []);

  const registerDevice = useCallback(async (): Promise<DeviceCredentials> => {
    setStatus('registering');
    setMessage('Registrando device');

    const stored = readStoredCredentials();
    if (stored) {
      setCredentials(stored);
      return stored;
    }

    const response = await fetch(`${apiBaseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: getDeviceName(),
        deviceModel: 'browser-player',
        androidVersion: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Registro falhou (${response.status})`);
    }

    const created = (await response.json()) as DeviceCredentials;
    storeCredentials(created);
    setCredentials(created);
    return created;
  }, [apiBaseUrl]);

  const syncPlaylist = useCallback(
    async (activeCredentials: DeviceCredentials): Promise<void> => {
      setStatus((currentStatus) => (currentStatus === 'playing' ? currentStatus : 'syncing'));
      setMessage('Sincronizando playlist');

      const response = await fetch(
        `${apiBaseUrl}/api/devices/${activeCredentials.id}/current-playlist`,
        {
          headers: {
            Authorization: `Bearer ${activeCredentials.token}`,
          },
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          setPlaylist(null);
          setCurrentIndex(0);
          setStatus('empty');
          setMessage('Nenhuma playlist ativa');
          return;
        }

        throw new Error(`Sync falhou (${response.status})`);
      }

      const payload = (await response.json()) as CurrentPlaylistResponse;
      setPlaylist((currentPlaylist) => {
        if (currentPlaylist?.playlist.hash !== payload.playlist.hash) {
          setCurrentIndex(0);
        }

        return payload;
      });
      setLastSyncAt(new Date());
      setStatus(payload.items.length > 0 ? 'playing' : 'empty');
      setMessage(payload.items.length > 0 ? payload.playlist.name : 'Playlist sem midias');
    },
    [apiBaseUrl],
  );

  const sendHeartbeat = useCallback(
    async (
      activeCredentials: DeviceCredentials,
      activeItem: PlaylistItem | null,
    ): Promise<void> => {
      await fetch(`${apiBaseUrl}/api/devices/${activeCredentials.id}/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeCredentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uptimeSeconds: Math.floor((Date.now() - playerStartedAt) / 1000),
          appVersion: 'web-player-0.1.0',
          currentMediaId: activeItem?.media.id,
          networkType: navigator.onLine ? 'online' : 'offline',
        }),
      }).catch(() => undefined);
    },
    [apiBaseUrl],
  );

  const advance = useCallback(() => {
    setCurrentIndex((index) => {
      const itemCount = playlist?.items.length ?? 0;
      if (itemCount === 0) {
        return 0;
      }

      return (index + 1) % itemCount;
    });
  }, [playlist?.items.length]);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const activeCredentials = await registerDevice();
        if (cancelled) {
          return;
        }

        await syncPlaylist(activeCredentials);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Falha ao iniciar player';
        setStatus('offline');
        setMessage(errorMessage);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [registerDevice, syncPlaylist]);

  useEffect(() => {
    if (!credentials) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void syncPlaylist(credentials).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Falha ao sincronizar';
        setStatus('offline');
        setMessage(errorMessage);
      });
    }, playlistPollMs);

    return () => window.clearInterval(timer);
  }, [credentials, syncPlaylist]);

  useEffect(() => {
    if (!credentials) {
      return undefined;
    }

    const stream = new EventSource(
      `${apiBaseUrl}/api/devices/${credentials.id}/stream?token=${encodeURIComponent(
        credentials.token,
      )}`,
    );

    stream.addEventListener('sync', () => {
      void syncPlaylist(credentials).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Falha ao sincronizar';
        setStatus('offline');
        setMessage(errorMessage);
      });
    });

    stream.onerror = () => {
      stream.close();
    };

    return () => stream.close();
  }, [apiBaseUrl, credentials, syncPlaylist]);

  useEffect(() => {
    if (!credentials) {
      return undefined;
    }

    void sendHeartbeat(credentials, currentItem);
    const timer = window.setInterval(() => {
      void sendHeartbeat(credentials, currentItem);
    }, heartbeatMs);

    return () => window.clearInterval(timer);
  }, [credentials, currentItem, sendHeartbeat]);

  useEffect(() => {
    if (!currentItem || !currentItem.media.mimetype.startsWith('image/')) {
      return undefined;
    }

    const timer = window.setTimeout(
      advance,
      currentItem.durationOverrideMs ?? imageFallbackDurationMs,
    );

    return () => window.clearTimeout(timer);
  }, [advance, currentItem]);

  useEffect(() => {
    if (!currentItem || !currentItem.media.mimetype.startsWith('video/')) {
      return;
    }

    void videoRef.current?.play().catch(() => undefined);
  }, [currentItem, currentMediaUrl]);

  return (
    <main className="tv-player-screen" data-rotation={rotation}>
      {currentItem ? (
        <section className="tv-stage" aria-label="Midia em reproducao">
          <div className="tv-stage-frame">
            {currentItem.media.mimetype.startsWith('image/') ? (
              <img alt="" src={currentMediaUrl ?? getMediaUrl(apiBaseUrl, currentItem.media.url)} />
            ) : (
              <video
                autoPlay
                muted
                playsInline
                ref={videoRef}
                src={currentMediaUrl ?? getMediaUrl(apiBaseUrl, currentItem.media.url)}
                onEnded={advance}
                onError={advance}
              />
            )}
          </div>
        </section>
      ) : (
        <section className="tv-empty-state">
          <strong>AquaTV</strong>
          <span>{message}</span>
        </section>
      )}

      <aside className="tv-debug-panel" aria-label="Status do player">
        <strong>{status}</strong>
        <span>{message}</span>
        <span>{credentials ? `device ${credentials.id.slice(0, 8)}` : 'sem device'}</span>
        <span>{playlist ? `${currentIndex + 1}/${playlist.items.length}` : 'sem playlist'}</span>
        <span>
          {lastSyncAt ? `sync ${lastSyncAt.toLocaleTimeString('pt-BR')}` : 'sync pendente'}
        </span>
        <span>{`api ${apiBaseUrl}`}</span>
        <span>{`rotacao ${rotation}deg`}</span>
      </aside>

      <aside className="tv-orientation-controls" aria-label="Orientacao do player">
        <button type="button" onClick={() => changeRotation(getNextRotation(rotation))}>
          Girar
        </button>
        {rotation !== 0 ? (
          <button type="button" onClick={() => changeRotation(0)}>
            Reset
          </button>
        ) : null}
      </aside>
    </main>
  );
}

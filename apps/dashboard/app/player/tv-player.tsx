'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const credentialsStorageKey = 'aquatv.player.credentials.v1';
const playerStartedAt = Date.now();
const fallbackApiUrl = 'http://localhost:7741';
const imageFallbackDurationMs = 10_000;
const playlistPollMs = 60_000;
const heartbeatMs = 30_000;

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:7741`;
  }

  return fallbackApiUrl;
}

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

export function TvPlayer() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [playlist, setPlaylist] = useState<CurrentPlaylistResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>('starting');
  const [message, setMessage] = useState('Inicializando player');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const currentItem = playlist?.items[currentIndex] ?? null;

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
  }, [currentItem]);

  return (
    <main className="tv-player-screen">
      {currentItem ? (
        <section className="tv-stage" aria-label="Midia em reproducao">
          {currentItem.media.mimetype.startsWith('image/') ? (
            <img alt="" src={getMediaUrl(apiBaseUrl, currentItem.media.url)} />
          ) : (
            <video
              autoPlay
              muted
              playsInline
              ref={videoRef}
              src={getMediaUrl(apiBaseUrl, currentItem.media.url)}
              onEnded={advance}
              onError={advance}
            />
          )}
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
      </aside>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type MediaResponse = { pagination: { total: number } };
type PlaylistResponse = {
  data: Array<{
    id: string;
    name: string;
    _count?: {
      items: number;
    };
  }>;
  defaultPlaylistId: string | null;
};
type ScheduleResponse = { data: Array<{ id: string; active: boolean }> };
type DeviceResponse = { data: Array<{ id: string; lastSeenAt: string | null }> };
type CurrentPlayback = {
  activeSchedule: { id: string; name: string } | null;
  playlist: { id: string; name: string; itemCount: number } | null;
};
type PlaylistDetail = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    order: number;
    media: {
      id: string;
      filename: string;
      url: string;
      mimetype: string;
    };
  }>;
};

const fallbackApiUrl = 'http://localhost:7741';
const onlineThresholdMs = 90_000;

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:7741`;
  }

  return fallbackApiUrl;
}

function isOnline(lastSeenAt: string | null): boolean {
  return lastSeenAt !== null && Date.now() - new Date(lastSeenAt).getTime() <= onlineThresholdMs;
}

function getMediaUrl(apiBaseUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  return `${apiBaseUrl}${pathOrUrl}`;
}

function getVideoPreviewUrl(apiBaseUrl: string, pathOrUrl: string): string {
  return `${getMediaUrl(apiBaseUrl, pathOrUrl)}#t=0.1`;
}

export function OverviewDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [mediaCount, setMediaCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [playlists, setPlaylists] = useState<PlaylistResponse['data']>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [defaultPlaylistId, setDefaultPlaylistId] = useState<string | null>(null);
  const [defaultPlaylistName, setDefaultPlaylistName] = useState<string | null>(null);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [activeScheduleCount, setActiveScheduleCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [onlineDeviceCount, setOnlineDeviceCount] = useState(0);
  const [currentPlayback, setCurrentPlayback] = useState<CurrentPlayback | null>(null);
  const [currentPlaylistItems, setCurrentPlaylistItems] = useState<PlaylistDetail['items']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        mediaResponse,
        playlistsResponse,
        schedulesResponse,
        devicesResponse,
        currentResponse,
      ] = await Promise.all([
        fetch(`${apiBaseUrl}/api/media?pageSize=1`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/playlists`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/schedules`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/devices`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/schedules/current`, { cache: 'no-store' }),
      ]);

      if (
        !mediaResponse.ok ||
        !playlistsResponse.ok ||
        !schedulesResponse.ok ||
        !devicesResponse.ok
      ) {
        throw new Error('Falha ao carregar resumo');
      }

      const media = (await mediaResponse.json()) as MediaResponse;
      const playlists = (await playlistsResponse.json()) as PlaylistResponse;
      const schedules = (await schedulesResponse.json()) as ScheduleResponse;
      const devices = (await devicesResponse.json()) as DeviceResponse;
      const current = currentResponse.ok
        ? ((await currentResponse.json()) as CurrentPlayback)
        : null;
      const currentPlaylist =
        current?.playlist !== null && current?.playlist !== undefined
          ? await fetch(`${apiBaseUrl}/api/playlists/${current.playlist.id}`, {
              cache: 'no-store',
            })
          : null;
      const currentPlaylistDetail =
        currentPlaylist?.ok === true ? ((await currentPlaylist.json()) as PlaylistDetail) : null;

      setMediaCount(media.pagination.total);
      setPlaylistCount(playlists.data.length);
      setPlaylists(playlists.data);
      setSelectedPlaylistId((currentSelected) => {
        if (currentSelected && playlists.data.some((playlist) => playlist.id === currentSelected)) {
          return currentSelected;
        }

        return current?.playlist?.id ?? playlists.defaultPlaylistId ?? playlists.data[0]?.id ?? '';
      });
      setDefaultPlaylistId(playlists.defaultPlaylistId);
      setDefaultPlaylistName(
        playlists.data.find((playlist) => playlist.id === playlists.defaultPlaylistId)?.name ??
          null,
      );
      setScheduleCount(schedules.data.length);
      setActiveScheduleCount(schedules.data.filter((schedule) => schedule.active).length);
      setDeviceCount(devices.data.length);
      setOnlineDeviceCount(devices.data.filter((device) => isOnline(device.lastSeenAt)).length);
      setCurrentPlayback(current);
      setCurrentPlaylistItems(currentPlaylistDetail?.items ?? []);
    } catch (overviewError) {
      const message =
        overviewError instanceof Error ? overviewError.message : 'Falha ao carregar dashboard';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const playDefaultPlaylist = useCallback(async () => {
    if (!defaultPlaylistId) {
      setError('Nenhuma playlist padrao definida.');
      return;
    }

    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: defaultPlaylistId }),
    });

    if (!response.ok) {
      setError(`Falha ao dar play (${response.status})`);
      return;
    }

    await loadOverview();
  }, [apiBaseUrl, defaultPlaylistId, loadOverview]);

  const playSelectedPlaylist = useCallback(async () => {
    if (!selectedPlaylistId) {
      setError('Selecione uma playlist.');
      return;
    }

    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: selectedPlaylistId }),
    });

    if (!response.ok) {
      setError(`Falha ao trocar playlist (${response.status})`);
      return;
    }

    await loadOverview();
  }, [apiBaseUrl, loadOverview, selectedPlaylistId]);

  const stopPlayback = useCallback(async () => {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId: null }),
    });

    if (!response.ok) {
      setError(`Falha ao parar TV (${response.status})`);
      return;
    }

    await loadOverview();
  }, [apiBaseUrl, loadOverview]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand-mark">
          <span>AquaTV</span>
          <small>Loja local</small>
        </div>
        <nav className="nav-list">
          <a aria-current="page" href="/dashboard">
            Resumo
          </a>
          <a href="/media">Midias</a>
          <a href="/playlists">Playlists</a>
          <a href="/schedule">Agenda</a>
          <a href="/devices">TV Box</a>
          <a href="/releases">APKs</a>
          <a href="/api/auth/logout">Sair</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Operacao</p>
            <h1>Resumo</h1>
          </div>
          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={() => void loadOverview()}>
              Atualizar
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!defaultPlaylistId}
              onClick={() => void playDefaultPlaylist()}
            >
              Dar play padrao
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={!defaultPlaylistId}
              onClick={() => void stopPlayback()}
            >
              Parar TV
            </button>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}
        {isLoading ? <p className="muted">Carregando resumo...</p> : null}

        <section className="metrics-grid" aria-label="Resumo operacional">
          <div>
            <strong>{mediaCount}</strong>
            <span>midias</span>
          </div>
          <div>
            <strong>{playlistCount}</strong>
            <span>playlists</span>
          </div>
          <div>
            <strong>
              {activeScheduleCount}/{scheduleCount}
            </strong>
            <span>regras ativas</span>
          </div>
          <div>
            <strong>
              {onlineDeviceCount}/{deviceCount}
            </strong>
            <span>devices online</span>
          </div>
        </section>

        <section className="overview-panels">
          <article className="overview-now-playing">
            <p className="eyebrow">Tocando agora</p>
            <strong>{currentPlayback?.playlist?.name ?? 'Nenhuma playlist ativa'}</strong>
            <span>
              {currentPlayback?.playlist
                ? `${currentPlayback.playlist.itemCount} itens`
                : 'player fica sem midias ate uma playlist ser ativada'}
              {currentPlayback?.activeSchedule
                ? ` - via ${currentPlayback.activeSchedule.name}`
                : currentPlayback?.playlist
                  ? ' - fallback/default'
                  : ''}
            </span>
            {currentPlayback?.playlist ? (
              <div className="overview-actions">
                <a className="inline-action" href="/playlists">
                  Ver playlist
                </a>
                <a className="inline-action is-quiet" href="/player" target="_blank">
                  Abrir player
                </a>
              </div>
            ) : null}
          </article>
          <article>
            <p className="eyebrow">Controle rapido</p>
            <strong>{defaultPlaylistName ?? 'Nenhuma playlist selecionada'}</strong>
            <label className="overview-playlist-picker">
              <span>Playlist para tocar agora</span>
              <select
                value={selectedPlaylistId}
                onChange={(event) => setSelectedPlaylistId(event.target.value)}
              >
                <option value="">Selecione uma playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist._count?.items ?? 0} itens)
                  </option>
                ))}
              </select>
            </label>
            <div className="overview-actions">
              <button
                className="primary-button compact-action"
                type="button"
                disabled={!selectedPlaylistId}
                onClick={() => void playSelectedPlaylist()}
              >
                Tocar selecionada
              </button>
              <a className="inline-action is-quiet" href="/playlists">
                Editar playlists
              </a>
            </div>
          </article>
        </section>

        <section className="overview-playlist-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Sequencia da TV</p>
              <h2>{currentPlayback?.playlist?.name ?? 'Sem playlist ativa'}</h2>
            </div>
            <span>{currentPlaylistItems.length} itens</span>
          </div>
          <div className="overview-sequence-list">
            {currentPlaylistItems.length === 0 ? (
              <p className="muted">Ative uma playlist para ver o que vai aparecer na TV.</p>
            ) : null}
            {currentPlaylistItems.map((item, index) => (
              <article className="overview-sequence-row" key={item.id}>
                <span className="sequence-order">{index + 1}</span>
                <div className="sequence-thumb">
                  {item.media.mimetype.startsWith('image/') ? (
                    <img alt="" src={getMediaUrl(apiBaseUrl, item.media.url)} />
                  ) : (
                    <video
                      muted
                      playsInline
                      preload="metadata"
                      src={getVideoPreviewUrl(apiBaseUrl, item.media.url)}
                    />
                  )}
                </div>
                <div>
                  <strong>{item.media.filename}</strong>
                  <span>{item.media.mimetype}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

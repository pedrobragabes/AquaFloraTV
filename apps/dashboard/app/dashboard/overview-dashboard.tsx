'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type MediaResponse = { pagination: { total: number } };
type PlaylistResponse = {
  data: Array<{ id: string; name: string }>;
  defaultPlaylistId: string | null;
};
type ScheduleResponse = { data: Array<{ id: string; active: boolean }> };
type DeviceResponse = { data: Array<{ id: string; lastSeenAt: string | null }> };
type CurrentPlayback = {
  activeSchedule: { id: string; name: string } | null;
  playlist: { id: string; name: string; itemCount: number } | null;
};

const fallbackApiUrl = 'http://localhost:3001';
const onlineThresholdMs = 90_000;

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return fallbackApiUrl;
}

function isOnline(lastSeenAt: string | null): boolean {
  return lastSeenAt !== null && Date.now() - new Date(lastSeenAt).getTime() <= onlineThresholdMs;
}

export function OverviewDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [mediaCount, setMediaCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [defaultPlaylistName, setDefaultPlaylistName] = useState<string | null>(null);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [activeScheduleCount, setActiveScheduleCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [onlineDeviceCount, setOnlineDeviceCount] = useState(0);
  const [currentPlayback, setCurrentPlayback] = useState<CurrentPlayback | null>(null);
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

      setMediaCount(media.pagination.total);
      setPlaylistCount(playlists.data.length);
      setDefaultPlaylistName(
        playlists.data.find((playlist) => playlist.id === playlists.defaultPlaylistId)?.name ??
          null,
      );
      setScheduleCount(schedules.data.length);
      setActiveScheduleCount(schedules.data.filter((schedule) => schedule.active).length);
      setDeviceCount(devices.data.length);
      setOnlineDeviceCount(devices.data.filter((device) => isOnline(device.lastSeenAt)).length);
      setCurrentPlayback(current);
    } catch (overviewError) {
      const message =
        overviewError instanceof Error ? overviewError.message : 'Falha ao carregar dashboard';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

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
          <button className="secondary-button" type="button" onClick={() => void loadOverview()}>
            Atualizar
          </button>
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
          <article>
            <p className="eyebrow">Tocando agora</p>
            <strong>{currentPlayback?.playlist?.name ?? 'Nenhuma playlist ativa'}</strong>
            <span>
              {currentPlayback?.activeSchedule
                ? `via ${currentPlayback.activeSchedule.name}`
                : 'fallback/default'}
            </span>
          </article>
          <article>
            <p className="eyebrow">Playlist padrao</p>
            <strong>{defaultPlaylistName ?? 'Nao definida'}</strong>
            <span>usada quando nenhuma regra de agenda vence</span>
          </article>
        </section>
      </section>
    </main>
  );
}

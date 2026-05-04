'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveApiBaseUrl } from '../../../lib/api-base';

type DeviceHeartbeat = {
  id: string;
  timestamp: string;
  freeDiskMb: number | null;
  uptimeSeconds: number | null;
  appVersion: string | null;
  currentMediaId: string | null;
  networkType: string | null;
};

type DeviceLog = {
  id: string;
  timestamp: string;
  level: string;
  event: string;
  message: string | null;
  payload: string | null;
};

type DeviceDetail = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  appVersion: string | null;
  deviceModel: string | null;
  androidVersion: string | null;
  freeDiskMb: number | null;
  totalDiskMb: number | null;
  uptimeSeconds: number | null;
  currentMediaId: string | null;
  networkType: string | null;
  ipAddress: string | null;
  heartbeats: DeviceHeartbeat[];
  logs: DeviceLog[];
};

function formatDate(value: string | null): string {
  if (!value) {
    return 'Nunca';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) {
    return '-';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function formatDisk(freeDiskMb: number | null, totalDiskMb: number | null): string {
  if (freeDiskMb === null && totalDiskMb === null) {
    return '-';
  }

  if (freeDiskMb !== null && totalDiskMb !== null) {
    const usagePct = Math.round(((totalDiskMb - freeDiskMb) / totalDiskMb) * 100);
    return `${freeDiskMb} MB livres de ${totalDiskMb} MB (${usagePct}%)`;
  }

  return `${freeDiskMb ?? totalDiskMb} MB`;
}

export function DeviceDetailDashboard({ deviceId }: { deviceId: string }) {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevice = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/devices/${deviceId}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Device respondeu ${response.status}`);
      }

      setDevice((await response.json()) as DeviceDetail);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar device';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, deviceId]);

  useEffect(() => {
    void loadDevice();
  }, [loadDevice]);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="brand-mark">
          <span>AquaTV</span>
          <small>Loja local</small>
        </div>
        <nav className="nav-list">
          <a href="/dashboard">Resumo</a>
          <a href="/media">Midias</a>
          <a href="/playlists">Playlists</a>
          <a aria-current="page" href="/devices">
            TV Box
          </a>
          <a href="/releases">APKs</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Device</p>
            <h1>{device?.name ?? 'TV Box'}</h1>
          </div>
          <div className="header-actions">
            <a className="secondary-button button-link" href="/devices">
              Voltar
            </a>
            <button className="secondary-button" type="button" onClick={() => void loadDevice()}>
              Atualizar
            </button>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}
        {isLoading ? <p className="muted">Carregando device...</p> : null}

        {device ? (
          <>
            <dl className="device-facts">
              <div>
                <dt>Ultimo heartbeat</dt>
                <dd>{formatDate(device.lastSeenAt)}</dd>
              </div>
              <div>
                <dt>Versao</dt>
                <dd>{device.appVersion ?? '-'}</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{formatUptime(device.uptimeSeconds)}</dd>
              </div>
              <div>
                <dt>Disco</dt>
                <dd>{formatDisk(device.freeDiskMb, device.totalDiskMb)}</dd>
              </div>
              <div>
                <dt>Rede</dt>
                <dd>{device.networkType ?? '-'}</dd>
              </div>
              <div>
                <dt>Midia atual</dt>
                <dd>{device.currentMediaId ?? '-'}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{device.deviceModel ?? '-'}</dd>
              </div>
              <div>
                <dt>IP</dt>
                <dd>{device.ipAddress ?? '-'}</dd>
              </div>
            </dl>

            <section className="detail-grid">
              <div className="detail-panel">
                <p className="eyebrow">Heartbeats recentes</p>
                {device.heartbeats.length === 0 ? (
                  <p className="muted">Nenhum heartbeat registrado.</p>
                ) : (
                  <div className="event-list">
                    {device.heartbeats.map((heartbeat) => (
                      <article className="event-row" key={heartbeat.id}>
                        <strong>{formatDate(heartbeat.timestamp)}</strong>
                        <span>
                          {formatUptime(heartbeat.uptimeSeconds)} ·{' '}
                          {heartbeat.networkType ?? 'rede n/d'} ·{' '}
                          {heartbeat.currentMediaId ?? 'sem midia'}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-panel">
                <p className="eyebrow">Logs recentes</p>
                {device.logs.length === 0 ? (
                  <p className="muted">Nenhum log registrado.</p>
                ) : (
                  <div className="event-list">
                    {device.logs.map((log) => (
                      <article className="event-row" key={log.id}>
                        <strong>
                          {log.level} · {log.event}
                        </strong>
                        <span>{formatDate(log.timestamp)}</span>
                        {log.message ? <span>{log.message}</span> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

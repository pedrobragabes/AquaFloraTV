'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Device = {
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
  currentPlaylistId: string | null;
  networkType: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeviceListResponse = {
  data: Device[];
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

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}

function formatDisk(freeDiskMb: number | null, totalDiskMb: number | null): string {
  if (freeDiskMb === null && totalDiskMb === null) {
    return '-';
  }

  if (freeDiskMb !== null && totalDiskMb !== null) {
    return `${freeDiskMb} MB livres de ${totalDiskMb} MB`;
  }

  return `${freeDiskMb ?? totalDiskMb} MB`;
}

function getDiskUsagePct(device: Device): number | null {
  if (device.freeDiskMb === null || device.totalDiskMb === null || device.totalDiskMb <= 0) {
    return null;
  }

  return Math.round(((device.totalDiskMb - device.freeDiskMb) / device.totalDiskMb) * 100);
}

function getDiskAlertClass(usagePct: number | null): string {
  if (usagePct === null) {
    return '';
  }

  if (usagePct >= 85) {
    return ' is-critical';
  }

  if (usagePct >= 70) {
    return ' is-warning';
  }

  return '';
}

function isDeviceOnline(device: Device): boolean {
  if (!device.lastSeenAt) {
    return false;
  }

  return Date.now() - new Date(device.lastSeenAt).getTime() <= onlineThresholdMs;
}

export function DevicesDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const onlineCount = useMemo(
    () => devices.filter((device) => isDeviceOnline(device)).length,
    [devices],
  );

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/devices`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Devices responderam ${response.status}`);
      }

      const payload = (await response.json()) as DeviceListResponse;
      setDevices(payload.data);
      setUpdatedAt(new Date());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar devices';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadDevices();
    const timer = window.setInterval(() => {
      void loadDevices();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [loadDevices]);

  async function forceSync(deviceId: string): Promise<void> {
    setIsSyncingId(deviceId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/devices/${deviceId}/force-sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Force sync falhou (${response.status})`);
      }

      const payload = (await response.json()) as { listeners: number };
      setNotice(`Sync enviado. Conexoes SSE ativas: ${payload.listeners}.`);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Falha ao forcar sync';
      setError(message);
    } finally {
      setIsSyncingId(null);
    }
  }

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
          <a href="/schedule">Agenda</a>
          <a aria-current="page" href="/devices">
            TV Box
          </a>
          <a href="/releases">APKs</a>
          <a href="/api/auth/logout">Sair</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Monitoramento</p>
            <h1>TV Box</h1>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadDevices()}>
            Atualizar
          </button>
        </header>

        <section className="metrics-grid" aria-label="Resumo dos devices">
          <div>
            <strong>{devices.length}</strong>
            <span>devices</span>
          </div>
          <div>
            <strong>{onlineCount}</strong>
            <span>online</span>
          </div>
          <div>
            <strong>{devices.length - onlineCount}</strong>
            <span>offline</span>
          </div>
          <div>
            <strong>{updatedAt ? formatDate(updatedAt.toISOString()) : '...'}</strong>
            <span>ultima leitura</span>
          </div>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}
        {notice ? <p className="success-banner">{notice}</p> : null}

        <section className="devices-grid" aria-busy={isLoading}>
          {isLoading ? <p className="muted">Carregando devices...</p> : null}

          {!isLoading && devices.length === 0 ? (
            <p className="muted">
              Nenhum player registrado ainda. Abra /player para registrar um device.
            </p>
          ) : null}

          {devices.map((device) => {
            const online = isDeviceOnline(device);
            const diskUsagePct = getDiskUsagePct(device);

            return (
              <article className="device-card" key={device.id}>
                <div className="device-card-header">
                  <div>
                    <span className={online ? 'status-pill is-online' : 'status-pill'}>
                      {online ? 'Online' : 'Offline'}
                    </span>
                    <h2>{device.name}</h2>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSyncingId === device.id}
                    onClick={() => void forceSync(device.id)}
                  >
                    {isSyncingId === device.id ? 'Enviando...' : 'Forcar sync'}
                  </button>
                  <a className="secondary-button button-link" href={`/devices/${device.id}`}>
                    Detalhes
                  </a>
                </div>

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
                    <dt>Rede</dt>
                    <dd>{device.networkType ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>Disco</dt>
                    <dd className={`disk-value${getDiskAlertClass(diskUsagePct)}`}>
                      {formatDisk(device.freeDiskMb, device.totalDiskMb)}
                      {diskUsagePct !== null ? ` (${diskUsagePct}%)` : ''}
                    </dd>
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
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

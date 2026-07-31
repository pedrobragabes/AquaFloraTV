'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DashboardShell } from '../../components/dashboard-shell';
import { PageHeader } from '../../components/page-header';

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
};

function resolveApiBaseUrl(): string {
  return '/api/proxy';
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
  const router = useRouter();
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
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
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar TV';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, deviceId]);

  useEffect(() => {
    void loadDevice();
  }, [loadDevice]);

  const deleteDevice = useCallback(async () => {
    if (
      !device ||
      !window.confirm(
        `Remover o cadastro de "${device.name}"? Se esta TV ainda estiver em uso, será necessário reconectá-la pelo menu local do player.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/devices/${device.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Remoção falhou (${response.status})`);
      }

      router.push('/devices');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao remover TV');
      setIsDeleting(false);
    }
  }, [apiBaseUrl, device, router]);

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Detalhes da TV"
        title={device?.name ?? 'TV da loja'}
        description="Informações técnicas e atividade recente desta tela."
        actions={
          <>
            <Link className="secondary-button button-link" href="/devices">
              Voltar
            </Link>
            <button className="secondary-button" type="button" onClick={() => void loadDevice()}>
              Atualizar
            </button>
            <button
              className="danger-button"
              disabled={isDeleting}
              type="button"
              onClick={() => void deleteDevice()}
            >
              {isDeleting ? 'Removendo...' : 'Remover cadastro'}
            </button>
          </>
        }
      />

      {error ? <p className="error-banner">{error}</p> : null}
      {isLoading ? <p className="muted">Carregando TV...</p> : null}

      {device ? (
        <>
          <dl className="device-facts">
            <div>
              <dt>Último sinal</dt>
              <dd>{formatDate(device.lastSeenAt)}</dd>
            </div>
            <div>
              <dt>Versão do app</dt>
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
              <dt>Mídia atual</dt>
              <dd>{device.currentMediaId ?? '-'}</dd>
            </div>
            <div>
              <dt>Modelo</dt>
              <dd>{device.deviceModel ?? '-'}</dd>
            </div>
            <div>
              <dt>Android</dt>
              <dd>{device.androidVersion ?? '-'}</dd>
            </div>
            <div>
              <dt>IP</dt>
              <dd>{device.ipAddress ?? '-'}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </DashboardShell>
  );
}

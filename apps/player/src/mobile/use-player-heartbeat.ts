import { useEffect, useRef } from 'react';
import * as Application from 'expo-application';
import * as Network from 'expo-network';

import type { CurrentPlaylistItem } from '@aquatv/types';

import { sendPlayerHeartbeat } from '../player-api';
import type { DeviceCredentials } from '../types';
import { getDiskStatsMb } from './media-cache';
import type { PlayerSettings } from './settings-store';

const heartbeatIntervalMs = 30_000;
const startedAt = Date.now();

function credentialsFromSettings(settings: PlayerSettings): DeviceCredentials {
  return { id: settings.deviceId, token: settings.deviceToken };
}

export function usePlayerHeartbeat(
  settings: PlayerSettings | null,
  currentItem: CurrentPlaylistItem | null,
): void {
  const currentItemRef = useRef<CurrentPlaylistItem | null>(currentItem);
  currentItemRef.current = currentItem;

  useEffect(() => {
    if (!settings) {
      return undefined;
    }

    const activeSettings = settings;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function send(): Promise<void> {
      if (cancelled) {
        return;
      }

      try {
        const [networkState, diskStats] = await Promise.all([
          Network.getNetworkStateAsync(),
          getDiskStatsMb(),
        ]);
        await sendPlayerHeartbeat(activeSettings.apiUrl, credentialsFromSettings(activeSettings), {
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          ...diskStats,
          appVersion: Application.nativeApplicationVersion ?? '0.1.0',
          currentMediaId: currentItemRef.current?.media.id ?? null,
          networkType: networkState.type ?? 'unknown',
        });
      } catch {
        // O heartbeat e observacional e nunca deve interromper o playback.
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => void send(), heartbeatIntervalMs);
        }
      }
    }

    void send();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [settings]);
}

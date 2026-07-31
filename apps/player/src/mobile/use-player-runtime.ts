import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';

import type { CurrentPlaylistItem, CurrentPlaylistResponse } from '@aquatv/types';

import { normalizeApiUrl } from '../api-url';
import { checkPlayerHealth, getPlayerPlaylist, registerPlayerDevice } from '../player-api';
import type { DeviceCredentials, PlayerManifest } from '../types';
import {
  getCachedMediaUris,
  loadPlayerManifest,
  synchronizeNoPlaybackState,
  synchronizePlaylistCache,
  type CacheProgress,
} from './media-cache';
import {
  clearPlayerSettings,
  loadPlayerSettings,
  savePlayerSettings,
  type PlayerSettings,
} from './settings-store';
import { usePlayerHeartbeat } from './use-player-heartbeat';
import { useSyncSchedule } from './use-sync-schedule';

export type PlayerPhase =
  | 'booting'
  | 'setup'
  | 'connecting'
  | 'syncing'
  | 'ready'
  | 'empty'
  | 'offline';

interface SyncOperation {
  session: number;
  promise: Promise<void>;
}

export interface PlayerRuntime {
  settings: PlayerSettings | null;
  setupApiUrl: string;
  phase: PlayerPhase;
  message: string;
  playlist: CurrentPlaylistResponse | null;
  currentItem: CurrentPlaylistItem | null;
  currentMediaUri: string | null;
  playbackKey: string;
  lastSyncAt: Date | null;
  cacheProgress: CacheProgress;
  lastPlaybackError: string | null;
  adminVisible: boolean;
  connect: (apiUrl: string) => Promise<void>;
  resetConnection: () => Promise<void>;
  syncNow: () => Promise<void>;
  advance: () => void;
  handlePlaybackError: (message: string) => void;
  openAdmin: () => void;
  closeAdmin: () => void;
}

const emptyCacheProgress: CacheProgress = { done: 0, total: 0, currentName: null };

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function credentialsFromSettings(settings: PlayerSettings): DeviceCredentials {
  return { id: settings.deviceId, token: settings.deviceToken };
}

export function usePlayerRuntime(initialApiUrl: string): PlayerRuntime {
  const [settings, setSettings] = useState<PlayerSettings | null>(null);
  const [setupApiUrl, setSetupApiUrl] = useState(initialApiUrl);
  const [phase, setPhase] = useState<PlayerPhase>('booting');
  const [message, setMessage] = useState('Inicializando player');
  const [playlist, setPlaylist] = useState<CurrentPlaylistResponse | null>(null);
  const [cachedMediaUris, setCachedMediaUris] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSequence, setPlaybackSequence] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress>(emptyCacheProgress);
  const [lastPlaybackError, setLastPlaybackError] = useState<string | null>(null);
  const [adminVisible, setAdminVisible] = useState(false);

  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const settingsRef = useRef<PlayerSettings | null>(null);
  const playlistHashRef = useRef<string | null>(null);
  const playlistLengthRef = useRef(0);
  const noPlaybackRef = useRef(false);
  const syncOperationRef = useRef<SyncOperation | null>(null);
  const syncFailureCountRef = useRef(0);

  const currentItem = playlist?.items[currentIndex] ?? null;
  const currentMediaUri = currentItem ? (cachedMediaUris[currentItem.media.id] ?? null) : null;
  playlistLengthRef.current = playlist?.items.length ?? 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyManifest = useCallback((manifest: PlayerManifest, statusMessage: string): void => {
    if (!mountedRef.current || !manifest.activePlaylist) {
      return;
    }

    const nextPlaylist = manifest.activePlaylist;
    noPlaybackRef.current = nextPlaylist.items.length === 0;
    if (playlistHashRef.current !== nextPlaylist.playlist.hash) {
      setCurrentIndex(0);
      setPlaybackSequence((value) => value + 1);
    }

    playlistHashRef.current = nextPlaylist.playlist.hash;
    playlistLengthRef.current = nextPlaylist.items.length;
    setPlaylist(nextPlaylist);
    setCachedMediaUris(getCachedMediaUris(manifest));
    setLastSyncAt(manifest.lastSyncAt ? new Date(manifest.lastSyncAt) : null);
    setPhase(nextPlaylist.items.length > 0 ? 'ready' : 'empty');
    setMessage(nextPlaylist.items.length > 0 ? statusMessage : 'Playlist sem midias');
  }, []);

  const showNoPlayback = useCallback((): void => {
    noPlaybackRef.current = true;
    playlistHashRef.current = null;
    playlistLengthRef.current = 0;
    setPlaylist(null);
    setCachedMediaUris({});
    setCurrentIndex(0);
    setPlaybackSequence((value) => value + 1);
    setLastPlaybackError(null);
    setLastSyncAt(new Date());
    setCacheProgress(emptyCacheProgress);
    setPhase('empty');
    setMessage('TV pausada/sem programação');
    syncFailureCountRef.current = 0;
  }, []);

  const handleSyncFailure = useCallback((session: number, error: unknown): void => {
    if (!mountedRef.current || session !== sessionRef.current) {
      return;
    }

    syncFailureCountRef.current += 1;
    const errorMessage = getErrorMessage(error, 'Falha ao sincronizar');
    const hasCachedPlayback = playlistLengthRef.current > 0;
    if (hasCachedPlayback) {
      setMessage('Sem conexao - usando cache local');
      setPhase('ready');
    } else if (noPlaybackRef.current) {
      setMessage('TV pausada/sem programação - sem conexão');
      setPhase('empty');
    } else {
      setMessage(errorMessage);
      setPhase('offline');
    }
  }, []);

  const performSync = useCallback(
    async (activeSettings: PlayerSettings, session: number): Promise<void> => {
      if (session !== sessionRef.current) {
        return;
      }

      if (!playlistHashRef.current && !noPlaybackRef.current) {
        setPhase('syncing');
        setMessage('Sincronizando playlist');
      }
      setCacheProgress(emptyCacheProgress);

      const nextPlaylist = await getPlayerPlaylist(
        activeSettings.apiUrl,
        credentialsFromSettings(activeSettings),
      );
      if (session !== sessionRef.current) {
        return;
      }
      if (!nextPlaylist) {
        showNoPlayback();
        await synchronizeNoPlaybackState(activeSettings.apiUrl);
        if (session !== sessionRef.current) {
          return;
        }
        return;
      }

      const manifest = await synchronizePlaylistCache(
        activeSettings.apiUrl,
        nextPlaylist,
        (progress) => {
          if (mountedRef.current && session === sessionRef.current) {
            setCacheProgress(progress);
          }
        },
      );
      if (session !== sessionRef.current) {
        return;
      }

      applyManifest(manifest, `${nextPlaylist.playlist.name} - cache local`);
      setLastSyncAt(new Date());
      setCacheProgress(emptyCacheProgress);
      syncFailureCountRef.current = 0;
    },
    [applyManifest, showNoPlayback],
  );

  const runSync = useCallback(
    async (overrideSettings?: PlayerSettings): Promise<void> => {
      const activeSettings = overrideSettings ?? settingsRef.current;
      if (!activeSettings) {
        return;
      }

      const session = sessionRef.current;
      const existing = syncOperationRef.current;
      if (existing) {
        if (existing.session === session) {
          return existing.promise;
        }
        await existing.promise.catch(() => undefined);
      }
      if (session !== sessionRef.current) {
        return;
      }

      const promise = performSync(activeSettings, session)
        .catch((error: unknown) => {
          handleSyncFailure(session, error);
          throw error;
        })
        .finally(() => {
          if (syncOperationRef.current?.promise === promise) {
            syncOperationRef.current = null;
          }
        });

      syncOperationRef.current = { session, promise };
      return promise;
    },
    [handleSyncFailure, performSync],
  );

  useEffect(() => {
    const session = ++sessionRef.current;
    let cancelled = false;

    async function boot(): Promise<void> {
      const storedSettings = await loadPlayerSettings();
      if (cancelled || session !== sessionRef.current) {
        return;
      }

      if (!storedSettings) {
        setPhase('setup');
        setMessage('Informe o endereco do PC da loja');
        return;
      }

      settingsRef.current = storedSettings;
      setSettings(storedSettings);
      setSetupApiUrl(storedSettings.apiUrl);

      try {
        const manifest = await loadPlayerManifest(storedSettings.apiUrl);
        if (manifest.activePlaylist && !cancelled && session === sessionRef.current) {
          applyManifest(manifest, 'Cache local carregado');
        } else if (manifest.lastSyncAt && !cancelled && session === sessionRef.current) {
          showNoPlayback();
        }
      } catch (error) {
        if (!cancelled && session === sessionRef.current) {
          setMessage(getErrorMessage(error, 'Falha ao abrir cache local'));
        }
      }

      await runSync(storedSettings).catch(() => undefined);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyManifest, runSync, showNoPlayback]);

  useSyncSchedule(settings !== null, runSync, syncFailureCountRef);
  usePlayerHeartbeat(settings, currentItem);

  const connect = useCallback(
    async (rawApiUrl: string): Promise<void> => {
      const apiUrl = normalizeApiUrl(rawApiUrl);
      if (!apiUrl) {
        setPhase('setup');
        setMessage('Informe uma URL valida, como 192.168.1.10:7741');
        return;
      }

      const session = ++sessionRef.current;
      let registered = false;
      setSetupApiUrl(apiUrl);
      setPhase('connecting');
      setMessage('Conectando ao PC da loja');

      try {
        await checkPlayerHealth(apiUrl);
        if (session !== sessionRef.current) {
          return;
        }

        const deviceName = Device.deviceName ?? 'AquaTV Player';
        const credentials = await registerPlayerDevice({
          apiUrl,
          deviceName,
          deviceModel: Device.modelName ?? 'Android TV',
          ...(Device.osVersion ? { androidVersion: Device.osVersion } : {}),
        });
        if (session !== sessionRef.current) {
          return;
        }

        const nextSettings: PlayerSettings = {
          apiUrl,
          deviceId: credentials.id,
          deviceToken: credentials.token,
          deviceName,
        };
        await savePlayerSettings(nextSettings);
        registered = true;
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
        syncFailureCountRef.current = 0;
        await runSync(nextSettings);
      } catch (error) {
        if (session !== sessionRef.current || registered) {
          return;
        }
        setPhase('setup');
        setMessage(getErrorMessage(error, 'Nao foi possivel conectar'));
      }
    },
    [runSync],
  );

  const resetConnection = useCallback(async (): Promise<void> => {
    const previousApiUrl = settingsRef.current?.apiUrl ?? setupApiUrl;
    try {
      await clearPlayerSettings();
    } catch (error) {
      setMessage(getErrorMessage(error, 'Nao foi possivel limpar a conexao salva'));
      return;
    }
    ++sessionRef.current;
    settingsRef.current = null;
    playlistHashRef.current = null;
    noPlaybackRef.current = false;
    syncFailureCountRef.current = 0;
    setSettings(null);
    setSetupApiUrl(previousApiUrl);
    setPlaylist(null);
    setCachedMediaUris({});
    setCurrentIndex(0);
    setPlaybackSequence((value) => value + 1);
    setLastSyncAt(null);
    setLastPlaybackError(null);
    setAdminVisible(false);
    setPhase('setup');
    setMessage('Revise o endereco e conecte novamente');
  }, [setupApiUrl]);

  const advance = useCallback((): void => {
    const itemCount = playlistLengthRef.current;
    setCurrentIndex((index) => (itemCount === 0 ? 0 : (index + 1) % itemCount));
    setPlaybackSequence((value) => value + 1);
  }, []);

  const handlePlaybackError = useCallback(
    (errorMessage: string): void => {
      setLastPlaybackError(errorMessage);
      advance();
    },
    [advance],
  );

  const syncNow = useCallback((): Promise<void> => runSync(), [runSync]);
  const openAdmin = useCallback((): void => setAdminVisible(true), []);
  const closeAdmin = useCallback((): void => setAdminVisible(false), []);

  return {
    settings,
    setupApiUrl,
    phase,
    message,
    playlist,
    currentItem,
    currentMediaUri,
    playbackKey: `${currentItem?.id ?? 'empty'}:${playbackSequence}`,
    lastSyncAt,
    cacheProgress,
    lastPlaybackError,
    adminVisible,
    connect,
    resetConnection,
    syncNow,
    advance,
    handlePlaybackError,
    openAdmin,
    closeAdmin,
  };
}

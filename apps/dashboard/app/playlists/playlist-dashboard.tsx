'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DashboardShell } from '../components/dashboard-shell';
import { PageHeader } from '../components/page-header';

type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  sizeBytes: number;
  createdAt: string;
};

type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  _count: {
    items: number;
    schedules: number;
  };
};

type PlaylistItem = {
  id: string;
  order: number;
  durationOverrideMs: number | null;
  media: MediaItem;
};

type PlaylistDetail = {
  id: string;
  name: string;
  description: string | null;
  items: PlaylistItem[];
};

type PlaylistListResponse = {
  data: PlaylistSummary[];
  defaultPlaylistId: string | null;
  playbackEnabled: boolean;
};

type MediaListResponse = {
  data: MediaItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type DraftItem = {
  key: string;
  media: MediaItem;
  durationOverrideMs: number | null;
};

function resolveApiBaseUrl(): string {
  return '/api/proxy';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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

function normalizeDraftItems(detail: PlaylistDetail): DraftItem[] {
  return detail.items.map((item) => ({
    key: item.id,
    media: item.media,
    durationOverrideMs: item.durationOverrideMs,
  }));
}

function playlistItemsSignature(
  items: Array<{ media: { id: string }; durationOverrideMs: number | null }>,
): string {
  return JSON.stringify(
    items.map((item) => ({
      mediaId: item.media.id,
      durationOverrideMs: item.durationOverrideMs,
    })),
  );
}

export function PlaylistDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [defaultPlaylistId, setDefaultPlaylistId] = useState<string | null>(null);
  const [playbackEnabled, setPlaybackEnabled] = useState(true);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('Playlist da TV');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );
  const hasUnsavedChanges = useMemo(
    () =>
      selectedPlaylist !== null &&
      playlistItemsSignature(draftItems) !== playlistItemsSignature(selectedPlaylist.items),
    [draftItems, selectedPlaylist],
  );

  const loadPlaylists = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/playlists`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Playlists responderam ${response.status}`);
    }

    const payload = (await response.json()) as PlaylistListResponse;
    setPlaylists(payload.data);
    setDefaultPlaylistId(payload.defaultPlaylistId);
    setPlaybackEnabled(payload.playbackEnabled);

    setSelectedPlaylistId((current) => current ?? payload.data[0]?.id ?? null);
  }, [apiBaseUrl]);

  const loadMedia = useCallback(async () => {
    const loaded: MediaItem[] = [];
    let page = 1;
    let total = 0;

    do {
      const response = await fetch(`${apiBaseUrl}/api/media?page=${page}&pageSize=100`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Mídias responderam ${response.status}`);
      }

      const payload = (await response.json()) as MediaListResponse;
      loaded.push(...payload.data);
      total = payload.pagination.total;
      page += 1;
      if (payload.data.length === 0) {
        break;
      }
    } while (loaded.length < total);

    setMedia(loaded);
  }, [apiBaseUrl]);

  const loadSelectedPlaylist = useCallback(async () => {
    if (!selectedPlaylistId) {
      setSelectedPlaylist(null);
      setDraftItems([]);
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/playlists/${selectedPlaylistId}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Playlist respondeu ${response.status}`);
    }

    const payload = (await response.json()) as PlaylistDetail;
    setSelectedPlaylist(payload);
    setDraftItems(normalizeDraftItems(payload));
  }, [apiBaseUrl, selectedPlaylistId]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([loadPlaylists(), loadMedia()]);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Falha ao carregar dados';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [loadMedia, loadPlaylists]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadSelectedPlaylist().catch((loadError: unknown) => {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar playlist';
      setError(message);
    });
  }, [loadSelectedPlaylist]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    const guardNavigation = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target || window.confirm('Descartar as alterações não salvas desta playlist?')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [hasUnsavedChanges]);

  function confirmDiscardChanges(): boolean {
    return (
      !hasUnsavedChanges || window.confirm('Descartar as alterações não salvas desta playlist?')
    );
  }

  function selectPlaylist(playlistId: string): void {
    if (playlistId !== selectedPlaylistId && confirmDiscardChanges()) {
      setSelectedPlaylistId(playlistId);
      setNotice(null);
    }
  }

  async function createPlaylist(): Promise<void> {
    const name = newPlaylistName.trim();
    if (!name) {
      setError('Informe um nome para a playlist.');
      return;
    }
    if (!confirmDiscardChanges()) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Criação falhou (${response.status})`);
      }

      const created = (await response.json()) as PlaylistSummary;
      setSelectedPlaylistId(created.id);
      setNewPlaylistName('Playlist da TV');
      await loadPlaylists();
      setNotice('Playlist criada.');
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Falha ao criar playlist';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  function addMediaToDraft(mediaItem: MediaItem): void {
    const randomId = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now());
    setDraftItems((current) => [
      ...current,
      {
        key: `${mediaItem.id}-${randomId}`,
        media: mediaItem,
        durationOverrideMs: null,
      },
    ]);
    setNotice(null);
  }

  function moveDraftItem(index: number, direction: -1 | 1): void {
    setDraftItems((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const item = next[index];
      const target = next[targetIndex];
      if (!item || !target) {
        return current;
      }

      next[index] = target;
      next[targetIndex] = item;
      return next;
    });
  }

  function removeDraftItem(key: string): void {
    setDraftItems((current) => current.filter((item) => item.key !== key));
  }

  function duplicateDraftItem(item: DraftItem): void {
    const randomId = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now());
    setDraftItems((current) => {
      const itemIndex = current.findIndex((draftItem) => draftItem.key === item.key);
      const duplicated = {
        ...item,
        key: `${item.media.id}-copy-${randomId}`,
      };

      if (itemIndex < 0) {
        return [...current, duplicated];
      }

      return [...current.slice(0, itemIndex + 1), duplicated, ...current.slice(itemIndex + 1)];
    });
  }

  function updateDraftDuration(key: string, seconds: string): void {
    const parsedSeconds = Number(seconds);
    const durationOverrideMs =
      seconds.trim().length === 0 || !Number.isFinite(parsedSeconds)
        ? null
        : Math.min(86_400, Math.max(1, Math.round(parsedSeconds))) * 1000;

    setDraftItems((current) =>
      current.map((item) => (item.key === key ? { ...item, durationOverrideMs } : item)),
    );
  }

  async function deleteSelectedPlaylist(): Promise<void> {
    if (!selectedPlaylist) {
      return;
    }
    if (!window.confirm(`Excluir a playlist "${selectedPlaylist.name}"?`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists/${selectedPlaylist.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Exclusão falhou (${response.status})`);
      }

      setSelectedPlaylist(null);
      setSelectedPlaylistId(null);
      setDraftItems([]);
      await loadPlaylists();
      setNotice('Playlist removida.');
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Falha ao remover playlist';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function savePlaylist(): Promise<void> {
    await savePlaylistToServer();
  }

  async function savePlaylistToServer(): Promise<PlaylistDetail | null> {
    if (!selectedPlaylist) {
      setError('Selecione uma playlist antes de salvar.');
      return null;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists/${selectedPlaylist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: draftItems.map((item, index) => ({
            mediaId: item.media.id,
            order: index,
            durationOverrideMs: item.durationOverrideMs,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Salvar falhou (${response.status})`);
      }

      const updated = (await response.json()) as PlaylistDetail;
      setSelectedPlaylist(updated);
      setDraftItems(normalizeDraftItems(updated));
      await loadPlaylists();
      setNotice('Playlist salva.');
      return updated;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Falha ao salvar playlist';
      setError(message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function playSelectedPlaylist(): Promise<void> {
    if (!selectedPlaylist) {
      return;
    }

    const savedPlaylist = await savePlaylistToServer();
    if (!savedPlaylist) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: savedPlaylist.id }),
      });

      if (!response.ok) {
        throw new Error(`Ativar falhou (${response.status})`);
      }

      setDefaultPlaylistId(savedPlaylist.id);
      setPlaybackEnabled(true);
      setNotice('Playlist salva e definida como padrão. Horários ativos continuam com prioridade.');
    } catch (defaultError) {
      const message =
        defaultError instanceof Error ? defaultError.message : 'Falha ao ativar playlist';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function stopPlayback(): Promise<void> {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: null }),
      });

      if (!response.ok) {
        throw new Error(`Parar falhou (${response.status})`);
      }

      setPlaybackEnabled(false);
      setNotice('TV pausada. A playlist padrão foi preservada para retomar depois.');
    } catch (stopError) {
      const message = stopError instanceof Error ? stopError.message : 'Falha ao parar TV';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Exibição da loja"
        title="Programação"
        description="Organize a sequência de conteúdos e escolha o que a TV deve exibir."
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => void refreshAll()}>
              Atualizar
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving || !selectedPlaylist}
              onClick={() => void savePlaylist()}
            >
              Salvar edição
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={isSaving || !selectedPlaylist || draftItems.length === 0}
              onClick={() => void playSelectedPlaylist()}
            >
              {isSaving ? 'Aplicando...' : 'Salvar e definir padrão'}
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isSaving || !playbackEnabled}
              onClick={() => void stopPlayback()}
            >
              Parar TV
            </button>
          </>
        }
      />

      {error ? <p className="error-banner">{error}</p> : null}
      {notice ? <p className="success-banner">{notice}</p> : null}
      {hasUnsavedChanges ? (
        <p className="warning-banner" role="status">
          Alterações não salvas. Salve antes de trocar de playlist ou sair desta tela.
        </p>
      ) : null}

      <section className="playlist-layout" aria-busy={isLoading}>
        <aside className="playlist-list-panel">
          <div className="compact-form">
            <label htmlFor="playlist-name">Nova playlist</label>
            <div>
              <input
                id="playlist-name"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
              />
              <button type="button" onClick={() => void createPlaylist()} disabled={isSaving}>
                Criar
              </button>
            </div>
          </div>

          <Link className="schedule-shortcut" href="/schedule">
            <span>Horários automáticos</span>
            <small>Opcional · abrir agenda</small>
          </Link>

          <div className="playlist-list">
            {playlists.map((playlist) => (
              <button
                className={
                  playlist.id === selectedPlaylistId ? 'playlist-row is-selected' : 'playlist-row'
                }
                key={playlist.id}
                type="button"
                onClick={() => selectPlaylist(playlist.id)}
              >
                <strong>{playlist.name}</strong>
                <span>
                  {playlist._count.items} itens - {formatDate(playlist.updatedAt)}
                </span>
                {playlist.id === defaultPlaylistId ? (
                  <em>{playbackEnabled ? 'Padrão da TV' : 'Padrão salvo · TV pausada'}</em>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="playlist-editor-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Loop da TV</p>
              <h2>{selectedPlaylist?.name ?? selectedSummary?.name ?? 'Selecione uma playlist'}</h2>
            </div>
            <button
              className="primary-button compact-action"
              type="button"
              disabled={!selectedPlaylist || draftItems.length === 0 || isSaving}
              onClick={() => void playSelectedPlaylist()}
            >
              Definir padrão
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={!selectedPlaylist || isSaving}
              onClick={() => void deleteSelectedPlaylist()}
            >
              Excluir
            </button>
          </div>

          <div className="playlist-sequence">
            {draftItems.length === 0 ? (
              <p className="muted">Adicione mídias da biblioteca para montar o loop da TV.</p>
            ) : null}

            {draftItems.map((item, index) => (
              <article className="sequence-row" key={item.key}>
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
                <div className="sequence-copy">
                  <strong>{item.media.filename}</strong>
                  <span>{item.media.mimetype}</span>
                  {item.media.mimetype.startsWith('image/') ? (
                    <label className="duration-field">
                      <span>Segundos</span>
                      <input
                        inputMode="numeric"
                        max={86_400}
                        min={1}
                        type="number"
                        value={
                          item.durationOverrideMs ? Math.round(item.durationOverrideMs / 1000) : ''
                        }
                        onChange={(event) => updateDraftDuration(item.key, event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="sequence-actions">
                  <button
                    type="button"
                    onClick={() => moveDraftItem(index, -1)}
                    disabled={index === 0}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraftItem(index, 1)}
                    disabled={index === draftItems.length - 1}
                  >
                    Descer
                  </button>
                  <button type="button" onClick={() => duplicateDraftItem(item)}>
                    Duplicar
                  </button>
                  <button type="button" onClick={() => removeDraftItem(item.key)}>
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="library-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Biblioteca</p>
              <h2>Mídias</h2>
            </div>
          </div>

          <div className="library-list">
            {media.length === 0 ? <p className="muted">Envie mídias na tela Conteúdos.</p> : null}
            {media.map((item) => (
              <button
                className="library-row"
                key={item.id}
                type="button"
                onClick={() => addMediaToDraft(item)}
              >
                <div className="library-thumb">
                  {item.mimetype.startsWith('image/') ? (
                    <img alt="" src={getMediaUrl(apiBaseUrl, item.url)} />
                  ) : (
                    <video
                      muted
                      playsInline
                      preload="metadata"
                      src={getVideoPreviewUrl(apiBaseUrl, item.url)}
                    />
                  )}
                </div>
                <span>{item.filename}</span>
                <strong>Adicionar</strong>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </DashboardShell>
  );
}

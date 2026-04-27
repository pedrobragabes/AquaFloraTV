'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
};

type MediaListResponse = {
  data: MediaItem[];
};

type DraftItem = {
  key: string;
  media: MediaItem;
  durationOverrideMs: number | null;
};

const fallbackApiUrl = 'http://localhost:3001';

function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return fallbackApiUrl;
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

function normalizeDraftItems(detail: PlaylistDetail): DraftItem[] {
  return detail.items.map((item) => ({
    key: item.id,
    media: item.media,
    durationOverrideMs: item.durationOverrideMs,
  }));
}

export function PlaylistDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [defaultPlaylistId, setDefaultPlaylistId] = useState<string | null>(null);
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

  const loadPlaylists = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/playlists`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Playlists responderam ${response.status}`);
    }

    const payload = (await response.json()) as PlaylistListResponse;
    setPlaylists(payload.data);
    setDefaultPlaylistId(payload.defaultPlaylistId);

    if (!selectedPlaylistId && payload.data[0]) {
      setSelectedPlaylistId(payload.data[0].id);
    }
  }, [apiBaseUrl, selectedPlaylistId]);

  const loadMedia = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/media?pageSize=100`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Midias responderam ${response.status}`);
    }

    const payload = (await response.json()) as MediaListResponse;
    setMedia(payload.data);
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

  async function createPlaylist(): Promise<void> {
    const name = newPlaylistName.trim();
    if (!name) {
      setError('Informe um nome para a playlist.');
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
        throw new Error(`Criacao falhou (${response.status})`);
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

  async function savePlaylist(): Promise<void> {
    if (!selectedPlaylist) {
      setError('Selecione uma playlist antes de salvar.');
      return;
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
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Falha ao salvar playlist';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function setAsDefault(): Promise<void> {
    if (!selectedPlaylist) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/playlists/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: selectedPlaylist.id }),
      });

      if (!response.ok) {
        throw new Error(`Ativar falhou (${response.status})`);
      }

      setDefaultPlaylistId(selectedPlaylist.id);
      setNotice('Playlist definida como padrao da TV.');
    } catch (defaultError) {
      const message =
        defaultError instanceof Error ? defaultError.message : 'Falha ao ativar playlist';
      setError(message);
    } finally {
      setIsSaving(false);
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
          <a href="/media">Midias</a>
          <a aria-current="page" href="/playlists">
            Playlists
          </a>
          <span>Agenda</span>
          <a href="/devices">TV Box</a>
          <span>APKs</span>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Programacao</p>
            <h1>Playlists</h1>
          </div>
          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={() => void refreshAll()}>
              Atualizar
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={isSaving || !selectedPlaylist}
              onClick={() => void savePlaylist()}
            >
              {isSaving ? 'Salvando...' : 'Salvar ordem'}
            </button>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}
        {notice ? <p className="success-banner">{notice}</p> : null}

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

            <div className="playlist-list">
              {playlists.map((playlist) => (
                <button
                  className={
                    playlist.id === selectedPlaylistId ? 'playlist-row is-selected' : 'playlist-row'
                  }
                  key={playlist.id}
                  type="button"
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                >
                  <strong>{playlist.name}</strong>
                  <span>
                    {playlist._count.items} itens - {formatDate(playlist.updatedAt)}
                  </span>
                  {playlist.id === defaultPlaylistId ? <em>Padrao da TV</em> : null}
                </button>
              ))}
            </div>
          </aside>

          <section className="playlist-editor-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Loop da TV</p>
                <h2>
                  {selectedPlaylist?.name ?? selectedSummary?.name ?? 'Selecione uma playlist'}
                </h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={
                  !selectedPlaylist || selectedPlaylist.id === defaultPlaylistId || isSaving
                }
                onClick={() => void setAsDefault()}
              >
                Usar na TV
              </button>
            </div>

            <div className="playlist-sequence">
              {draftItems.length === 0 ? (
                <p className="muted">Adicione midias da biblioteca para montar o loop da TV.</p>
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
                        src={getMediaUrl(apiBaseUrl, item.media.url)}
                      />
                    )}
                  </div>
                  <div className="sequence-copy">
                    <strong>{item.media.filename}</strong>
                    <span>{item.media.mimetype}</span>
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
                <h2>Midias</h2>
              </div>
            </div>

            <div className="library-list">
              {media.length === 0 ? (
                <p className="muted">Envie midias na tela Biblioteca.</p>
              ) : null}
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
                        src={getMediaUrl(apiBaseUrl, item.url)}
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
      </section>
    </main>
  );
}

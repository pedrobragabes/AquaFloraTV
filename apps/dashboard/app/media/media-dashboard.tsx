'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type MediaItem = {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  sizeBytes: number;
  md5: string;
  createdAt: string;
};

type MediaListResponse = {
  data: MediaItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
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

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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

export function MediaDashboard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);

  const totalSize = useMemo(
    () => media.reduce((total, item) => total + item.sizeBytes, 0),
    [media],
  );

  const videoCount = useMemo(
    () => media.filter((item) => item.mimetype.startsWith('video/')).length,
    [media],
  );

  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/media?pageSize=60`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`API respondeu ${response.status}`);
      }

      const payload = (await response.json()) as MediaListResponse;
      setMedia(payload.data);
      setUpdatedAt(new Date());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar mídias';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  function handleFile(file: File | null): void {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Arquivo inválido. Use imagem ou vídeo.');
      return;
    }

    setSelectedFile(file);
    setError(null);
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      setError('Selecione um arquivo antes de enviar.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${apiBaseUrl}/api/media/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Upload falhou (${response.status})`);
      }

      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      await loadMedia();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Falha ao enviar mídia';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-mark">
          <span>AquaTV</span>
          <small>Loja local</small>
        </div>
        <nav className="nav-list">
          <a aria-current="page" href="/media">
            Mídias
          </a>
          <a href="/playlists">Playlists</a>
          <span>Agenda</span>
          <a href="/devices">TV Box</a>
          <span>APKs</span>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Biblioteca</p>
            <h1>Mídias da TV</h1>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadMedia()}>
            Atualizar
          </button>
        </header>

        <section className="metrics-grid" aria-label="Resumo da biblioteca">
          <div>
            <strong>{media.length}</strong>
            <span>arquivos</span>
          </div>
          <div>
            <strong>{videoCount}</strong>
            <span>vídeos</span>
          </div>
          <div>
            <strong>{formatBytes(totalSize)}</strong>
            <span>armazenados</span>
          </div>
          <div>
            <strong>{updatedAt ? formatDate(updatedAt.toISOString()) : '...'}</strong>
            <span>última leitura</span>
          </div>
        </section>

        <section className="upload-band">
          <div
            className={isDragging ? 'dropzone is-dragging' : 'dropzone'}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFile(event.dataTransfer.files.item(0));
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
            />
            <div>
              <strong>{selectedFile ? selectedFile.name : 'Adicionar mídia'}</strong>
              <span>
                {selectedFile
                  ? `${selectedFile.type || 'arquivo'} · ${formatBytes(selectedFile.size)}`
                  : 'Imagem ou vídeo para a playlist da TV'}
              </span>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={isUploading || !selectedFile}
            onClick={() => void handleUpload()}
          >
            {isUploading ? 'Enviando...' : 'Enviar'}
          </button>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}

        <section className="media-grid" aria-busy={isLoading}>
          {isLoading ? <p className="muted">Carregando biblioteca...</p> : null}

          {!isLoading && media.length === 0 ? (
            <p className="muted">Nenhuma mídia enviada ainda.</p>
          ) : null}

          {media.map((item) => (
            <article className="media-card" key={item.id}>
              <div className="media-preview">
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
              <div className="media-meta">
                <strong title={item.filename}>{item.filename}</strong>
                <span>{item.mimetype}</span>
                <span>
                  {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
                </span>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

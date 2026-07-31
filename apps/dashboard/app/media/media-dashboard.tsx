'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardShell } from '../components/dashboard-shell';
import { PageHeader } from '../components/page-header';

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

function resolveApiBaseUrl(): string {
  return '/api/proxy';
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

function getVideoPreviewUrl(apiBaseUrl: string, pathOrUrl: string): string {
  return `${getMediaUrl(apiBaseUrl, pathOrUrl)}#t=0.1`;
}

export function MediaDashboard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUploadedMedia, setLastUploadedMedia] = useState<MediaItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const selectedPreviewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  const totalSize = useMemo(
    () => media.reduce((total, item) => total + item.sizeBytes, 0),
    [media],
  );

  const videoCount = useMemo(
    () => media.filter((item) => item.mimetype.startsWith('video/')).length,
    [media],
  );

  const loadMedia = useCallback(
    async (page = 1, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/media?page=${page}&pageSize=60`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`API respondeu ${response.status}`);
        }

        const payload = (await response.json()) as MediaListResponse;
        setMedia((current) => (append ? [...current, ...payload.data] : payload.data));
        setTotalCount(payload.pagination.total);
        setCurrentPage(payload.pagination.page);
        setUpdatedAt(new Date());
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar mídias';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  function handleFile(file: File | null): void {
    if (!file) {
      return;
    }

    const allowedMimeTypes = new Set(['video/mp4', 'image/jpeg', 'image/png', 'image/webp']);
    const allowedExtensions = ['.mp4', '.jpg', '.jpeg', '.png', '.webp'];
    const normalizedName = file.name.toLowerCase();
    if (
      !allowedMimeTypes.has(file.type) &&
      !allowedExtensions.some((extension) => normalizedName.endsWith(extension))
    ) {
      setError('Formato não compatível. Use MP4, JPG, PNG ou WebP.');
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);
    setError(null);
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      setError('Selecione um arquivo antes de enviar.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploaded = await new Promise<MediaItem>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiBaseUrl}/api/media/upload`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText) as MediaItem);
            return;
          }

          try {
            const payload = JSON.parse(xhr.responseText) as { error?: { message?: string } };
            reject(new Error(payload.error?.message ?? `Upload falhou (${xhr.status})`));
          } catch {
            reject(new Error(`Upload falhou (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Falha de rede durante o upload'));
        xhr.send(formData);
      });

      setSelectedFile(null);
      setLastUploadedMedia(uploaded);
      setUploadProgress(100);
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

  async function deleteMedia(item: MediaItem): Promise<void> {
    if (!window.confirm(`Excluir "${item.filename}" da biblioteca?`)) {
      return;
    }

    setDeletingMediaId(item.id);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/media/${item.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? 'Não foi possível excluir esta mídia.');
      }

      await loadMedia();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir mídia');
    } finally {
      setDeletingMediaId(null);
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Biblioteca"
        title="Conteúdos"
        description="Envie imagens e vídeos para usar na programação da TV."
        actions={
          <button className="secondary-button" type="button" onClick={() => void loadMedia()}>
            Atualizar
          </button>
        }
      />

      <section className="metrics-grid" aria-label="Resumo da biblioteca">
        <div>
          <strong>{totalCount}</strong>
          <span>arquivos</span>
        </div>
        <div>
          <strong>{videoCount}</strong>
          <span>vídeos nesta tela</span>
        </div>
        <div>
          <strong>{formatBytes(totalSize)}</strong>
          <span>tamanho nesta tela</span>
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
            accept=".mp4,.jpg,.jpeg,.png,.webp,video/mp4,image/jpeg,image/png,image/webp"
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

      {selectedFile && selectedPreviewUrl ? (
        <section className="selected-media-preview">
          <div className="selected-media-frame">
            {selectedFile.type.startsWith('image/') ? (
              <img alt="" src={selectedPreviewUrl} />
            ) : (
              <video controls muted playsInline preload="metadata" src={selectedPreviewUrl} />
            )}
          </div>
          <div>
            <p className="eyebrow">Preview</p>
            <strong>{selectedFile.name}</strong>
            <span>
              {selectedFile.type || 'arquivo'} · {formatBytes(selectedFile.size)}
            </span>
            {isUploading ? (
              <div className="progress-track" aria-label="Progresso do upload">
                <span style={{ width: `${uploadProgress}%` }} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!selectedFile && lastUploadedMedia ? (
        <section className="selected-media-preview">
          <div className="selected-media-frame">
            {lastUploadedMedia.mimetype.startsWith('image/') ? (
              <img alt="" src={getMediaUrl(apiBaseUrl, lastUploadedMedia.url)} />
            ) : (
              <video
                controls
                muted
                playsInline
                preload="metadata"
                src={getVideoPreviewUrl(apiBaseUrl, lastUploadedMedia.url)}
              />
            )}
          </div>
          <div>
            <p className="eyebrow">Enviada agora</p>
            <strong>{lastUploadedMedia.filename}</strong>
            <span>
              {lastUploadedMedia.mimetype} · {formatBytes(lastUploadedMedia.sizeBytes)}
            </span>
            <Link className="inline-action" href="/playlists">
              Adicionar em uma playlist
            </Link>
          </div>
        </section>
      ) : null}

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
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  src={getVideoPreviewUrl(apiBaseUrl, item.url)}
                />
              )}
            </div>
            <div className="media-meta">
              <strong title={item.filename}>{item.filename}</strong>
              <span>{item.mimetype}</span>
              <span>
                {formatBytes(item.sizeBytes)} · {formatDate(item.createdAt)}
              </span>
              <button
                className="media-delete-button"
                type="button"
                disabled={deletingMediaId === item.id}
                onClick={() => void deleteMedia(item)}
              >
                {deletingMediaId === item.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </article>
        ))}
      </section>

      {media.length < totalCount ? (
        <div className="load-more-row">
          <button
            className="secondary-button"
            type="button"
            disabled={isLoading}
            onClick={() => void loadMedia(currentPage + 1, true)}
          >
            {isLoading ? 'Carregando...' : `Carregar mais (${media.length} de ${totalCount})`}
          </button>
        </div>
      ) : null}
    </DashboardShell>
  );
}

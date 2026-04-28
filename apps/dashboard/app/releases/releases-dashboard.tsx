'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ReleaseChannel = 'STABLE' | 'BETA';

type AppRelease = {
  id: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  apkSizeBytes: number;
  apkMd5: string;
  releaseNotes: string | null;
  channel: ReleaseChannel;
  mandatory: boolean;
  active: boolean;
  createdAt: string;
};

type ReleaseListResponse = {
  data: AppRelease[];
};

const releaseChannels: ReleaseChannel[] = ['STABLE', 'BETA'];

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
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getReleaseUrl(apiBaseUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  return `${apiBaseUrl}${pathOrUrl}`;
}

function parseUploadError(rawValue: string, status: number): string {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const error = (parsed as { error?: { message?: unknown } }).error;
      if (typeof error?.message === 'string') {
        return error.message;
      }
    }
  } catch {
    return `Upload falhou (${status})`;
  }

  return `Upload falhou (${status})`;
}

function findLatestReleaseIds(releases: AppRelease[]): Set<string> {
  const latestIds = new Set<string>();

  for (const channel of releaseChannels) {
    const latest = releases
      .filter((release) => release.channel === channel && release.active)
      .sort((a, b) => b.versionCode - a.versionCode)[0];

    if (latest) {
      latestIds.add(latest.id);
    }
  }

  return latestIds;
}

export function ReleasesDashboard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [channel, setChannel] = useState<ReleaseChannel>('STABLE');
  const [mandatory, setMandatory] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busyReleaseId, setBusyReleaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const latestReleaseIds = useMemo(() => findLatestReleaseIds(releases), [releases]);
  const stableLatest = useMemo(
    () =>
      releases.find((release) => latestReleaseIds.has(release.id) && release.channel === 'STABLE'),
    [latestReleaseIds, releases],
  );
  const betaLatest = useMemo(
    () =>
      releases.find((release) => latestReleaseIds.has(release.id) && release.channel === 'BETA'),
    [latestReleaseIds, releases],
  );

  const loadReleases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/app/releases`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Releases responderam ${response.status}`);
      }

      const payload = (await response.json()) as ReleaseListResponse;
      setReleases(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Falha ao carregar APKs';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  function handleFile(file: File | null): void {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      setError('Selecione um arquivo .apk.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadProgress(0);
  }

  async function uploadRelease(): Promise<void> {
    if (!selectedFile) {
      setError('Selecione uma APK antes de enviar.');
      return;
    }

    if (!versionCode.trim() || !versionName.trim()) {
      setError('Informe versionCode e versionName.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.append('apk', selectedFile);
    formData.append('versionCode', versionCode.trim());
    formData.append('versionName', versionName.trim());
    formData.append('channel', channel);
    formData.append('mandatory', String(mandatory));
    formData.append('active', String(isActive));
    if (releaseNotes.trim()) {
      formData.append('releaseNotes', releaseNotes.trim());
    }

    try {
      await new Promise<AppRelease>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiBaseUrl}/api/app/releases/upload`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText) as AppRelease);
            return;
          }

          reject(new Error(parseUploadError(xhr.responseText, xhr.status)));
        };

        xhr.onerror = () => reject(new Error('Falha de rede durante o upload da APK'));
        xhr.send(formData);
      });

      setSelectedFile(null);
      setVersionCode('');
      setVersionName('');
      setReleaseNotes('');
      setMandatory(false);
      setIsActive(true);
      setUploadProgress(100);
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      await loadReleases();
      setNotice('APK enviada e release registrada.');
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Falha ao enviar APK';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function updateActive(release: AppRelease): Promise<void> {
    setBusyReleaseId(release.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/app/releases/${release.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !release.active }),
      });

      if (!response.ok) {
        throw new Error(`Atualizacao falhou (${response.status})`);
      }

      await loadReleases();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Falha ao atualizar release';
      setError(message);
    } finally {
      setBusyReleaseId(null);
    }
  }

  async function makeLatest(release: AppRelease): Promise<void> {
    setBusyReleaseId(release.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/app/releases/${release.id}/latest`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error(`Promocao falhou (${response.status})`);
      }

      await loadReleases();
      setNotice(`Release ${release.versionName} agora e latest em ${release.channel}.`);
    } catch (latestError) {
      const message =
        latestError instanceof Error ? latestError.message : 'Falha ao promover release';
      setError(message);
    } finally {
      setBusyReleaseId(null);
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
          <a href="/devices">TV Box</a>
          <a aria-current="page" href="/releases">
            APKs
          </a>
          <a href="/api/auth/logout">Sair</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Auto-update</p>
            <h1>APKs do player</h1>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadReleases()}>
            Atualizar
          </button>
        </header>

        <section className="metrics-grid" aria-label="Resumo das releases">
          <div>
            <strong>{releases.length}</strong>
            <span>releases</span>
          </div>
          <div>
            <strong>{stableLatest?.versionName ?? '-'}</strong>
            <span>stable latest</span>
          </div>
          <div>
            <strong>{betaLatest?.versionName ?? '-'}</strong>
            <span>beta latest</span>
          </div>
          <div>
            <strong>{releases.filter((release) => release.active).length}</strong>
            <span>ativas</span>
          </div>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}
        {notice ? <p className="success-banner">{notice}</p> : null}

        <section className="release-layout">
          <aside className="release-upload-panel">
            <p className="eyebrow">Nova APK</p>
            <div className="release-form-grid">
              <div className="form-field">
                <label htmlFor="release-version-code">Version code</label>
                <input
                  id="release-version-code"
                  inputMode="numeric"
                  min={1}
                  type="number"
                  value={versionCode}
                  onChange={(event) => setVersionCode(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="release-version-name">Version name</label>
                <input
                  id="release-version-name"
                  placeholder="1.0.0"
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="release-channel">Canal</label>
                <select
                  id="release-channel"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as ReleaseChannel)}
                >
                  <option value="STABLE">STABLE</option>
                  <option value="BETA">BETA</option>
                </select>
              </div>

              <label className="toggle-row">
                <input
                  checked={mandatory}
                  type="checkbox"
                  onChange={(event) => setMandatory(event.target.checked)}
                />
                <span>Obrigatoria</span>
              </label>

              <label className="toggle-row">
                <input
                  checked={isActive}
                  type="checkbox"
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                <span>Ativa ao publicar</span>
              </label>

              <div className="form-field form-field-wide">
                <label htmlFor="release-notes">Release notes</label>
                <textarea
                  id="release-notes"
                  rows={4}
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                />
              </div>
            </div>

            <div
              className="apk-dropzone"
              onClick={() => inputRef.current?.click()}
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
                accept=".apk,application/vnd.android.package-archive"
                type="file"
                onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
              />
              <strong>{selectedFile ? selectedFile.name : 'Selecionar APK'}</strong>
              <span>
                {selectedFile ? formatBytes(selectedFile.size) : 'Arquivo Android .apk do player'}
              </span>
            </div>

            {isUploading ? (
              <div className="progress-track" aria-label="Progresso do upload">
                <span style={{ width: `${uploadProgress}%` }} />
              </div>
            ) : null}

            <button
              className="primary-button"
              type="button"
              disabled={isUploading || !selectedFile}
              onClick={() => void uploadRelease()}
            >
              {isUploading ? `Enviando ${uploadProgress}%` : 'Publicar APK'}
            </button>
          </aside>

          <section className="release-list" aria-busy={isLoading}>
            {isLoading ? <p className="muted">Carregando releases...</p> : null}

            {!isLoading && releases.length === 0 ? (
              <p className="muted">Nenhuma APK publicada ainda.</p>
            ) : null}

            {releases.map((release) => {
              const latest = latestReleaseIds.has(release.id);
              const busy = busyReleaseId === release.id;

              return (
                <article className="release-card" key={release.id}>
                  <div className="release-card-main">
                    <div className="release-title-row">
                      <div>
                        <strong>{release.versionName}</strong>
                        <span>versionCode {release.versionCode}</span>
                      </div>
                      <div className="release-badges">
                        <span className="status-pill is-online">{release.channel}</span>
                        {latest ? <span className="status-pill is-online">latest</span> : null}
                        {release.mandatory ? (
                          <span className="status-pill">obrigatoria</span>
                        ) : null}
                        {!release.active ? <span className="status-pill">inativa</span> : null}
                      </div>
                    </div>

                    <dl className="release-facts">
                      <div>
                        <dt>Tamanho</dt>
                        <dd>{formatBytes(release.apkSizeBytes)}</dd>
                      </div>
                      <div>
                        <dt>MD5</dt>
                        <dd title={release.apkMd5}>{release.apkMd5}</dd>
                      </div>
                      <div>
                        <dt>Publicada</dt>
                        <dd>{formatDate(release.createdAt)}</dd>
                      </div>
                    </dl>

                    {release.releaseNotes ? (
                      <p className="release-notes">{release.releaseNotes}</p>
                    ) : null}
                  </div>

                  <div className="release-card-actions">
                    <a
                      className="secondary-button button-link"
                      href={getReleaseUrl(apiBaseUrl, release.apkUrl)}
                    >
                      Baixar
                    </a>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy || latest}
                      onClick={() => void makeLatest(release)}
                    >
                      {latest ? 'Latest' : 'Tornar latest'}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void updateActive(release)}
                    >
                      {release.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </section>
      </section>
    </main>
  );
}

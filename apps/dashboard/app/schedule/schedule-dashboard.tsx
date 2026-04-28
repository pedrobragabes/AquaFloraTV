'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type PlaylistSummary = { id: string; name: string };

type Schedule = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  daysOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  playlist: PlaylistSummary;
  createdAt: string;
};

type CurrentPlayback = {
  now: string;
  activeSchedule: { id: string; name: string } | null;
  playlist: { id: string; name: string; itemCount: number } | null;
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PALETTE = ['#1f7a4f', '#2d6bbf', '#9b3fb5', '#c4612a', '#2aa39b', '#7a5c2a', '#a3303a'];

function parseDaysOfWeek(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 6);
  } catch {
    return [];
  }
}

function formatTime(time: string | null): string {
  return time ?? '—';
}

function formatDays(value: string | null): string {
  const days = parseDaysOfWeek(value);
  if (days.length === 0) return 'Todos os dias';
  if (days.length === 7) return 'Todos os dias';
  return days.map((d) => DAY_LABELS[d]).join(', ');
}

function resolveApiBaseUrl(): string {
  return '/api/proxy';
}

function colorForSchedule(schedules: Schedule[], id: string): string {
  const index = schedules.findIndex((s) => s.id === id);
  return PALETTE[index % PALETTE.length] ?? PALETTE[0]!;
}

function WeeklyGrid({ schedules }: { schedules: Schedule[] }) {
  return (
    <div className="weekly-grid">
      {DAY_LABELS.map((label, dayIndex) => {
        const daySchedules = schedules.filter((s) => {
          if (!s.active) return false;
          const days = parseDaysOfWeek(s.daysOfWeek);
          return days.length === 0 || days.includes(dayIndex);
        });

        return (
          <div className="weekly-day" key={dayIndex}>
            <div className="weekly-day-label">{label}</div>
            <div className="weekly-day-slots">
              {daySchedules.length === 0 ? (
                <span className="weekly-empty">sem regra</span>
              ) : (
                daySchedules.map((s) => (
                  <div
                    className="weekly-slot"
                    key={s.id}
                    style={{ background: colorForSchedule(schedules, s.id) }}
                  >
                    <strong>{s.playlist.name}</strong>
                    {s.startTime && s.endTime ? (
                      <span>
                        {s.startTime}–{s.endTime}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  playlistId: '',
  days: [] as number[],
  startTime: '',
  endTime: '',
  priority: 0,
};

export function ScheduleDashboard() {
  const apiBaseUrl = useMemo(resolveApiBaseUrl, []);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [currentPlayback, setCurrentPlayback] = useState<CurrentPlayback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadSchedules = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/schedules`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Schedules responderam ${response.status}`);
    const payload = (await response.json()) as { data: Schedule[] };
    setSchedules(payload.data);
  }, [apiBaseUrl]);

  const loadPlaylists = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/playlists`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Playlists responderam ${response.status}`);
    const payload = (await response.json()) as { data: PlaylistSummary[] };
    setPlaylists(payload.data);
  }, [apiBaseUrl]);

  const loadCurrentPlayback = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/schedules/current`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as CurrentPlayback;
    setCurrentPlayback(payload);
  }, [apiBaseUrl]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadSchedules(), loadPlaylists(), loadCurrentPlayback()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [loadSchedules, loadPlaylists, loadCurrentPlayback]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function toggleDay(day: number): void {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  }

  async function createSchedule(): Promise<void> {
    if (!form.name.trim()) {
      setError('Informe um nome para a regra.');
      return;
    }
    if (!form.playlistId) {
      setError('Selecione uma playlist.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        playlistId: form.playlistId,
        priority: form.priority,
      };

      if (form.days.length > 0) body.daysOfWeek = form.days;
      if (form.startTime) body.startTime = form.startTime;
      if (form.endTime) body.endTime = form.endTime;

      const response = await fetch(`${apiBaseUrl}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Criação falhou (${response.status})`);

      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadSchedules();
      setNotice('Regra de agenda criada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar regra');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(schedule: Schedule): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !schedule.active }),
      });
      if (!response.ok) throw new Error(`Atualização falhou (${response.status})`);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar regra');
    }
  }

  async function deleteSchedule(id: string): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/schedules/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Exclusão falhou (${response.status})`);
      await loadSchedules();
      setNotice('Regra removida.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover regra');
    }
  }

  const activeCount = schedules.filter((s) => s.active).length;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-mark">
          <span>AquaTV</span>
          <small>Loja local</small>
        </div>
        <nav className="nav-list">
          <a href="/dashboard">Resumo</a>
          <a href="/media">Mídias</a>
          <a href="/playlists">Playlists</a>
          <a aria-current="page" href="/schedule">
            Agenda
          </a>
          <a href="/devices">TV Box</a>
          <a href="/releases">APKs</a>
          <a href="/api/auth/logout">Sair</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Programação</p>
            <h1>Agenda</h1>
          </div>
          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={() => void refreshAll()}>
              Atualizar
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowForm((prev) => !prev);
                setError(null);
              }}
            >
              {showForm ? 'Cancelar' : '+ Nova regra'}
            </button>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}
        {notice ? <p className="success-banner">{notice}</p> : null}

        {currentPlayback ? (
          <div className="now-playing-banner">
            <span className="eyebrow">Tocando agora</span>
            {currentPlayback.playlist ? (
              <strong>
                {currentPlayback.playlist.name}
                {currentPlayback.activeSchedule ? (
                  <em> via {currentPlayback.activeSchedule.name}</em>
                ) : (
                  <em> (playlist padrão)</em>
                )}
              </strong>
            ) : (
              <strong>Nenhuma playlist ativa</strong>
            )}
          </div>
        ) : null}

        <div className="metrics-grid">
          <div>
            <strong>{schedules.length}</strong>
            <span>Regras cadastradas</span>
          </div>
          <div>
            <strong>{activeCount}</strong>
            <span>Regras ativas</span>
          </div>
          <div>
            <strong>{schedules.length - activeCount}</strong>
            <span>Regras inativas</span>
          </div>
          <div>
            <strong>{playlists.length}</strong>
            <span>Playlists disponíveis</span>
          </div>
        </div>

        {showForm ? (
          <div className="schedule-form-panel">
            <p className="eyebrow">Nova regra</p>
            <div className="schedule-form-grid">
              <div className="form-field">
                <label htmlFor="sch-name">Nome da regra</label>
                <input
                  id="sch-name"
                  placeholder="ex: Promoção de fim de semana"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-field">
                <label htmlFor="sch-playlist">Playlist</label>
                <select
                  id="sch-playlist"
                  value={form.playlistId}
                  onChange={(e) => setForm((prev) => ({ ...prev, playlistId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="sch-priority">Prioridade (maior = preferência)</label>
                <input
                  id="sch-priority"
                  type="number"
                  min={0}
                  max={100}
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))
                  }
                />
              </div>

              <div className="form-field form-field-wide">
                <label>Dias da semana (vazio = todos)</label>
                <div className="day-picker">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      className={form.days.includes(i) ? 'day-btn is-selected' : 'day-btn'}
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="sch-start">Hora início (HH:MM)</label>
                <input
                  id="sch-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </div>

              <div className="form-field">
                <label htmlFor="sch-end">Hora fim (HH:MM)</label>
                <input
                  id="sch-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={isSaving}
              onClick={() => void createSchedule()}
            >
              {isSaving ? 'Salvando...' : 'Criar regra'}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <p className="muted">Carregando...</p>
        ) : (
          <>
            <div className="schedule-section">
              <p className="eyebrow">Visão semanal</p>
              <WeeklyGrid schedules={schedules} />
            </div>

            <div className="schedule-section">
              <p className="eyebrow">Todas as regras</p>
              {schedules.length === 0 ? (
                <p className="muted">
                  Nenhuma regra criada ainda. Use "+ Nova regra" para começar.
                </p>
              ) : (
                <div className="schedule-list">
                  {schedules.map((schedule) => (
                    <article
                      className={`schedule-card${schedule.active ? '' : ' is-inactive'}`}
                      key={schedule.id}
                    >
                      <div
                        className="schedule-card-accent"
                        style={{ background: colorForSchedule(schedules, schedule.id) }}
                      />
                      <div className="schedule-card-body">
                        <div className="schedule-card-header">
                          <div>
                            <strong>{schedule.name}</strong>
                            <span>{schedule.playlist.name}</span>
                          </div>
                          <div className="schedule-card-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => void toggleActive(schedule)}
                            >
                              {schedule.active ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              className="danger-button"
                              type="button"
                              onClick={() => void deleteSchedule(schedule.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                        <div className="schedule-card-meta">
                          <span>
                            <em>Dias:</em> {formatDays(schedule.daysOfWeek)}
                          </span>
                          <span>
                            <em>Horário:</em> {formatTime(schedule.startTime)}–
                            {formatTime(schedule.endTime)}
                          </span>
                          <span>
                            <em>Prioridade:</em> {schedule.priority}
                          </span>
                          <span className={`status-pill${schedule.active ? ' is-online' : ''}`}>
                            {schedule.active ? 'ativa' : 'inativa'}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

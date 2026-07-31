import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { isInsideDateWindow, isInsideRecurringWindow } from './schedule-window.js';

type PlaylistWithItems = Prisma.PlaylistGetPayload<{
  include: {
    items: {
      include: {
        media: true;
      };
      orderBy: {
        order: 'asc';
      };
    };
  };
}>;

type ScheduleWithPlaylist = Prisma.ScheduleGetPayload<{
  include: {
    playlist: {
      include: {
        items: {
          include: {
            media: true;
          };
          orderBy: {
            order: 'asc';
          };
        };
      };
    };
  };
}>;

export interface ResolvedPlayback {
  activeSchedule: ScheduleWithPlaylist | null;
  playlist: PlaylistWithItems | null;
}

function parseDaysOfWeek(value: string | null): number[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (item): item is number =>
      typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 6,
  );
}

function scheduleMatchesNow(schedule: ScheduleWithPlaylist, now: Date): boolean {
  const datePass = isInsideDateWindow(now, schedule.startDate, schedule.endDate);
  if (!datePass) {
    return false;
  }

  const daysOfWeek = parseDaysOfWeek(schedule.daysOfWeek);
  return isInsideRecurringWindow(now, daysOfWeek, schedule.startTime, schedule.endTime);
}

export async function resolveCurrentPlayback(now: Date = new Date()): Promise<ResolvedPlayback> {
  const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
  if (config?.playbackEnabled === false) {
    return { activeSchedule: null, playlist: null };
  }

  const schedules = await prisma.schedule.findMany({
    where: { active: true },
    include: {
      playlist: {
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  const candidates = schedules
    .filter((schedule) => scheduleMatchesNow(schedule, now))
    .sort((a, b) => b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime());

  if (candidates.length > 0) {
    const activeSchedule = candidates[0];
    if (!activeSchedule) {
      return { activeSchedule: null, playlist: null };
    }

    return {
      activeSchedule,
      playlist: activeSchedule.playlist,
    };
  }

  if (!config?.defaultPlaylistId) {
    return { activeSchedule: null, playlist: null };
  }

  const playlist = await prisma.playlist.findUnique({
    where: { id: config.defaultPlaylistId },
    include: {
      items: {
        include: { media: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  return {
    activeSchedule: null,
    playlist,
  };
}

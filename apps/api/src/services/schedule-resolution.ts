import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

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

function parseTimeToMinutes(rawTime: string | null | undefined): number | null {
  if (!rawTime) {
    return null;
  }

  const [hoursRaw, minutesRaw] = rawTime.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
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

function isInsideDateWindow(now: Date, startDate: Date | null, endDate: Date | null): boolean {
  if (startDate && now < startDate) {
    return false;
  }

  if (endDate && now > endDate) {
    return false;
  }

  return true;
}

function isInsideRecurringWindow(
  now: Date,
  daysOfWeek: number[],
  startTime: string | null,
  endTime: string | null,
): boolean {
  if (daysOfWeek.length === 0 || !startTime || !endTime) {
    return true;
  }

  const nowDay = now.getDay();
  if (!daysOfWeek.includes(nowDay)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  // Overnight window, e.g. 22:00 -> 04:00
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
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

  const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
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

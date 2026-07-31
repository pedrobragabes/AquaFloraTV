import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { resolveCurrentPlayback } from '../services/schedule-resolution.js';
import { HttpError } from '../utils/http-error.js';

export const schedulesRouter = Router();

const scheduleIdParamSchema = z.object({
  id: z.string().min(1),
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleFieldsSchema = z.object({
  name: z.string().trim().min(1),
  playlistId: z.string().min(1),
  active: z.boolean().optional(),
  priority: z.coerce.number().int().default(0),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  startTime: z.string().regex(timeRegex, 'Formato esperado HH:MM (24h)').optional(),
  endTime: z.string().regex(timeRegex, 'Formato esperado HH:MM (24h)').optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

function hasCompleteTimeRange(payload: {
  startTime?: string | undefined;
  endTime?: string | undefined;
}): boolean {
  return (payload.startTime === undefined) === (payload.endTime === undefined);
}

type ScheduleRecord = {
  daysOfWeek: string | null;
  [key: string]: unknown;
};

function deserializeSchedule<T extends ScheduleRecord>(schedule: T): T & { daysOfWeek: number[] } {
  let daysOfWeek: number[] = [];
  if (schedule.daysOfWeek) {
    try {
      const parsed = JSON.parse(schedule.daysOfWeek);
      if (Array.isArray(parsed)) {
        daysOfWeek = parsed.filter(
          (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
        );
      }
    } catch {
      daysOfWeek = [];
    }
  }
  return { ...schedule, daysOfWeek };
}

const createScheduleSchema = scheduleFieldsSchema.refine(hasCompleteTimeRange, {
  message: 'Informe hora inicial e final juntas',
  path: ['endTime'],
});

const updateScheduleSchema = scheduleFieldsSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo do agendamento',
  })
  .refine(hasCompleteTimeRange, {
    message: 'Informe hora inicial e final juntas',
    path: ['endTime'],
  });

const listSchedulesQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
});

schedulesRouter.get('/', async (req, res, next) => {
  try {
    const query = listSchedulesQuerySchema.parse(req.query);
    const where =
      query.active === undefined
        ? {}
        : {
            active: query.active === 'true',
          };

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        playlist: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: schedules.map((s) => deserializeSchedule(s)) });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.get('/current', async (_req, res, next) => {
  try {
    const resolved = await resolveCurrentPlayback();

    res.json({
      now: new Date().toISOString(),
      activeSchedule: resolved.activeSchedule
        ? {
            id: resolved.activeSchedule.id,
            name: resolved.activeSchedule.name,
          }
        : null,
      playlist: resolved.playlist
        ? {
            id: resolved.playlist.id,
            name: resolved.playlist.name,
            itemCount: resolved.playlist.items.length,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

schedulesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = scheduleIdParamSchema.parse(req.params);

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: { playlist: true },
    });

    if (!schedule) {
      throw new HttpError(404, 'SCHEDULE_NOT_FOUND', 'Agendamento não encontrado');
    }

    res.json(deserializeSchedule(schedule));
  } catch (error) {
    next(error);
  }
});

schedulesRouter.post('/', async (req, res, next) => {
  try {
    const payload = createScheduleSchema.parse(req.body);

    const schedule = await prisma.schedule.create({
      data: {
        name: payload.name,
        playlist: { connect: { id: payload.playlistId } },
        active: payload.active ?? true,
        priority: payload.priority,
        ...(payload.daysOfWeek !== undefined
          ? { daysOfWeek: JSON.stringify(payload.daysOfWeek) }
          : {}),
        ...(payload.startTime !== undefined ? { startTime: payload.startTime } : {}),
        ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
        ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
      },
    });

    res.status(201).json(deserializeSchedule(schedule));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(new HttpError(404, 'PLAYLIST_NOT_FOUND', 'Playlist não encontrada'));
      return;
    }

    next(error);
  }
});

schedulesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = scheduleIdParamSchema.parse(req.params);
    const payload = updateScheduleSchema.parse(req.body);

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.playlistId !== undefined
          ? { playlist: { connect: { id: payload.playlistId } } }
          : {}),
        ...(payload.active !== undefined ? { active: payload.active } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        ...(payload.daysOfWeek !== undefined
          ? { daysOfWeek: JSON.stringify(payload.daysOfWeek) }
          : {}),
        ...(payload.startTime !== undefined ? { startTime: payload.startTime } : {}),
        ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
        ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
      },
    });

    res.json(deserializeSchedule(schedule));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'SCHEDULE_NOT_FOUND', 'Agendamento ou playlist não encontrado'));
      return;
    }

    next(error);
  }
});

schedulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = scheduleIdParamSchema.parse(req.params);

    await prisma.schedule.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'SCHEDULE_NOT_FOUND', 'Agendamento não encontrado'));
      return;
    }

    next(error);
  }
});

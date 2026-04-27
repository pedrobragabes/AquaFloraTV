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

const scheduleBaseSchema = z.object({
  name: z.string().trim().min(1),
  playlistId: z.string().min(1),
  active: z.boolean().optional(),
  priority: z.coerce.number().int().default(0),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const createScheduleSchema = scheduleBaseSchema;

const updateScheduleSchema = scheduleBaseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one schedule field must be informed',
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

    res.json({ data: schedules });
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

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(new HttpError(409, 'PLAYLIST_NOT_FOUND', 'playlistId does not exist'));
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

    res.json(schedule);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found'));
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
      next(new HttpError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found'));
      return;
    }

    next(error);
  }
});

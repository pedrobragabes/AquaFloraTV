import { createHash, randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middlewares/require-admin.js';
import { resolveCurrentPlayback } from '../services/schedule-resolution.js';
import { HttpError } from '../utils/http-error.js';

export const devicesRouter = Router();

const registerDeviceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicDeviceSelect = {
  id: true,
  name: true,
  lastSeenAt: true,
  appVersion: true,
  deviceModel: true,
  androidVersion: true,
  freeDiskMb: true,
  totalDiskMb: true,
  uptimeSeconds: true,
  currentMediaId: true,
  currentPlaylistId: true,
  networkType: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true,
} as const;

const deviceIdParamSchema = z.object({
  id: z.string().min(1),
});

const createDeviceSchema = z.object({
  name: z.string().trim().min(1),
  deviceModel: z.string().trim().optional(),
  androidVersion: z.string().trim().optional(),
});

const heartbeatSchema = z.object({
  uptimeSeconds: z.coerce.number().int().nonnegative().optional(),
  freeDiskMb: z.coerce.number().int().nonnegative().optional(),
  totalDiskMb: z.coerce.number().int().nonnegative().optional(),
  appVersion: z.string().trim().optional(),
  currentMediaId: z.string().trim().min(1).nullable().optional(),
  networkType: z.string().trim().optional(),
});

async function assertDeviceToken(deviceId: string, authorizationHeader?: string): Promise<void> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Token do dispositivo ausente');
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.token !== token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Token do dispositivo inválido');
  }
}

devicesRouter.post('/', registerDeviceLimiter, async (req, res, next) => {
  try {
    const payload = createDeviceSchema.parse(req.body);

    const token = `dev_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;

    const created = await prisma.device.create({
      data: {
        name: payload.name,
        token,
        ...(payload.deviceModel !== undefined ? { deviceModel: payload.deviceModel } : {}),
        ...(payload.androidVersion !== undefined ? { androidVersion: payload.androidVersion } : {}),
      },
    });

    res.status(201).json({
      id: created.id,
      name: created.name,
      token,
    });
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      select: publicDeviceSelect,
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: devices });
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);

    const device = await prisma.device.findUnique({
      where: { id },
      select: publicDeviceSelect,
    });

    if (!device) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Dispositivo não encontrado');
    }

    res.json(device);
  } catch (error) {
    next(error);
  }
});

devicesRouter.post('/:id/heartbeat', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    await assertDeviceToken(id, req.header('authorization'));

    const payload = heartbeatSchema.parse(req.body);
    const now = new Date();
    const ipAddress = req.ip ?? null;

    await prisma.device.update({
      where: { id },
      data: {
        lastSeenAt: now,
        ...(payload.freeDiskMb !== undefined ? { freeDiskMb: payload.freeDiskMb } : {}),
        ...(payload.totalDiskMb !== undefined ? { totalDiskMb: payload.totalDiskMb } : {}),
        ...(payload.uptimeSeconds !== undefined ? { uptimeSeconds: payload.uptimeSeconds } : {}),
        ...(payload.appVersion !== undefined ? { appVersion: payload.appVersion } : {}),
        ...(payload.currentMediaId !== undefined ? { currentMediaId: payload.currentMediaId } : {}),
        ...(payload.networkType !== undefined ? { networkType: payload.networkType } : {}),
        ...(ipAddress !== null ? { ipAddress } : {}),
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id/current-playlist', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    await assertDeviceToken(id, req.header('authorization'));

    const resolved = await resolveCurrentPlayback();
    if (!resolved.playlist) {
      throw new HttpError(
        404,
        'PLAYLIST_NOT_FOUND',
        'Nenhuma playlist ativa ou padrão foi configurada',
      );
    }

    const hashSource = JSON.stringify({
      id: resolved.playlist.id,
      name: resolved.playlist.name,
      items: resolved.playlist.items.map((item) => ({
        mediaId: item.mediaId,
        md5: item.media.md5,
        order: item.order,
        durationOverrideMs: item.durationOverrideMs,
      })),
    });

    const hash = createHash('sha256').update(hashSource).digest('hex');

    res.json({
      playlist: {
        id: resolved.playlist.id,
        name: resolved.playlist.name,
        hash: `sha256:${hash}`,
      },
      items: resolved.playlist.items.map((item) => ({
        id: item.id,
        order: item.order,
        durationOverrideMs: item.durationOverrideMs,
        media: {
          id: item.media.id,
          storedName: item.media.storedName,
          url: item.media.url,
          md5: item.media.md5,
          sizeBytes: item.media.sizeBytes,
          mimetype: item.media.mimetype,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

devicesRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    await prisma.device.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'DEVICE_NOT_FOUND', 'Dispositivo não encontrado'));
      return;
    }
    next(error);
  }
});

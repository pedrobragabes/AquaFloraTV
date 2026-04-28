import { createHash, randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { resolveCurrentPlayback } from '../services/schedule-resolution.js';
import { HttpError } from '../utils/http-error.js';

export const devicesRouter = Router();

const deviceStreams = new Map<string, Set<Response>>();

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
  currentMediaId: z.string().trim().optional(),
  networkType: z.string().trim().optional(),
  ipAddress: z.string().trim().optional(),
});

const deviceLogsQuerySchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
  event: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const createDeviceLogSchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  event: z.string().trim().min(1),
  message: z.string().trim().optional(),
  payload: z.unknown().optional(),
});

const heartbeatsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  resolution: z.enum(['minute', 'hour', 'day']).optional(),
});

function sendSseEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function getDeviceListeners(deviceId: string): Set<Response> {
  return deviceStreams.get(deviceId) ?? new Set<Response>();
}

async function assertDeviceToken(deviceId: string, authorizationHeader?: string): Promise<void> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing Bearer token');
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.token !== token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid device token');
  }
}

devicesRouter.post('/', async (req, res, next) => {
  try {
    const payload = createDeviceSchema.parse(req.body);

    const created = await prisma.device.create({
      data: {
        name: payload.name,
        token: `pending-${randomUUID()}`,
        ...(payload.deviceModel !== undefined ? { deviceModel: payload.deviceModel } : {}),
        ...(payload.androidVersion !== undefined ? { androidVersion: payload.androidVersion } : {}),
      },
    });

    const signedToken = jwt.sign({ deviceId: created.id }, env.JWT_SECRET, {
      expiresIn: '365d',
    });

    await prisma.device.update({
      where: { id: created.id },
      data: { token: signedToken },
    });

    res.status(201).json({
      id: created.id,
      name: created.name,
      token: signedToken,
    });
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/', async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: devices });
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!device) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found');
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

    await prisma.$transaction([
      prisma.deviceHeartbeat.create({
        data: {
          deviceId: id,
          ...(payload.freeDiskMb !== undefined ? { freeDiskMb: payload.freeDiskMb } : {}),
          ...(payload.uptimeSeconds !== undefined ? { uptimeSeconds: payload.uptimeSeconds } : {}),
          ...(payload.appVersion !== undefined ? { appVersion: payload.appVersion } : {}),
          ...(payload.currentMediaId !== undefined
            ? { currentMediaId: payload.currentMediaId }
            : {}),
          ...(payload.networkType !== undefined ? { networkType: payload.networkType } : {}),
        },
      }),
      prisma.device.update({
        where: { id },
        data: {
          lastSeenAt: now,
          ...(payload.freeDiskMb !== undefined ? { freeDiskMb: payload.freeDiskMb } : {}),
          ...(payload.totalDiskMb !== undefined ? { totalDiskMb: payload.totalDiskMb } : {}),
          ...(payload.uptimeSeconds !== undefined ? { uptimeSeconds: payload.uptimeSeconds } : {}),
          ...(payload.appVersion !== undefined ? { appVersion: payload.appVersion } : {}),
          ...(payload.currentMediaId !== undefined
            ? { currentMediaId: payload.currentMediaId }
            : {}),
          ...(payload.networkType !== undefined ? { networkType: payload.networkType } : {}),
          ...(payload.ipAddress !== undefined ? { ipAddress: payload.ipAddress } : {}),
        },
      }),
    ]);

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
      throw new HttpError(404, 'PLAYLIST_NOT_FOUND', 'No active or fallback playlist configured');
    }

    const hashSource = resolved.playlist.items
      .map(
        (item) =>
          `${item.mediaId}:${item.media.md5}:${item.order}:${item.durationOverrideMs ?? 'null'}`,
      )
      .join('|');

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

devicesRouter.get('/:id/stream', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    await assertDeviceToken(id, req.header('authorization'));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listeners = getDeviceListeners(id);
    listeners.add(res);
    deviceStreams.set(id, listeners);

    sendSseEvent(res, 'connected', { ok: true });

    const keepAliveTimer = setInterval(() => {
      sendSseEvent(res, 'ping', {});
    }, 20_000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);

      const currentListeners = getDeviceListeners(id);
      currentListeners.delete(res);

      if (currentListeners.size === 0) {
        deviceStreams.delete(id);
      } else {
        deviceStreams.set(id, currentListeners);
      }
    });
  } catch (error) {
    next(error);
  }
});

devicesRouter.post('/:id/force-sync', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    const listeners = getDeviceListeners(id);

    for (const listener of listeners) {
      sendSseEvent(listener, 'sync', { reason: 'manual' });
    }

    res.status(202).json({
      queued: true,
      listeners: listeners.size,
    });
  } catch (error) {
    next(error);
  }
});

devicesRouter.post('/:id/logs', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    await assertDeviceToken(id, req.header('authorization'));

    const payload = createDeviceLogSchema.parse(req.body);

    const log = await prisma.deviceLog.create({
      data: {
        deviceId: id,
        level: payload.level,
        event: payload.event,
        ...(payload.message !== undefined ? { message: payload.message } : {}),
        ...(payload.payload !== undefined ? { payload: JSON.stringify(payload.payload) } : {}),
      },
    });

    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id/logs', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    const query = deviceLogsQuerySchema.parse(req.query);

    const logs = await prisma.deviceLog.findMany({
      where: {
        deviceId: id,
        ...(query.level !== undefined ? { level: query.level } : {}),
        ...(query.event !== undefined ? { event: query.event } : {}),
        ...(query.from !== undefined || query.to !== undefined
          ? {
              timestamp: {
                ...(query.from !== undefined ? { gte: query.from } : {}),
                ...(query.to !== undefined ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit,
    });

    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});

devicesRouter.get('/:id/heartbeats', async (req, res, next) => {
  try {
    const { id } = deviceIdParamSchema.parse(req.params);
    const query = heartbeatsQuerySchema.parse(req.query);

    const heartbeats = await prisma.deviceHeartbeat.findMany({
      where: {
        deviceId: id,
        ...(query.from !== undefined || query.to !== undefined
          ? {
              timestamp: {
                ...(query.from !== undefined ? { gte: query.from } : {}),
                ...(query.to !== undefined ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      data: heartbeats,
      resolution: query.resolution ?? 'raw',
    });
  } catch (error) {
    next(error);
  }
});

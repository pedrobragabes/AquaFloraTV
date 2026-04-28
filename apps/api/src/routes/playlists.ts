import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { broadcastDeviceSync } from '../services/device-sync.js';
import { HttpError } from '../utils/http-error.js';

export const playlistsRouter = Router();

const playlistIdParamSchema = z.object({
  id: z.string().min(1),
});

const defaultPlaylistSchema = z.object({
  playlistId: z.string().min(1).nullable(),
});

const playlistItemSchema = z.object({
  mediaId: z.string().min(1),
  order: z.coerce.number().int().min(0),
  durationOverrideMs: z.coerce.number().int().positive().nullable().optional(),
});

const createPlaylistSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
});

const updatePlaylistSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    items: z.array(playlistItemSchema).optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.items !== undefined,
    {
      message: 'At least one field must be provided for update',
    },
  );

playlistsRouter.get('/', async (_req, res, next) => {
  try {
    const [config, playlists] = await Promise.all([
      prisma.globalConfig.findUnique({ where: { id: 'singleton' } }),
      prisma.playlist.findMany({
        include: {
          _count: {
            select: {
              items: true,
              schedules: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    res.json({ data: playlists, defaultPlaylistId: config?.defaultPlaylistId ?? null });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.get('/default', async (_req, res, next) => {
  try {
    const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
    res.json({ playlistId: config?.defaultPlaylistId ?? null });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.put('/default', async (req, res, next) => {
  try {
    const payload = defaultPlaylistSchema.parse(req.body);

    if (payload.playlistId) {
      const playlist = await prisma.playlist.findUnique({
        where: { id: payload.playlistId },
        select: { id: true },
      });

      if (!playlist) {
        throw new HttpError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
      }
    }

    const config = await prisma.globalConfig.upsert({
      where: { id: 'singleton' },
      update: { defaultPlaylistId: payload.playlistId },
      create: {
        id: 'singleton',
        defaultPlaylistId: payload.playlistId,
      },
    });

    broadcastDeviceSync(payload.playlistId ? 'playlist-default-changed' : 'playback-stopped');
    res.json({ playlistId: config.defaultPlaylistId });
  } catch (error) {
    next(error);
  }
});

playlistsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = playlistIdParamSchema.parse(req.params);

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!playlist) {
      throw new HttpError(404, 'PLAYLIST_NOT_FOUND', `Playlist ${id} not found`);
    }

    res.json(playlist);
  } catch (error) {
    next(error);
  }
});

playlistsRouter.post('/', async (req, res, next) => {
  try {
    const payload = createPlaylistSchema.parse(req.body);

    const playlist = await prisma.playlist.create({
      data: {
        name: payload.name,
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      },
    });

    res.status(201).json(playlist);
  } catch (error) {
    next(error);
  }
});

playlistsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = playlistIdParamSchema.parse(req.params);
    const payload = updatePlaylistSchema.parse(req.body);

    const playlist = await prisma.$transaction(async (tx) => {
      await tx.playlist.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
        },
      });

      if (payload.items) {
        await tx.playlistItem.deleteMany({ where: { playlistId: id } });

        if (payload.items.length > 0) {
          await tx.playlistItem.createMany({
            data: payload.items.map((item) => ({
              playlistId: id,
              mediaId: item.mediaId,
              order: item.order,
              durationOverrideMs: item.durationOverrideMs ?? null,
            })),
          });
        }
      }

      return tx.playlist.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    broadcastDeviceSync('playlist-updated');
    res.json(playlist);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found'));
      return;
    }

    next(error);
  }
});

playlistsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = playlistIdParamSchema.parse(req.params);

    await prisma.playlist.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found'));
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(
        new HttpError(
          409,
          'PLAYLIST_CONFLICT',
          'Playlist cannot be removed while linked to another resource',
        ),
      );
      return;
    }

    next(error);
  }
});

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

export const appReleasesRouter = Router();

const channelSchema = z.enum(['STABLE', 'BETA']);

const latestQuerySchema = z.object({
  channel: channelSchema.optional(),
});

const createReleaseSchema = z.object({
  versionCode: z.coerce.number().int().positive(),
  versionName: z.string().trim().min(1),
  apkUrl: z.string().url(),
  apkSizeBytes: z.coerce.number().int().positive(),
  apkMd5: z.string().trim().min(1),
  releaseNotes: z.string().trim().optional(),
  channel: channelSchema.default('STABLE'),
  mandatory: z.boolean().default(false),
  active: z.boolean().default(true),
});

const updateReleaseSchema = z
  .object({
    releaseNotes: z.string().trim().optional(),
    active: z.boolean().optional(),
  })
  .refine((payload) => payload.releaseNotes !== undefined || payload.active !== undefined, {
    message: 'At least one field must be provided for release update',
  });

const releaseIdParamSchema = z.object({
  id: z.string().min(1),
});

appReleasesRouter.get('/latest', async (req, res, next) => {
  try {
    const query = latestQuerySchema.parse(req.query);

    const latest = await prisma.appRelease.findFirst({
      where: {
        active: true,
        channel: query.channel ?? 'STABLE',
      },
      orderBy: {
        versionCode: 'desc',
      },
    });

    if (!latest) {
      throw new HttpError(404, 'RELEASE_NOT_FOUND', 'No active release found for this channel');
    }

    res.json(latest);
  } catch (error) {
    next(error);
  }
});

appReleasesRouter.get('/releases', async (_req, res, next) => {
  try {
    const releases = await prisma.appRelease.findMany({
      orderBy: [{ channel: 'asc' }, { versionCode: 'desc' }],
    });

    res.json({ data: releases });
  } catch (error) {
    next(error);
  }
});

appReleasesRouter.post('/releases', async (req, res, next) => {
  try {
    const payload = createReleaseSchema.parse(req.body);

    const release = await prisma.appRelease.create({
      data: {
        versionCode: payload.versionCode,
        versionName: payload.versionName,
        apkUrl: payload.apkUrl,
        apkSizeBytes: payload.apkSizeBytes,
        apkMd5: payload.apkMd5,
        channel: payload.channel,
        mandatory: payload.mandatory,
        active: payload.active,
        ...(payload.releaseNotes !== undefined ? { releaseNotes: payload.releaseNotes } : {}),
      },
    });

    res.status(201).json(release);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      next(new HttpError(409, 'VERSION_CONFLICT', 'versionCode must be unique'));
      return;
    }

    next(error);
  }
});

appReleasesRouter.put('/releases/:id', async (req, res, next) => {
  try {
    const { id } = releaseIdParamSchema.parse(req.params);
    const payload = updateReleaseSchema.parse(req.body);

    const release = await prisma.appRelease.update({
      where: { id },
      data: {
        ...(payload.releaseNotes !== undefined ? { releaseNotes: payload.releaseNotes } : {}),
        ...(payload.active !== undefined ? { active: payload.active } : {}),
      },
    });

    res.json(release);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'RELEASE_NOT_FOUND', 'Release not found'));
      return;
    }

    next(error);
  }
});

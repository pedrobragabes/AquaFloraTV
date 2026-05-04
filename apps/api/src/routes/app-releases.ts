import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

export const appReleasesRouter = Router();

const channelSchema = z.enum(['STABLE', 'BETA']);
const apksStoragePath = path.resolve(env.STORAGE_PATH, 'apks');
const maxApkUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

const formBooleanSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase());
  }

  return value;
}, z.boolean());

const latestQuerySchema = z.object({
  channel: channelSchema.optional(),
});

const uploadReleaseSchema = z.object({
  versionCode: z.coerce.number().int().positive(),
  versionName: z.string().trim().min(1),
  releaseNotes: z.string().trim().optional(),
  channel: channelSchema.default('STABLE'),
  mandatory: formBooleanSchema.default(false),
  active: formBooleanSchema.default(true),
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

const releaseVersionParamSchema = z.object({
  version: z.string().trim().min(1),
});

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function isAllowedApkUpload(filename: string, mimetype: string): boolean {
  const hasApkExtension = path.extname(filename).toLowerCase() === '.apk';
  const allowedMimeTypes = new Set([
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
  ]);

  return hasApkExtension && allowedMimeTypes.has(mimetype);
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  return hash.digest('hex');
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdir(apksStoragePath, { recursive: true })
        .then(() => callback(null, apksStoragePath))
        .catch((error: unknown) => callback(error as Error, apksStoragePath));
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeName = sanitizeFilename(path.basename(file.originalname, extension));
      callback(null, `${safeName || 'aquatv'}-${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: maxApkUploadBytes,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedApkUpload(file.originalname, file.mimetype)) {
      callback(new HttpError(415, 'UNSUPPORTED_APK_TYPE', 'Only .apk uploads are allowed'));
      return;
    }

    callback(null, true);
  },
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

appReleasesRouter.get('/download/:version', async (req, res, next) => {
  try {
    const { version } = releaseVersionParamSchema.parse(req.params);
    const versionCode = Number(version);

    const release = await prisma.appRelease.findFirst({
      where: Number.isInteger(versionCode) ? { versionCode } : { versionName: version },
      orderBy: { versionCode: 'desc' },
    });

    if (!release) {
      throw new HttpError(404, 'RELEASE_NOT_FOUND', 'Release not found');
    }

    if (!release.apkUrl.startsWith('/storage/apks/')) {
      throw new HttpError(409, 'INVALID_RELEASE_URL', 'Release APK URL is not downloadable');
    }

    const filename = path.basename(release.apkUrl);
    const filePath = path.resolve(apksStoragePath, filename);
    if (path.relative(apksStoragePath, filePath).startsWith('..')) {
      throw new HttpError(400, 'INVALID_RELEASE_PATH', 'Invalid APK file path');
    }
    const fileExists = await access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      throw new HttpError(404, 'APK_FILE_NOT_FOUND', 'APK file not found on disk');
    }

    res.download(filePath, filename);
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

appReleasesRouter.post('/releases/upload', upload.single('apk'), async (req, res, next) => {
  const file = req.file;

  if (!file) {
    next(new HttpError(400, 'APK_REQUIRED', 'Multipart field "apk" is required'));
    return;
  }

  try {
    const payload = uploadReleaseSchema.parse(req.body);
    const sha256 = await calculateSha256(file.path);

    const release = await prisma.appRelease.create({
      data: {
        versionCode: payload.versionCode,
        versionName: payload.versionName,
        apkUrl: `/storage/apks/${file.filename}`,
        apkSizeBytes: file.size,
        apkMd5: sha256,
        channel: payload.channel,
        mandatory: payload.mandatory,
        active: payload.active,
        ...(payload.releaseNotes !== undefined ? { releaseNotes: payload.releaseNotes } : {}),
      },
    });

    res.status(201).json(release);
  } catch (error) {
    await unlink(file.path).catch(() => undefined);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      next(new HttpError(409, 'VERSION_CONFLICT', 'versionCode must be unique'));
      return;
    }

    next(error);
  }
});

appReleasesRouter.put('/releases/:id/latest', async (req, res, next) => {
  try {
    const { id } = releaseIdParamSchema.parse(req.params);

    const release = await prisma.$transaction(async (tx) => {
      const target = await tx.appRelease.findUniqueOrThrow({ where: { id } });

      await tx.appRelease.updateMany({
        where: {
          channel: target.channel,
          id: { not: target.id },
        },
        data: { active: false },
      });

      return tx.appRelease.update({
        where: { id },
        data: { active: true },
      });
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

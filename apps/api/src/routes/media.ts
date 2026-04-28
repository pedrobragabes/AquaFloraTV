import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

export const mediaRouter = Router();

const mediaStoragePath = path.resolve(env.STORAGE_PATH, 'media');
const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function isAllowedMediaMime(mimetype: string): boolean {
  return mimetype.startsWith('image/') || mimetype.startsWith('video/');
}

async function calculateMd5(filePath: string): Promise<string> {
  const hash = createHash('md5');
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
      mkdir(mediaStoragePath, { recursive: true })
        .then(() => callback(null, mediaStoragePath))
        .catch((error: unknown) => callback(error as Error, mediaStoragePath));
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: maxUploadBytes,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedMediaMime(file.mimetype)) {
      callback(
        new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only image and video uploads are allowed'),
      );
      return;
    }

    callback(null, true);
  },
});

const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

const mediaIdParamSchema = z.object({
  id: z.string().min(1),
});

mediaRouter.get('/', async (req, res, next) => {
  try {
    const query = mediaListQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = query.search
      ? {
          filename: {
            contains: query.search,
          },
        }
      : {};

    const [total, data] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

mediaRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  const file = req.file;

  if (!file) {
    next(new HttpError(400, 'FILE_REQUIRED', 'Multipart field "file" is required'));
    return;
  }

  try {
    const md5 = await calculateMd5(file.path);
    const uploadedBy = req.header('x-uploaded-by');
    const media = await prisma.media.create({
      data: {
        filename: sanitizeFilename(file.originalname) || file.originalname,
        storedName: file.filename,
        url: `/storage/media/${file.filename}`,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        md5,
        ...(uploadedBy !== undefined ? { uploadedBy } : {}),
      },
    });

    res.status(201).json(media);
  } catch (error) {
    await unlink(file.path).catch(() => undefined);
    next(error);
  }
});

mediaRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = mediaIdParamSchema.parse(req.params);

    const media = await prisma.media.delete({
      where: { id },
    });
    await unlink(path.resolve(mediaStoragePath, media.storedName)).catch(() => undefined);

    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      next(new HttpError(404, 'MEDIA_NOT_FOUND', 'Media not found'));
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(
        new HttpError(
          409,
          'MEDIA_IN_USE',
          'Media cannot be removed while it is linked to a playlist',
        ),
      );
      return;
    }

    next(error);
  }
});

import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, unlink } from 'node:fs/promises';
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

function displayFilename(filename: string): string {
  return Array.from(path.basename(filename))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .slice(0, 255)
    .join('')
    .trim();
}

const supportedMedia = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
} as const;

type SupportedMediaMime = keyof typeof supportedMedia;

function isSupportedMediaMime(mimetype: string): mimetype is SupportedMediaMime {
  return Object.prototype.hasOwnProperty.call(supportedMedia, mimetype);
}

function isAllowedUpload(filename: string, mimetype: string): boolean {
  if (!isSupportedMediaMime(mimetype)) {
    return false;
  }

  return (supportedMedia[mimetype] as readonly string[]).includes(
    path.extname(filename).toLowerCase(),
  );
}

async function hasExpectedFileSignature(
  filePath: string,
  mimetype: SupportedMediaMime,
): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 12) {
      return false;
    }

    if (mimetype === 'image/jpeg') {
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    if (mimetype === 'image/png') {
      return header
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimetype === 'image/webp') {
      return (
        header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
      );
    }

    return header.toString('ascii', 4, 8) === 'ftyp';
  } finally {
    await handle.close();
  }
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
    if (!isAllowedUpload(file.originalname, file.mimetype)) {
      callback(
        new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formatos aceitos: MP4, JPG, PNG e WebP'),
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
    next(new HttpError(400, 'FILE_REQUIRED', 'Selecione um arquivo para enviar'));
    return;
  }

  try {
    if (
      !isSupportedMediaMime(file.mimetype) ||
      !(await hasExpectedFileSignature(file.path, file.mimetype))
    ) {
      throw new HttpError(
        415,
        'INVALID_MEDIA_FILE',
        'O conteúdo do arquivo não corresponde ao formato informado',
      );
    }

    const md5 = await calculateMd5(file.path);
    const uploadedBy = req.header('x-uploaded-by');
    const media = await prisma.media.create({
      data: {
        filename: displayFilename(file.originalname) || 'midia',
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
      next(new HttpError(404, 'MEDIA_NOT_FOUND', 'Mídia não encontrada'));
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(
        new HttpError(409, 'MEDIA_IN_USE', 'Remova esta mídia das playlists antes de excluí-la'),
      );
      return;
    }

    next(error);
  }
});

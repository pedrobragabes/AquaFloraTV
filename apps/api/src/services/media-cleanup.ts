import { unlink } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const cleanupIntervalMs = 24 * 60 * 60 * 1000;

function resolveMediaPath(storedName: string): string {
  return path.resolve(env.STORAGE_PATH, 'media', storedName);
}

export async function cleanupUnusedMedia(): Promise<number> {
  const cutoff = new Date(Date.now() - env.MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const unusedMedia = await prisma.media.findMany({
    where: {
      createdAt: { lt: cutoff },
      playlistItems: { none: {} },
    },
    select: {
      id: true,
      storedName: true,
    },
  });

  for (const media of unusedMedia) {
    await prisma.media.delete({ where: { id: media.id } });
    await unlink(resolveMediaPath(media.storedName)).catch(() => undefined);
  }

  return unusedMedia.length;
}

export function startMediaCleanupJob(): void {
  const runCleanup = (): void => {
    void cleanupUnusedMedia()
      .then((deletedCount) => {
        if (deletedCount > 0) {
          console.log(`Media cleanup removed ${deletedCount} unused files`);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Media cleanup failed: ${message}`);
      });
  };

  runCleanup();
  setInterval(runCleanup, cleanupIntervalMs).unref();
}

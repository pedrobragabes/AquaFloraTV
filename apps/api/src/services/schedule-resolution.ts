import { prisma } from '../lib/prisma.js';

export interface ResolvedPlayback {
  playlist: Awaited<ReturnType<typeof findDefaultPlaylist>> | null;
}

function findDefaultPlaylist(defaultPlaylistId: string) {
  return prisma.playlist.findUnique({
    where: { id: defaultPlaylistId },
    include: {
      items: {
        include: { media: true },
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function resolveCurrentPlayback(): Promise<ResolvedPlayback> {
  const config = await prisma.globalConfig.findUnique({ where: { id: 'singleton' } });
  if (!config?.defaultPlaylistId) {
    return { playlist: null };
  }

  return { playlist: await findDefaultPlaylist(config.defaultPlaylistId) };
}

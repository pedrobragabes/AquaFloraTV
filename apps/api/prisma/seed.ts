import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let defaultPlaylist = await prisma.playlist.findFirst({
    where: { name: 'Playlist Padrao' },
  });

  if (!defaultPlaylist) {
    defaultPlaylist = await prisma.playlist.create({
      data: {
        name: 'Playlist Padrao',
        description: 'Playlist fallback criada no seed inicial',
      },
    });
  }

  await prisma.globalConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      defaultPlaylistId: defaultPlaylist.id,
      playbackEnabled: true,
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

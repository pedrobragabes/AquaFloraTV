import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const envSchema = z.object({
  ADMIN_EMAILS: z.string().default('pedrobraga855@gmail.com'),
});

function parseAdminEmails(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: {
        email,
        role: 'ADMIN',
      },
    });
  }

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
    update: {
      defaultPlaylistId: defaultPlaylist.id,
    },
    create: {
      id: 'singleton',
      defaultPlaylistId: defaultPlaylist.id,
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

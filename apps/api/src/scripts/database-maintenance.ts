import 'dotenv/config';

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

type TableNameRow = { name: string };
type MigrationNameRow = { migration_name: string };
type IntegrityRow = { integrity_check: string };
type DatabaseFileRow = { name: string; file: string };
type MediaStorageRow = { storedName: string };

const expectedLegacyTables = [
  'User',
  'Media',
  'Playlist',
  'PlaylistItem',
  'Schedule',
  'GlobalConfig',
  'Device',
  'DeviceHeartbeat',
  'DeviceLog',
  'AppRelease',
  'Account',
  'Session',
  'VerificationToken',
] as const;

const prismaDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prisma');

function configuredDatabasePath(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl?.startsWith('file:')) {
    throw new Error('DATABASE_URL precisa usar SQLite no formato file:...');
  }

  const queryIndex = databaseUrl.indexOf('?');
  const rawPath = databaseUrl.slice('file:'.length, queryIndex >= 0 ? queryIndex : undefined);
  if (!rawPath) {
    throw new Error('DATABASE_URL nao informa o caminho do arquivo SQLite');
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    throw new Error('DATABASE_URL contem um caminho com escape invalido');
  }

  if (process.platform === 'win32' && /^\/+[A-Za-z]:[\\/]/.test(decodedPath)) {
    decodedPath = decodedPath.replace(/^\/+/, '');
  }

  return path.resolve(
    path.isAbsolute(decodedPath) ? decodedPath : path.join(prismaDirectory, decodedPath),
  );
}

async function databaseFileStatus(
  filePath: string,
): Promise<{ exists: boolean; sizeBytes: number }> {
  try {
    const info = await stat(filePath);
    return { exists: info.isFile(), sizeBytes: info.isFile() ? info.size : 0 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, sizeBytes: 0 };
    }
    throw error;
  }
}

async function assertDatabaseFile(filePath: string): Promise<void> {
  const status = await databaseFileStatus(filePath);
  if (!status.exists) {
    throw new Error(`Banco SQLite nao encontrado: ${filePath}`);
  }
}

function sqliteFileUrl(filePath: string): string {
  return `file:${path.resolve(filePath).replace(/\\/g, '/')}`;
}

function escapeSqlitePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/').replace(/'/g, "''");
}

async function inspectDatabase(prisma: PrismaClient): Promise<void> {
  const [rows, databaseFiles, integrity, foreignKeyErrors] = await Promise.all([
    prisma.$queryRawUnsafe<TableNameRow[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ),
    prisma.$queryRawUnsafe<DatabaseFileRow[]>('PRAGMA database_list'),
    prisma.$queryRawUnsafe<IntegrityRow[]>('PRAGMA integrity_check'),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>('PRAGMA foreign_key_check'),
  ]);
  const tableNames = new Set(rows.map((row) => row.name));
  const hasMigrationTable = tableNames.has('_prisma_migrations');
  const userTables = rows
    .map((row) => row.name)
    .filter((name) => !name.startsWith('sqlite_') && name !== '_prisma_migrations');
  const appliedMigrations = hasMigrationTable
    ? (
        await prisma.$queryRawUnsafe<MigrationNameRow[]>(
          'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
        )
      ).map((row) => row.migration_name)
    : [];

  process.stdout.write(
    JSON.stringify({
      databasePath: databaseFiles.find((database) => database.name === 'main')?.file ?? null,
      hasMigrationTable,
      appliedMigrations,
      isEmpty: userTables.length === 0,
      integrityOk: integrity.length === 1 && integrity[0]?.integrity_check === 'ok',
      foreignKeyErrorCount: foreignKeyErrors.length,
      missingLegacyTables: expectedLegacyTables.filter((table) => !tableNames.has(table)),
    }),
  );
}

async function verifyDatabase(filePath: string): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  const status = await databaseFileStatus(resolvedPath);
  if (!status.exists || status.sizeBytes === 0) {
    throw new Error(`Snapshot SQLite ausente ou vazio: ${resolvedPath}`);
  }

  const snapshot = new PrismaClient({ datasourceUrl: sqliteFileUrl(resolvedPath) });
  try {
    const integrity = await snapshot.$queryRawUnsafe<IntegrityRow[]>('PRAGMA integrity_check');
    const foreignKeyErrors = await snapshot.$queryRawUnsafe<Record<string, unknown>[]>(
      'PRAGMA foreign_key_check',
    );
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
      throw new Error(`integrity_check falhou: ${JSON.stringify(integrity)}`);
    }
    if (foreignKeyErrors.length > 0) {
      throw new Error(`foreign_key_check encontrou ${foreignKeyErrors.length} erro(s)`);
    }
  } finally {
    await snapshot.$disconnect();
  }
}

async function verifyStorage(snapshotPath: string, storagePath: string): Promise<number> {
  const resolvedSnapshotPath = path.resolve(snapshotPath);
  const resolvedStoragePath = path.resolve(storagePath);
  await verifyDatabase(resolvedSnapshotPath);

  const storagePrefix = `${resolvedStoragePath}${path.sep}`;
  const snapshot = new PrismaClient({ datasourceUrl: sqliteFileUrl(resolvedSnapshotPath) });
  try {
    const media = await snapshot.$queryRawUnsafe<MediaStorageRow[]>(
      'SELECT storedName FROM Media ORDER BY storedName',
    );
    const invalidPaths: string[] = [];
    const missingFiles: string[] = [];

    for (const item of media) {
      const filePath = path.resolve(resolvedStoragePath, item.storedName);
      if (!filePath.startsWith(storagePrefix)) {
        invalidPaths.push(item.storedName);
        continue;
      }

      const status = await databaseFileStatus(filePath);
      if (!status.exists) {
        missingFiles.push(item.storedName);
      }
    }

    if (invalidPaths.length > 0) {
      throw new Error(
        `O snapshot contem ${invalidPaths.length} storedName(s) fora do storage: ${invalidPaths.slice(0, 5).join(', ')}`,
      );
    }
    if (missingFiles.length > 0) {
      throw new Error(
        `O staging nao contem ${missingFiles.length} arquivo(s) referenciado(s) no snapshot: ${missingFiles.slice(0, 5).join(', ')}`,
      );
    }

    return media.length;
  } finally {
    await snapshot.$disconnect();
  }
}

async function createBackup(prisma: PrismaClient, destination: string): Promise<void> {
  const sourcePath = configuredDatabasePath();
  const resolvedDestination = path.resolve(destination);
  await assertDatabaseFile(sourcePath);

  if (sourcePath.toLowerCase() === resolvedDestination.toLowerCase()) {
    throw new Error('O snapshot nao pode sobrescrever o banco em uso');
  }
  if ((await databaseFileStatus(resolvedDestination)).exists) {
    throw new Error(`O destino do snapshot ja existe: ${resolvedDestination}`);
  }

  const escapedDestination = escapeSqlitePath(resolvedDestination);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedDestination}'`);
  await verifyDatabase(resolvedDestination);
  process.stdout.write(JSON.stringify({ backup: resolvedDestination, verified: true }));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'location') {
    const databasePath = configuredDatabasePath();
    process.stdout.write(
      JSON.stringify({ databasePath, ...(await databaseFileStatus(databasePath)) }),
    );
    return;
  }

  if (command === 'inspect' || command === 'backup') {
    const databasePath = configuredDatabasePath();
    await assertDatabaseFile(databasePath);
    const prisma = new PrismaClient();
    try {
      if (command === 'inspect') {
        await inspectDatabase(prisma);
        return;
      }

      const destination = process.argv[3];
      if (!destination) {
        throw new Error('Informe o caminho de destino do snapshot');
      }
      await createBackup(prisma, destination);
      return;
    } finally {
      await prisma.$disconnect();
    }
  }

  if (command === 'verify') {
    const filePath = process.argv[3];
    if (!filePath) {
      throw new Error('Informe o caminho do banco a validar');
    }
    await verifyDatabase(filePath);
    process.stdout.write(JSON.stringify({ database: path.resolve(filePath), verified: true }));
    return;
  }

  if (command === 'verify-storage') {
    const snapshotPath = process.argv[3];
    const storagePath = process.argv[4];
    if (!snapshotPath || !storagePath) {
      throw new Error('Informe os caminhos do snapshot e do storage a validar');
    }
    const mediaCount = await verifyStorage(snapshotPath, storagePath);
    process.stdout.write(
      JSON.stringify({
        database: path.resolve(snapshotPath),
        storage: path.resolve(storagePath),
        mediaCount,
        verified: true,
      }),
    );
    return;
  }

  throw new Error('Comando esperado: location, inspect, backup, verify ou verify-storage');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

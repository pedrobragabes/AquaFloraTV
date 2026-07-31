import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedTargets = new Set(
  ['apps/api/dist', 'packages/types/dist'].map((target) =>
    path.resolve(repositoryRoot, target).toLowerCase(),
  ),
);
const target = path.resolve(process.cwd(), 'dist');

if (!allowedTargets.has(target.toLowerCase())) {
  throw new Error(`Recusa limpar diretorio inesperado: ${target}`);
}

await rm(target, { recursive: true, force: true });

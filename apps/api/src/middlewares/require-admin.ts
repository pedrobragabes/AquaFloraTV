import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!provided || !safeEqual(provided, env.API_ADMIN_TOKEN)) {
    next(new HttpError(401, 'UNAUTHORIZED', 'Admin token inválido ou ausente'));
    return;
  }

  next();
}

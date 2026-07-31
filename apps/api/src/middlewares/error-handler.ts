import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { HttpError } from '../utils/http-error.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'NOT_FOUND', 'Rota não encontrada'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Verifique os dados informados',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(statusCode).json({
      error: {
        code: `UPLOAD_${err.code}`,
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'O arquivo é maior que o limite permitido'
            : 'Não foi possível receber o arquivo',
        details: err.field ? { field: err.field } : {},
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = err.code === 'P2025' ? 404 : err.code === 'P2003' ? 409 : 400;
    console.error('Prisma request failed', { code: err.code, meta: err.meta });
    res.status(statusCode).json({
      error: {
        code: `PRISMA_${err.code}`,
        message: 'Não foi possível concluir a operação no banco de dados',
        details: {},
      },
    });
    return;
  }

  console.error('Unhandled request error', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno inesperado',
      details: {},
    },
  });
}

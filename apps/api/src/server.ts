import cors from 'cors';
import type { CorsOptions } from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

const corsOptions: CorsOptions =
  env.NODE_ENV !== 'production' && env.ALLOWED_ORIGINS.includes('*')
    ? {
        origin: true,
      }
    : {
        origin: env.ALLOWED_ORIGINS,
        credentials: true,
      };

app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors(corsOptions));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  let logged = false;

  const logRequest = () => {
    if (logged) {
      return;
    }
    logged = true;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const url = (req.originalUrl || req.url).replace(
      /([?&](?:token|authorization)=)[^&]+/gi,
      '$1[REDACTED]',
    );

    process.stdout.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        url,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
        remoteAddress: req.ip,
        userAgent: req.header('user-agent') ?? null,
      })}\n`,
    );
  };

  res.once('finish', logRequest);
  res.once('close', logRequest);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

app.use('/storage', express.static(env.STORAGE_PATH));
app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

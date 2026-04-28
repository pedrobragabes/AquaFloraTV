import cors from 'cors';
import type { CorsOptions } from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { apiRouter } from './routes/index.js';
import { startMediaCleanupJob } from './services/media-cleanup.js';

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
app.set('trust proxy', 1);

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

morgan.token('safe-url', (req) => {
  const url =
    (req as { originalUrl?: string; url?: string }).originalUrl ??
    (req as { url?: string }).url ??
    '';
  return url.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');
});

const morganFormat =
  env.NODE_ENV === 'production'
    ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
    : ':method :safe-url :status :response-time ms - :res[content-length]';

app.use(morgan(morganFormat));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

app.use('/storage', express.static(env.STORAGE_PATH));
app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

if (env.NODE_ENV !== 'test') {
  startMediaCleanupJob();
}

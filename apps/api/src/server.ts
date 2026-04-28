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

const corsOptions: CorsOptions = env.ALLOWED_ORIGINS.includes('*')
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
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

import { Router } from 'express';

import { requireAdmin } from '../middlewares/require-admin.js';

import { appReleasesRouter } from './app-releases.js';
import { authRouter } from './auth.js';
import { devicesRouter } from './devices.js';
import { healthRouter } from './health.js';
import { mediaRouter } from './media.js';
import { playlistsRouter } from './playlists.js';
import { schedulesRouter } from './schedules.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'AquaTV API',
    status: 'online',
  });
});

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/media', requireAdmin, mediaRouter);
apiRouter.use('/playlists', requireAdmin, playlistsRouter);
apiRouter.use('/schedules', requireAdmin, schedulesRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/app', appReleasesRouter);

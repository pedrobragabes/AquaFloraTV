import { Router } from 'express';

import { appReleasesRouter } from './app-releases.js';
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
apiRouter.use('/media', mediaRouter);
apiRouter.use('/playlists', playlistsRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/app', appReleasesRouter);

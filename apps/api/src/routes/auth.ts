import { Router } from 'express';

export const authRouter = Router();

authRouter.get('/session', (_req, res) => {
  res.status(501).json({
    error: {
      code: 'AUTH_NOT_IMPLEMENTED',
      message: 'Auth session endpoint will be implemented in dashboard/auth phase.',
      details: {},
    },
  });
});

authRouter.get('/signin/google', (_req, res) => {
  res.status(501).json({
    error: {
      code: 'AUTH_NOT_IMPLEMENTED',
      message: 'Google sign-in integration is pending.',
      details: {},
    },
  });
});

authRouter.post('/signout', (_req, res) => {
  res.status(204).send();
});

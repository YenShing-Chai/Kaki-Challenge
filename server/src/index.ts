import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { challengesRouter } from './routes/challenges';
import { stepsRouter } from './routes/steps';
import { paymentsRouter } from './routes/payments';
import { adminRouter } from './routes/admin';
import { categoriesRouter } from './routes/categories';
import { cheersRouter } from './routes/cheers';
import { authRouter } from './routes/auth';
import { startDailyResolutionCron } from './jobs/dailyResolution';
import { startPushCron } from './jobs/pushNotifications';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/', (_req, res) => {
  res.json({
    name: 'kaki-api',
    status: 'ok',
    docs: 'No public docs yet. Endpoints: /health, /auth/{signin,signup}, /users/*, /challenges/*, /steps/*, /payments/*, /categories, /daily-progress/:id/cheer',
  });
});

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/challenges', challengesRouter);
app.use('/steps', stepsRouter);
app.use('/payments', paymentsRouter);
app.use('/admin', adminRouter);
app.use('/categories', categoriesRouter);
app.use(cheersRouter); // /daily-progress/:id/cheer (no shared prefix)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal error';
  console.error('[ERROR]', message);
  res.status(500).json({ error: 'internal_error', message });
});

startDailyResolutionCron();
startPushCron();

const port = Number(process.env.PORT ?? 3456);
app.listen(port, () => {
  console.log(`[kaki] listening on http://localhost:${port}`);
});

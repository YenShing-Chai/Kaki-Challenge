import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const userKey = (req: Request): string => req.auth?.userId ?? req.ip ?? 'anon';

export const joinChallengeLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: 'rate_limited', message: 'Too many join attempts. Wait a minute.' },
});

export const stepsSyncLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: 'rate_limited', message: 'Slow down on the step syncs.' },
});

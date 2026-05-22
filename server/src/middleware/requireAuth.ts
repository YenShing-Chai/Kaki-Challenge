import type { NextFunction, Request, Response } from 'express';

import { verifyJwt } from '../lib/jwt';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing bearer token' });
    return;
  }
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
    return;
  }
  req.auth = { userId: payload.sub };
  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (token) {
    const payload = verifyJwt(token);
    if (payload) req.auth = { userId: payload.sub };
  }
  next();
}

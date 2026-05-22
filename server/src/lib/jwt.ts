import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn('[kaki] JWT_SECRET not set — auth routes will reject every request.');
}

// 30-day session window. Long enough for a side-project; we don't have refresh
// tokens yet so anything shorter than ~1 week feels hostile.
const EXPIRES_IN = '30d';

export type JwtPayload = { sub: string };

export function signJwt(userId: string): string {
  if (!SECRET) throw new Error('JWT_SECRET missing');
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyJwt(token: string): JwtPayload | null {
  if (!SECRET) return null;
  try {
    const decoded = jwt.verify(token, SECRET) as { sub?: unknown };
    if (typeof decoded.sub !== 'string') return null;
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('No authorization header provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  // Read JWT_SECRET at runtime - validated at startup, so this should never be undefined
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    logger.error('JWT_SECRET is not set - this should have been caught at startup');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify JWT token with the same secret as Core API
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Attach user info to request
    (req as any).user = decoded;
    return next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}


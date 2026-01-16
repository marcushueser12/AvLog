import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware to verify Supabase JWT token and extract user info
 */
export const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.userId = user.id;
    req.userEmail = user.email;
    
    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to verify admin secret token
 */
export const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  const adminToken = req.headers['x-admin-token'] as string;
  const secretToken = process.env.ADMIN_SECRET_TOKEN;

  if (!secretToken) {
    console.error('ADMIN_SECRET_TOKEN is not set in environment variables');
    return res.status(500).json({ error: 'Admin functionality is not configured' });
  }

  if (!adminToken || adminToken !== secretToken) {
    return res.status(403).json({ error: 'Unauthorized - Invalid admin token' });
  }

  next();
};

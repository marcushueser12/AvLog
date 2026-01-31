import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { optionalAuth, verifyAuth, AuthRequest } from '../middleware/auth.js';
import { validateAndSanitizeBody } from '../middleware/validation.js';

const router = express.Router();

// GET /api/support/tickets - Get current user's support tickets (requires auth)
router.get('/support/tickets', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { data, error } = await supabaseAdmin
      .from('support_requests')
      .select('id, request_type, subject, message, status, admin_response, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.json({ tickets: [] });
      }
      throw error;
    }
    res.json({ tickets: data || [] });
  } catch (err: any) {
    console.error('Error fetching support tickets:', err);
    res.status(500).json({
      error: 'Failed to fetch your tickets',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }
});

// POST /api/support - Submit a support or feature request (auth optional)
router.post(
  '/support',
  optionalAuth,
  validateAndSanitizeBody({
    requestType: {
      type: 'string',
      required: true,
      validate: (v: string) => (v === 'support' || v === 'feature' ? true : 'requestType must be support or feature'),
    },
    subject: { type: 'string', required: true, maxLength: 200 },
    message: { type: 'text', required: true, maxLength: 2000 },
  }),
  async (req: AuthRequest, res) => {
    try {
      const { requestType, subject, message } = req.body;

      const { data, error } = await supabaseAdmin
        .from('support_requests')
        .insert({
          user_id: req.userId || null,
          user_email: req.userEmail || null,
          request_type: requestType,
          subject: subject.trim(),
          message: message.trim(),
          status: 'open',
        })
        .select('id')
        .single();

      if (error) {
        // Table doesn't exist (404) or other PostgREST error
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.error('support_requests table not found. Run supabase/migration_support_requests.sql');
          return res.status(503).json({
            error: 'Support requests are temporarily unavailable. Please try again later or contact us directly.',
          });
        }
        throw error;
      }

      res.status(201).json({ success: true, id: data?.id });
    } catch (err: any) {
      console.error('Error submitting support request:', err);
      res.status(500).json({
        error: 'Failed to submit request. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: err.message }),
      });
    }
  }
);

export default router;

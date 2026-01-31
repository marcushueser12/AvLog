import express from 'express';
import { verifyAdmin, verifyAuth, AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { validateAndSanitizeBody, validateParams } from '../middleware/validation.js';

const router = express.Router();

/**
 * POST /api/admin/grant-credits
 * Grant credits to a user (admin only)
 * Requires: x-admin-token header
 * Body: { userEmail: string, amount: number, reason?: string }
 */
router.post(
  '/grant-credits',
  verifyAdmin,
  validateAndSanitizeBody({
    userEmail: { type: 'email', required: true },
    amount: { type: 'number', required: true, min: 0.01, max: 1000000 },
    reason: { type: 'text', required: false, maxLength: 500 },
  }),
  async (req, res) => {
  try {
    const { userEmail, amount, reason } = req.body;

    // Find user by email using admin API - list users and filter by email
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return res.status(500).json({ error: 'Failed to find user' });
    }

    const user = users?.users?.find(u => u.email === userEmail);
    
    if (!user) {
      return res.status(404).json({ error: `User not found: ${userEmail}` });
    }

    const userId = user.id;

    // Get or create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    const currentCredits = profile?.credits || 0;
    const newCredits = currentCredits + amount;

    // Update credits
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: userId,
        credits: newCredits,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return res.status(500).json({ error: 'Failed to update credits' });
    }

    // Log transaction
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'manual_grant',
        description: reason || `Manual grant by admin`
      });

    if (transactionError) {
      console.error('Error logging transaction:', transactionError);
      // Don't fail the request if logging fails, but log it
    }

    res.json({
      success: true,
      userEmail,
      previousBalance: currentCredits,
      creditsGranted: amount,
      newBalance: newCredits,
      message: `Successfully granted ${amount} credits to ${userEmail}`
    });
  } catch (error: any) {
    console.error('Admin grant credits error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
  }
);

/**
 * GET /api/admin/user-credits/:email
 * Get credits for a user (admin only)
 */
router.get(
  '/user-credits/:email',
  verifyAdmin,
  validateParams({ email: 'string' }),
  async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Find user by email - list users and filter by email
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return res.status(500).json({ error: 'Failed to find user' });
    }

    const user = users?.users?.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: `User not found: ${email}` });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('credits, plan_type')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      email,
      credits: profile?.credits || 0,
      planType: profile?.plan_type || 'free'
    });
  } catch (error: any) {
    console.error('Admin get credits error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
  }
);

/**
 * GET /api/admin/check
 * Check if authenticated user is admin
 * Uses BOTH database (user_profiles.is_admin) AND ADMIN_EMAILS - either grants admin
 */
router.get('/check', verifyAuth, async (req: any, res) => {
  try {
    const userId = req.userId!;
    const userEmail = (req.userEmail || '').toLowerCase().trim();

    // Method 1: Check ADMIN_EMAILS env var (redundant path, no DB needed)
    const adminEmailsRaw = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);
    const fromEmailList = userEmail && adminEmails.includes(userEmail);

    // Method 2: Check user_profiles.is_admin in database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .maybeSingle();

    const rawIsAdmin = profile?.is_admin;
    const fromDatabase = !!(
      !profileError &&
      profile &&
      (rawIsAdmin === true || rawIsAdmin === 'true' || rawIsAdmin === 't')
    );

    const isAdmin = fromEmailList || fromDatabase;

    if (process.env.NODE_ENV === 'development') {
      console.log('Admin check:', {
        userId,
        userEmail: req.userEmail,
        isAdmin,
        fromEmailList,
        fromDatabase,
        rawIsAdmin,
        profileError: profileError?.message
      });
    }

    res.json({ isAdmin });
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

/**
 * POST /api/admin/approve-review
 * Approve or reject a review (admin only)
 * Requires: authenticated user + admin email OR admin token
 * Body: { reviewId: string, approve: boolean }
 */
router.post(
  '/approve-review',
  verifyAuth,
  validateAndSanitizeBody({
    reviewId: { type: 'id', required: true },
    approve: { type: 'boolean', required: true },
  }),
  async (req: any, res) => {
  try {
    const userId = req.userId!;
    
    // Check database for is_admin flag first
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    
    let isAdmin = false;
    
    if (profile) {
      isAdmin = profile.is_admin || false;
    } else {
      // Fallback to email list check
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(e => e) || [];
      const userEmail = (req.userEmail || '').toLowerCase().trim();
      isAdmin = adminEmails.includes(userEmail);
    }
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Unauthorized - Admin access required' });
    }
    
    const { reviewId, approve } = req.body;

    const { error } = await supabaseAdmin
      .from('reviews')
      .update({ 
        approved: approve,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error updating review:', error);
      return res.status(500).json({ error: 'Failed to update review' });
    }

    res.json({
      success: true,
      reviewId,
      approved: approve,
      message: `Review ${approve ? 'approved' : 'rejected'} successfully`
    });
  } catch (error: any) {
    console.error('Admin approve review error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
  }
);

/** Helper to check if user is admin - uses BOTH database and ADMIN_EMAILS */
const checkIsAdmin = async (req: AuthRequest): Promise<boolean> => {
  const userId = req.userId!;
  const userEmail = (req.userEmail || '').toLowerCase().trim();

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(e => e) || [];
  if (userEmail && adminEmails.includes(userEmail)) return true;

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();
  const raw = profile?.is_admin;
  return !!(raw === true || raw === 'true' || raw === 't');
};

/**
 * GET /api/admin/support-tickets
 * List all support tickets (admin only)
 * Query: status (optional) - filter by open, in_progress, resolved, closed
 */
router.get('/support-tickets', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!(await checkIsAdmin(req))) {
      return res.status(403).json({ error: 'Unauthorized - Admin access required' });
    }
    const status = req.query.status as string | undefined;
    let query = supabaseAdmin
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ tickets: data || [] });
  } catch (error: any) {
    console.error('Admin support tickets list error:', error);
    res.status(500).json({
      error: 'Failed to fetch support tickets',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
});

/**
 * POST /api/admin/support-tickets/:id/respond
 * Add admin response to a support ticket (admin only)
 * Body: { response: string, internalNotes?: string }
 */
router.post(
  '/support-tickets/:id/respond',
  verifyAuth,
  validateParams({ id: 'id' }),
  validateAndSanitizeBody({
    response: { type: 'text', required: true, maxLength: 5000 },
    internalNotes: { type: 'text', required: false, maxLength: 2000 },
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!(await checkIsAdmin(req))) {
        return res.status(403).json({ error: 'Unauthorized - Admin access required' });
      }
      const { id } = req.params;
      const { response, internalNotes } = req.body;
      const update: Record<string, unknown> = { admin_response: response };
      if (internalNotes !== undefined && internalNotes !== null) {
        update.admin_notes = internalNotes;
      }
      const { data, error } = await supabaseAdmin
        .from('support_requests')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket: data });
    } catch (error: any) {
      console.error('Admin respond to ticket error:', error);
      res.status(500).json({
        error: 'Failed to respond to ticket',
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      });
    }
  }
);

/**
 * POST /api/admin/support-tickets/:id/status
 * Update support ticket status (admin only)
 * Body: { status: 'open' | 'in_progress' | 'resolved' | 'closed' }
 */
router.post(
  '/support-tickets/:id/status',
  verifyAuth,
  validateParams({ id: 'id' }),
  validateAndSanitizeBody({
    status: {
      type: 'string',
      required: true,
      validate: (v: string) =>
        ['open', 'in_progress', 'resolved', 'closed'].includes(v)
          ? true
          : 'status must be open, in_progress, resolved, or closed',
    },
  }),
  async (req: AuthRequest, res) => {
    try {
      if (!(await checkIsAdmin(req))) {
        return res.status(403).json({ error: 'Unauthorized - Admin access required' });
      }
      const { id } = req.params;
      const { status } = req.body;
      const { data, error } = await supabaseAdmin
        .from('support_requests')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket: data });
    } catch (error: any) {
      console.error('Admin update ticket status error:', error);
      res.status(500).json({
        error: 'Failed to update ticket status',
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      });
    }
  }
);

export default router;

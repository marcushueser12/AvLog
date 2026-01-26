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
 * Uses admin email list (can be moved to env var or database)
 */
router.get('/check', verifyAuth, async (req: any, res) => {
  try {
    const userId = req.userId!;
    
    // First, check database for is_admin flag (preferred method)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    
    let isAdmin = false;
    
    if (!profileError && profile) {
      // Use database is_admin flag if profile exists
      isAdmin = profile.is_admin || false;
    } else {
      // Fallback to email list check if profile doesn't exist or doesn't have is_admin set
      const adminEmailsRaw = process.env.ADMIN_EMAILS || '';
      const adminEmails = adminEmailsRaw
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
      
      const userEmail = (req.userEmail || '').toLowerCase().trim();
      isAdmin = adminEmails.includes(userEmail);
    }
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin check:', {
        userId,
        userEmail: req.userEmail,
        isAdmin,
        fromDatabase: !profileError && profile ? profile.is_admin : null,
        fromEmailList: profileError ? 'checked' : 'not checked'
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
    // Verify admin access - only check email (admin token should never be client-side)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(e => e) || [];
    const isAdminByEmail = adminEmails.includes(req.userEmail || '');
    
    if (!isAdminByEmail) {
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

export default router;

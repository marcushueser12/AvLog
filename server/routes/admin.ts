import express from 'express';
import { verifyAdmin } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

/**
 * POST /api/admin/grant-credits
 * Grant credits to a user (admin only)
 * Requires: x-admin-token header
 * Body: { userEmail: string, amount: number, reason?: string }
 */
router.post('/grant-credits', verifyAdmin, async (req, res) => {
  try {
    const { userEmail, amount, reason } = req.body;

    if (!userEmail || typeof amount !== 'number') {
      return res.status(400).json({ 
        error: 'Missing required fields: userEmail and amount' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be a positive number' 
      });
    }

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
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/admin/user-credits/:email
 * Get credits for a user (admin only)
 */
router.get('/user-credits/:email', verifyAdmin, async (req, res) => {
  try {
    const { email } = req.params;

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
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/admin/check
 * Check if authenticated user is admin
 * Uses admin email list (can be moved to env var or database)
 */
router.get('/check', verifyAuth, async (req: any, res) => {
  try {
    // Option 1: Check against admin email list
    // TODO: Move this to environment variable or database for better security
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [
      // Add your admin email(s) here, or set ADMIN_EMAILS env var (comma-separated)
      // Example: 'admin@logextract.co'
    ];
    
    const isAdmin = adminEmails.includes(req.userEmail || '');
    
    // Option 2: Check user_profiles.is_admin field (if you add it)
    // Uncomment this if you add is_admin column to user_profiles:
    /*
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', req.userId)
      .single();
    
    const isAdmin = profile?.is_admin || false;
    */
    
    res.json({ isAdmin });
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

/**
 * POST /api/admin/approve-review
 * Approve or reject a review (admin only)
 * Body: { reviewId: string, approve: boolean }
 */
router.post('/approve-review', verifyAdmin, async (req, res) => {
  try {
    const { reviewId, approve } = req.body;

    if (!reviewId || typeof approve !== 'boolean') {
      return res.status(400).json({ 
        error: 'Missing required fields: reviewId and approve' 
      });
    }

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
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

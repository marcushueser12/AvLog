import express from 'express';
import Stripe from 'stripe';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Pricing tiers configuration
const PRICING_TIERS = {
  private: {
    name: 'Private Pack',
    price: 800, // $8.00 in cents
    credits: 10,
    description: 'Perfect for personal logbook digitization'
  },
  commercial: {
    name: 'Commercial Pack',
    price: 6500, // $65.00 in cents
    credits: 100,
    description: 'Ideal for commercial pilots and flight schools'
  },
  atp: {
    name: 'ATP Pack',
    price: 15000, // $150.00 in cents
    credits: 300,
    description: 'Best value for ATP and professional pilots'
  }
};

/**
 * POST /api/payments/create-checkout-session
 * Create a Stripe Checkout Session for credit purchase
 * Requires: Authorization Bearer token
 * Body: { packageType: 'private' | 'commercial' | 'atp' }
 */
router.post('/create-checkout-session', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const userEmail = req.userEmail!;
    const { packageType } = req.body;

    if (!packageType || !PRICING_TIERS[packageType as keyof typeof PRICING_TIERS]) {
      return res.status(400).json({ 
        error: 'Invalid package type. Must be: private, commercial, or atp' 
      });
    }

    const tier = PRICING_TIERS[packageType as keyof typeof PRICING_TIERS];
    const baseUrl = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:5173';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: tier.name,
              description: `${tier.credits} credits - ${tier.description}`,
            },
            unit_amount: tier.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-canceled`,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        userEmail: userEmail,
        packageType: packageType,
        credits: tier.credits.toString(),
      },
      // Enable automatic tax calculation if needed
      automatic_tax: {
        enabled: false,
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create checkout session' 
    });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook endpoint to handle payment events
 * This endpoint is called by Stripe, not your frontend
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Extract metadata
      const userId = session.metadata?.userId;
      const userEmail = session.metadata?.userEmail;
      const credits = parseInt(session.metadata?.credits || '0', 10);
      const packageType = session.metadata?.packageType;

      if (!userId || !userEmail || !credits || credits <= 0) {
        console.error('Missing required metadata in checkout session:', {
          userId,
          userEmail,
          credits,
          packageType
        });
        return res.status(400).json({ error: 'Missing required metadata' });
      }

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        console.error('Payment not completed:', session.payment_status);
        return res.status(400).json({ error: 'Payment not completed' });
      }

      // Check if credits were already granted (idempotency check)
      // We'll use the session ID as a unique identifier
      const { data: existingTransaction } = await supabaseAdmin
        .from('credit_transactions')
        .select('id')
        .eq('description', `Stripe payment: ${session.id}`)
        .single();

      if (existingTransaction) {
        console.log('Credits already granted for session:', session.id);
        return res.json({ received: true, message: 'Credits already granted' });
      }

      // Get current credits
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('credits')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      const currentCredits = profile?.credits || 0;
      const newCredits = currentCredits + credits;

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
        throw new Error('Failed to update credits');
      }

      // Log transaction
      const { error: transactionError } = await supabaseAdmin
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: credits,
          type: 'stripe_purchase',
          description: `Stripe payment: ${session.id} - ${packageType} pack`
        });

      if (transactionError) {
        console.error('Error logging transaction:', transactionError);
        // Don't fail the webhook if logging fails
      }

      console.log(`Successfully granted ${credits} credits to ${userEmail} (${userId}) via Stripe payment ${session.id}`);
      
      res.json({ 
        received: true, 
        message: `Successfully granted ${credits} credits`,
        userId,
        creditsGranted: credits,
        newBalance: newCredits
      });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      // Still return 200 to prevent Stripe from retrying
      res.status(200).json({ 
        received: true, 
        error: error.message,
        message: 'Webhook received but processing failed. Check logs.'
      });
    }
  } else {
    // Log other events for debugging
    console.log('Unhandled webhook event type:', event.type);
    res.json({ received: true });
  }
});

export default router;

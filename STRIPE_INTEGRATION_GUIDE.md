# Stripe Payment Integration Guide

This guide explains how to integrate Stripe payments for purchasing credits in LogExtract.

## Overview

The integration uses **Stripe Checkout** (prebuilt hosted payment pages) for secure, PCI-compliant credit purchases. Users can buy credits through three pricing tiers:

- **Private Pack**: $8 for 10 credits
- **Commercial Pack**: $65 for 100 credits  
- **ATP Pack**: $150 for 300 credits

---

## Prerequisites

1. **Stripe Account**: Create an account at [stripe.com](https://stripe.com)
2. **API Keys**: Get your Stripe API keys from the Stripe Dashboard
3. **Backend Access**: Ability to set environment variables on Railway
4. **Webhook Endpoint**: Public URL for Stripe to send payment notifications

---

## Step 1: Set Up Stripe Account

### 1.1 Create Stripe Account

1. Go to [https://stripe.com](https://stripe.com)
2. Click **"Sign up"** or **"Start now"**
3. Complete account setup (email verification, business details)
4. Verify your email address

### 1.2 Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **"Developers"** → **"API keys"**
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

**Important:**
- Use **Test mode** keys (`pk_test_`, `sk_test_`) for development
- Use **Live mode** keys (`pk_live_`, `sk_live_`) for production
- Toggle between modes using the toggle in the top right of the dashboard

### 1.3 Set Up Webhook Endpoint

1. In Stripe Dashboard, go to **"Developers"** → **"Webhooks"**
2. Click **"Add endpoint"**
3. Enter your webhook URL: `https://your-backend-url.railway.app/api/payments/webhook`
4. Select events to listen for:
   - `checkout.session.completed` (required)
   - `payment_intent.succeeded` (optional, for additional verification)
5. Click **"Add endpoint"**
6. **Copy the webhook signing secret** (starts with `whsec_`) - you'll need this!

---

## Step 2: Configure Backend Environment Variables

### On Railway (Backend Service)

1. Go to [Railway Dashboard](https://railway.app)
2. Select your backend service
3. Click **"Variables"** tab
4. Add these environment variables:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... (from webhook endpoint)
```

5. Click **"Add"** for each variable
6. **Important**: Redeploy your service after adding variables

### For Local Development

Add to your `.env` file:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Step 3: Install Stripe Package

The Stripe package is already added to `package.json`. If you need to install manually:

```bash
cd /path/to/your/project
npm install stripe
```

---

## Step 4: Test the Integration

### 4.1 Test Mode

1. Use test API keys (`sk_test_...`)
2. Use test card numbers from [Stripe Testing](https://stripe.com/docs/testing):
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - Use any future expiry date, any 3-digit CVC, any ZIP

### 4.2 Test Flow

1. Sign in to your app
2. Click "Buy Credits" button
3. Select a pricing tier
4. You'll be redirected to Stripe Checkout
5. Use test card: `4242 4242 4242 4242`
6. Complete payment
7. You should be redirected back and see credits added

### 4.3 Verify Webhook

1. In Stripe Dashboard → **"Webhooks"**
2. Click on your webhook endpoint
3. View **"Events"** tab
4. You should see `checkout.session.completed` events
5. Click on an event to see the payload

---

## Step 5: Go Live (Production)

### 5.1 Switch to Live Mode

1. In Stripe Dashboard, toggle from **"Test mode"** to **"Live mode"**
2. Get your **live API keys** (starts with `pk_live_`, `sk_live_`)
3. Update Railway environment variables:
   - `STRIPE_SECRET_KEY` = your live secret key
4. Create a **live webhook endpoint**:
   - URL: `https://your-production-backend.railway.app/api/payments/webhook`
   - Copy the **live webhook secret**
   - Update `STRIPE_WEBHOOK_SECRET` in Railway

### 5.2 Update Frontend (if using publishable key)

If you're using Stripe Elements (not needed for Checkout), update:
- `VITE_STRIPE_PUBLISHABLE_KEY` = your live publishable key

### 5.3 Test with Real Card

1. Use a real card with a small amount ($8)
2. Verify payment processes correctly
3. Check credits are granted
4. Verify webhook events in Stripe Dashboard

---

## API Endpoints

### POST /api/payments/create-checkout-session

Creates a Stripe Checkout Session for credit purchase.

**Headers:**
- `Authorization: Bearer <user-token>` (required)
- `Content-Type: application/json`

**Body:**
```json
{
  "packageType": "private" | "commercial" | "atp",
  "userEmail": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Error Responses:**
- `401`: Not authenticated
- `400`: Invalid package type
- `500`: Stripe API error

### POST /api/payments/webhook

Stripe webhook endpoint (called by Stripe, not your frontend).

**Headers:**
- `stripe-signature`: Stripe webhook signature (automatically sent)

**Body:** Stripe event payload (automatically sent)

**Response:** Always returns `200 OK` (even if processing fails, to prevent retries)

---

## Pricing Tiers

| Package | Price | Credits | Price per Credit |
|---------|-------|---------|------------------|
| Private Pack | $8 | 10 | $0.80 |
| Commercial Pack | $65 | 100 | $0.65 |
| ATP Pack | $150 | 300 | $0.50 |

---

## How It Works

### Payment Flow

1. **User clicks "Buy Credits"**
   - Frontend calls `/api/payments/create-checkout-session`
   - Backend creates Stripe Checkout Session
   - Returns checkout URL

2. **User redirected to Stripe**
   - Stripe hosts secure payment page
   - User enters payment details
   - Stripe processes payment

3. **Payment succeeds**
   - Stripe redirects user back to your app
   - Stripe sends webhook to `/api/payments/webhook`
   - Backend verifies webhook signature
   - Backend grants credits using admin endpoint
   - User sees updated credit balance

### Security Features

- ✅ **PCI Compliance**: Stripe handles all card data
- ✅ **Webhook Verification**: All webhooks verified with signature
- ✅ **Idempotency**: Prevents duplicate credit grants
- ✅ **User Verification**: Only authenticated users can purchase
- ✅ **Email Matching**: Credits granted to correct user account

---

## Troubleshooting

### Payment succeeds but credits not granted

**Possible causes:**
- Webhook not configured correctly
- Webhook secret mismatch
- Webhook endpoint not accessible
- Backend error during credit grant

**Solution:**
1. Check Stripe Dashboard → Webhooks → Events
2. Look for `checkout.session.completed` events
3. Check if webhook calls are successful (green) or failed (red)
4. Check backend logs for errors
5. Verify `STRIPE_WEBHOOK_SECRET` matches webhook endpoint secret

### "Invalid API Key" error

**Possible causes:**
- Wrong API key (test vs live)
- API key not set in environment variables
- Extra spaces in API key

**Solution:**
1. Verify `STRIPE_SECRET_KEY` in Railway Variables
2. Check if you're using test keys in test mode
3. Ensure no extra spaces before/after the key
4. Redeploy backend after changing variables

### Webhook signature verification fails

**Possible causes:**
- Wrong webhook secret
- Webhook secret not set
- Request body modified before verification

**Solution:**
1. Get webhook secret from Stripe Dashboard → Webhooks → Your endpoint
2. Update `STRIPE_WEBHOOK_SECRET` in Railway
3. Ensure webhook endpoint uses raw body (not parsed JSON)
4. Redeploy backend

### User redirected but payment not processed

**Possible causes:**
- User closed browser before completing payment
- Payment was declined
- Network error

**Solution:**
1. Check Stripe Dashboard → Payments
2. Look for the payment attempt
3. Check payment status (succeeded, failed, canceled)
4. User can try again - Stripe Checkout sessions are one-time use

---

## Monitoring & Analytics

### Stripe Dashboard

Monitor payments in Stripe Dashboard:
- **Payments**: All payment attempts
- **Customers**: User payment history
- **Webhooks**: Webhook delivery status
- **Events**: All Stripe events

### Key Metrics to Track

- Conversion rate (sessions created vs completed)
- Average order value
- Most popular package
- Failed payment reasons
- Webhook success rate

---

## Best Practices

1. **Always verify webhook signatures** - Prevents fake webhook calls
2. **Use idempotency keys** - Prevents duplicate processing
3. **Log all transactions** - For debugging and auditing
4. **Handle edge cases** - Payment failures, partial payments, refunds
5. **Test thoroughly** - Use test mode before going live
6. **Monitor webhooks** - Set up alerts for webhook failures
7. **Keep API keys secret** - Never commit to Git
8. **Use environment variables** - Different keys for test/production

---

## Refunds & Disputes

### Processing Refunds

1. Go to Stripe Dashboard → Payments
2. Find the payment
3. Click **"Refund"**
4. Optionally grant credits back manually via admin endpoint

### Handling Disputes

1. Stripe will notify you via webhook: `charge.dispute.created`
2. Respond to dispute in Stripe Dashboard
3. Provide evidence if needed
4. Stripe will handle resolution

---

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Checkout Guide**: https://stripe.com/docs/payments/checkout
- **Stripe Webhooks**: https://stripe.com/docs/webhooks
- **Stripe Testing**: https://stripe.com/docs/testing
- **Stripe Support**: https://support.stripe.com

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│  STRIPE INTEGRATION - QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Environment Variables (Railway):                       │
│  - STRIPE_SECRET_KEY=sk_test_... or sk_live_...        │
│  - STRIPE_WEBHOOK_SECRET=whsec_...                      │
│                                                         │
│  Pricing Tiers:                                         │
│  - Private: $8 for 10 credits                          │
│  - Commercial: $65 for 100 credits                      │
│  - ATP: $150 for 300 credits                           │
│                                                         │
│  Endpoints:                                             │
│  - POST /api/payments/create-checkout-session         │
│  - POST /api/payments/webhook (Stripe calls this)     │
│                                                         │
│  Test Card: 4242 4242 4242 4242                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

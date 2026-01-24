# Domain Update Guide: logextract.co

This guide covers all the places you need to update when switching to your new domain `logextract.co`.

## 1. Railway Backend Environment Variables

Update these in your Railway project settings:

### Required Updates:
- **`ALLOWED_ORIGINS`**: 
  ```
  https://logextract.co,https://www.logextract.co
  ```
  (Add both with and without www if you plan to support both)

- **`FRONTEND_URL`**: 
  ```
  https://logextract.co
  ```
  (Used for Stripe redirects)

### Optional (if your backend URL changed):
- **`VITE_API_URL`**: Your Railway backend URL (e.g., `https://your-app.up.railway.app`)
  - Only update if your Railway backend URL changed

## 2. Vercel Frontend Environment Variables

Update these in your Vercel project settings:

### Required Updates:
- **`VITE_API_URL`**: Your Railway backend URL
  ```
  https://your-backend.up.railway.app
  ```
  (This should already be set - only change if backend URL changed)

## 3. Supabase Configuration

### 3.1 Update Site URL
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Authentication** → **URL Configuration**
4. Update **Site URL** to:
   ```
   https://logextract.co
   ```

### 3.2 Update Redirect URLs
In the same section, add these to **Redirect URLs**:
```
http://localhost:3000/auth/callback
https://logextract.co/auth/callback
https://www.logextract.co/auth/callback
```

## 4. Stripe Configuration

### 4.1 Update Webhook Endpoint (if backend URL changed)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Find your webhook endpoint
4. Update the URL to:
   ```
   https://your-backend.up.railway.app/api/payments/webhook
   ```
   (Only if your Railway backend URL changed)

### 4.2 Verify Webhook Secret
- The webhook secret (`STRIPE_WEBHOOK_SECRET`) should remain the same
- If you created a new webhook endpoint, copy the new secret and update `STRIPE_WEBHOOK_SECRET` in Railway

## 5. Vercel Domain Configuration

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Domains**
4. Add your custom domain:
   - Click **Add Domain**
   - Enter: `logextract.co`
   - Follow Vercel's instructions to configure DNS

### DNS Configuration
You'll need to add these DNS records with your domain provider:
- **A Record** or **CNAME**: Point to Vercel (they'll provide the exact values)

## 6. Testing Checklist

After updating everything, test:

- [ ] Frontend loads at `https://logextract.co`
- [ ] Can sign up for new account
- [ ] Confirmation email redirects to `https://logextract.co` (not localhost)
- [ ] Can sign in successfully
- [ ] Can upload and process scans
- [ ] Can purchase credits (Stripe checkout)
- [ ] Stripe webhook receives payment events
- [ ] Credits are granted after payment
- [ ] CORS errors don't appear in browser console

## 7. Common Issues

### Issue: CORS errors in browser console
**Solution**: Make sure `ALLOWED_ORIGINS` in Railway includes `https://logextract.co` (exact match, including protocol)

### Issue: Supabase redirects to localhost
**Solution**: Update Supabase Site URL and Redirect URLs (see section 3)

### Issue: Stripe checkout redirects to wrong URL
**Solution**: Verify `FRONTEND_URL` in Railway is set to `https://logextract.co`

### Issue: Webhook not receiving events
**Solution**: 
1. Check webhook URL in Stripe Dashboard matches your Railway backend URL
2. Verify `STRIPE_WEBHOOK_SECRET` in Railway matches the secret from Stripe

## 8. Quick Reference: All URLs to Update

| Service | Setting | New Value |
|---------|---------|-----------|
| Railway | `ALLOWED_ORIGINS` | `https://logextract.co,https://www.logextract.co` |
| Railway | `FRONTEND_URL` | `https://logextract.co` |
| Supabase | Site URL | `https://logextract.co` |
| Supabase | Redirect URLs | `https://logextract.co/auth/callback` |
| Stripe | Webhook URL | `https://your-backend.up.railway.app/api/payments/webhook` |
| Vercel | Custom Domain | `logextract.co` |

## 9. No Code Changes Required

The codebase doesn't have any hardcoded domain references. All URLs are configured through environment variables, so you only need to update:
- Railway environment variables
- Supabase settings
- Stripe webhook configuration
- Vercel domain settings

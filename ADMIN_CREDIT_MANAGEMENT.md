# Admin Credit Management Guide

This guide explains how to grant credits to user accounts using the admin secret token.

## Overview

The admin credit system allows you to grant credits to any user account by email address using a secure secret token. Credits are required for users to perform scans (1 credit per scan, whether single page or spread pair).

---

## Prerequisites

1. **Admin Secret Token**: You must have the `ADMIN_SECRET_TOKEN` environment variable set on your backend server
2. **Backend URL**: Know your backend API URL (e.g., `https://avlog-production.up.railway.app`)
3. **User Email**: The email address of the user you want to grant credits to (must match their Supabase account email)

---

## Step 1: Set Up Admin Secret Token

### On Railway (Backend)

1. Go to [Railway Dashboard](https://railway.app)
2. Select your backend service
3. Click on the **"Variables"** tab
4. Click **"New Variable"**
5. Add:
   - **Name**: `ADMIN_SECRET_TOKEN`
   - **Value**: `your-secret-token-here` (use a strong, random string)
6. Click **"Add"**
7. **Important**: Redeploy your service for the change to take effect

### Generating a Secure Token

You can generate a secure token using:

**macOS/Linux:**
```bash
openssl rand -hex 32
```

**Node.js:**
```javascript
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

**Online (recommended for one-time use):**
- Use a password generator to create a 32+ character random string
- Example: `a3f8d9e2b1c4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b`

---

## Step 2: Grant Credits to a User

### Method 1: Using cURL (Command Line)

**Basic Command:**
```bash
curl -X POST https://your-backend-url.railway.app/api/admin/grant-credits \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-secret-token-here" \
  -d '{
    "userEmail": "user@example.com",
    "amount": 10,
    "reason": "Welcome bonus"
  }'
```

**With Variables (zsh-compatible):**
```bash
# Set these variables
API_URL="https://your-backend-url.railway.app"
ADMIN_TOKEN="your-secret-token-here"
USER_EMAIL="user@example.com"
CREDIT_AMOUNT=10

# Run the command (zsh-compatible - using single quotes to avoid substitution issues)
curl -X POST "${API_URL}/api/admin/grant-credits" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d "{\"userEmail\": \"${USER_EMAIL}\", \"amount\": ${CREDIT_AMOUNT}, \"reason\": \"Welcome bonus\"}"
```

**Alternative (using printf for better zsh compatibility):**
```bash
# Set these variables
API_URL="https://your-backend-url.railway.app"
ADMIN_TOKEN="your-secret-token-here"
USER_EMAIL="user@example.com"
CREDIT_AMOUNT=10

# Build JSON using printf
JSON_BODY=$(printf '{"userEmail": "%s", "amount": %d, "reason": "Welcome bonus"}' "$USER_EMAIL" "$CREDIT_AMOUNT")

# Run the command
curl -X POST "${API_URL}/api/admin/grant-credits" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d "$JSON_BODY"
```

**Alternative (using jq - recommended if installed):**
```bash
# Set these variables
API_URL="https://your-backend-url.railway.app"
ADMIN_TOKEN="your-secret-token-here"
USER_EMAIL="user@example.com"
CREDIT_AMOUNT=10

# Build JSON using jq (most reliable)
JSON_BODY=$(jq -n \
  --arg email "$USER_EMAIL" \
  --argjson amount "$CREDIT_AMOUNT" \
  '{userEmail: $email, amount: $amount, reason: "Welcome bonus"}')

# Run the command
curl -X POST "${API_URL}/api/admin/grant-credits" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d "$JSON_BODY"
```

### Method 2: Using JavaScript/Node.js

**Save as `grant-credits.js`:**
```javascript
const fetch = require('node-fetch');

async function grantCredits(userEmail, amount, reason) {
  const API_URL = 'https://your-backend-url.railway.app';
  const ADMIN_TOKEN = 'your-secret-token-here';

  try {
    const response = await fetch(`${API_URL}/api/admin/grant-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN
      },
      body: JSON.stringify({
        userEmail: userEmail,
        amount: amount,
        reason: reason || 'Manual grant by admin'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`User: ${result.userEmail}`);
      console.log(`Previous Balance: ${result.previousBalance} credits`);
      console.log(`Credits Granted: ${result.creditsGranted}`);
      console.log(`New Balance: ${result.newBalance} credits`);
      console.log(`Message: ${result.message}`);
    } else {
      console.error('❌ Error:', result.error);
      if (result.message) {
        console.error('Details:', result.message);
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Usage
grantCredits('user@example.com', 10, 'Welcome bonus');
```

**Run it:**
```bash
node grant-credits.js
```

### Method 3: Using Python

**Save as `grant_credits.py`:**
```python
import requests
import json

def grant_credits(user_email, amount, reason=None):
    API_URL = 'https://your-backend-url.railway.app'
    ADMIN_TOKEN = 'your-secret-token-here'
    
    url = f'{API_URL}/api/admin/grant-credits'
    headers = {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN
    }
    data = {
        'userEmail': user_email,
        'amount': amount,
        'reason': reason or 'Manual grant by admin'
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if response.status_code == 200:
            print('✅ Success!')
            print(f"User: {result['userEmail']}")
            print(f"Previous Balance: {result['previousBalance']} credits")
            print(f"Credits Granted: {result['creditsGranted']}")
            print(f"New Balance: {result['newBalance']} credits")
            print(f"Message: {result['message']}")
        else:
            print('❌ Error:', result.get('error', 'Unknown error'))
            if 'message' in result:
                print('Details:', result['message'])
    except Exception as e:
        print(f'❌ Request failed: {str(e)}')

# Usage
if __name__ == '__main__':
    grant_credits('user@example.com', 10, 'Welcome bonus')
```

**Run it:**
```bash
python grant_credits.py
```

### Method 4: Using Postman/Insomnia

1. **Method**: `POST`
2. **URL**: `https://your-backend-url.railway.app/api/admin/grant-credits`
3. **Headers**:
   - `Content-Type`: `application/json`
   - `x-admin-token`: `your-secret-token-here`
4. **Body** (JSON):
   ```json
   {
     "userEmail": "user@example.com",
     "amount": 10,
     "reason": "Welcome bonus"
   }
   ```
5. Click **Send**

---

## Step 3: Check User Credits (Optional)

Before or after granting credits, you can check a user's current balance:

### Using cURL:
```bash
curl -X GET "https://your-backend-url.railway.app/api/admin/user-credits/user@example.com" \
  -H "x-admin-token: your-secret-token-here"
```

### Response:
```json
{
  "email": "user@example.com",
  "credits": 15,
  "planType": "free"
}
```

---

## Expected Response

### Success Response (200 OK):
```json
{
  "success": true,
  "userEmail": "user@example.com",
  "previousBalance": 5,
  "creditsGranted": 10,
  "newBalance": 15,
  "message": "Successfully granted 10 credits to user@example.com"
}
```

### Error Responses:

**Missing Fields (400):**
```json
{
  "error": "Missing required fields: userEmail and amount"
}
```

**Invalid Amount (400):**
```json
{
  "error": "Amount must be a positive number"
}
```

**User Not Found (404):**
```json
{
  "error": "User not found: user@example.com"
}
```

**Invalid Admin Token (403):**
```json
{
  "error": "Unauthorized - Invalid admin token"
}
```

**Token Not Set (500):**
```json
{
  "error": "Admin functionality is not configured"
}
```

---

## Troubleshooting

### Error: "Unauthorized - Invalid admin token"

**Possible causes:**
- The `x-admin-token` header is missing or incorrect
- The `ADMIN_SECRET_TOKEN` environment variable is not set on Railway
- The token in your request doesn't match the one in Railway

**Solution:**
1. Double-check the token in Railway Variables
2. Make sure you're using `x-admin-token` (not `X-Admin-Token` or other variations)
3. Verify there are no extra spaces in the token

### Error: "User not found"

**Possible causes:**
- The email address is incorrect or doesn't match the Supabase account
- The user hasn't confirmed their email yet

**Solution:**
1. Verify the email address in Supabase Auth dashboard
2. Make sure the email is confirmed in Supabase
3. Check for typos in the email address

### Error: "Admin functionality is not configured"

**Possible causes:**
- The `ADMIN_SECRET_TOKEN` environment variable is not set on Railway
- The backend hasn't been redeployed after setting the variable

**Solution:**
1. Go to Railway Variables and verify `ADMIN_SECRET_TOKEN` is set
2. Redeploy the backend service
3. Wait a few minutes for the deployment to complete

### Credits Not Showing Up

**Possible causes:**
- The user needs to refresh their browser
- The frontend credit loading is cached

**Solution:**
1. Ask the user to refresh the page or sign out and sign back in
2. Check the credit balance using the admin endpoint
3. Verify the transaction was logged in `credit_transactions` table

---

## Security Best Practices

1. **Never commit the admin token to Git**
   - Keep it only in Railway environment variables
   - Don't share it in screenshots or documentation

2. **Use a strong, random token**
   - Minimum 32 characters
   - Mix of letters, numbers, and special characters
   - Use a password generator

3. **Rotate the token periodically**
   - Change it every 3-6 months
   - Update it in Railway when rotated

4. **Restrict access**
   - Only share the token with trusted administrators
   - Consider using a password manager to store it

5. **Monitor usage**
   - Check `credit_transactions` table for all grants
   - Review logs for unauthorized access attempts

---

## Common Use Cases

### Grant Welcome Bonus
```bash
# Grant 10 credits to new users
curl -X POST "${API_URL}/api/admin/grant-credits" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d '{
    "userEmail": "newuser@example.com",
    "amount": 10,
    "reason": "Welcome bonus for new account"
  }'
```

### Refund Credits
```bash
# Grant credits as a refund
curl -X POST "${API_URL}/api/admin/grant-credits" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d '{
    "userEmail": "user@example.com",
    "amount": 5,
    "reason": "Refund for failed scan"
  }'
```

### Bulk Grant (zsh-compatible Script)

**Save as `bulk-grant.sh`:**
```bash
#!/bin/zsh

API_URL="https://your-backend-url.railway.app"
ADMIN_TOKEN="your-secret-token-here"
AMOUNT=10
REASON="Bulk grant - promotion"

# List of user emails
USERS=(
  "user1@example.com"
  "user2@example.com"
  "user3@example.com"
)

for email in "${USERS[@]}"; do
  echo "Granting ${AMOUNT} credits to ${email}..."
  
  # Build JSON using printf (zsh-compatible)
  JSON_BODY=$(printf '{"userEmail": "%s", "amount": %d, "reason": "%s"}' "$email" "$AMOUNT" "$REASON")
  
  curl -X POST "${API_URL}/api/admin/grant-credits" \
    -H "Content-Type: application/json" \
    -H "x-admin-token: ${ADMIN_TOKEN}" \
    -d "$JSON_BODY"
  
  echo ""
done

echo "Done!"
```

**Note:** If you're using bash instead of zsh, change `#!/bin/zsh` to `#!/bin/bash` and the script will work the same way.

**Run it:**
```bash
chmod +x bulk-grant.sh
./bulk-grant.sh
```

---

## API Reference

### POST /api/admin/grant-credits

Grant credits to a user account.

**Headers:**
- `Content-Type`: `application/json`
- `x-admin-token`: `string` (required) - Your admin secret token

**Body:**
```json
{
  "userEmail": "string" (required) - User's email address,
  "amount": number (required) - Positive number of credits to grant,
  "reason": "string" (optional) - Reason for granting credits
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "userEmail": "string",
  "previousBalance": number,
  "creditsGranted": number,
  "newBalance": number,
  "message": "string"
}
```

### GET /api/admin/user-credits/:email

Get current credit balance for a user.

**Headers:**
- `x-admin-token`: `string` (required) - Your admin secret token

**Response (200 OK):**
```json
{
  "email": "string",
  "credits": number,
  "planType": "string"
}
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  GRANT CREDITS - QUICK REFERENCE                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Endpoint: POST /api/admin/grant-credits               │
│  Header:   x-admin-token: <your-token>                 │
│                                                         │
│  Body:                                                 │
│  {                                                     │
│    "userEmail": "user@example.com",                    │
│    "amount": 10,                                       │
│    "reason": "Optional reason"                         │
│  }                                                     │
│                                                         │
│  Check Credits: GET /api/admin/user-credits/:email     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Support

If you encounter issues:

1. Check the Railway logs for error messages
2. Verify the environment variables are set correctly
3. Ensure the backend is deployed and running
4. Test with a known valid user email from Supabase

For more information, see:
- `SUPABASE_SETUP_DETAILED.md` - Supabase configuration
- `DEPLOYMENT.md` - Deployment instructions

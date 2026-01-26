# Admin Setup Guide

This guide explains how to set up admin accounts in Supabase for the LogExtract application.

## Method 1: Using Supabase SQL Editor (Recommended)

### Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migration_add_admin_column.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- Add the `is_admin` column to the `user_profiles` table
- Create an index for faster admin lookups

### Step 2: Set Your Account as Admin

After running the migration, set yourself as admin by running this SQL (replace with your email):

```sql
UPDATE user_profiles 
SET is_admin = true 
WHERE user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'your-email@example.com'
);
```

Or if you know your user_id:

```sql
UPDATE user_profiles 
SET is_admin = true 
WHERE user_id = 'your-user-uuid-here';
```

### Step 3: Verify Admin Status

Check that you're set as admin:

```sql
SELECT 
  u.email,
  up.is_admin,
  up.user_id
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.email = 'your-email@example.com';
```

## Method 2: Using the API Endpoint (After Initial Setup)

Once you have at least one admin account set up via Method 1, you can use the API endpoint to grant admin access to other users.

### Endpoint: `POST /api/admin/set-admin`

**Requires:**
- Authentication (Bearer token)
- The requester must already be an admin

**Body:**
```json
{
  "userEmail": "user@example.com",
  "isAdmin": true
}
```

**Example using curl:**
```bash
curl -X POST https://your-api-url.com/api/admin/set-admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userEmail": "new-admin@example.com", "isAdmin": true}'
```

## How Admin Check Works

The system checks admin status in this order:

1. **Database Check (Primary)**: Checks `user_profiles.is_admin` column
2. **Email List Fallback**: If no profile exists, checks `ADMIN_EMAILS` environment variable

This means:
- If you set `is_admin = true` in the database, you'll have admin access
- The `ADMIN_EMAILS` environment variable still works as a fallback
- Database-based admin is preferred and more secure

## Troubleshooting

### Admin dashboard not showing

1. **Check if you're logged in**: Make sure you're signed in with the correct account
2. **Verify admin status**: Run the verification SQL query above
3. **Check browser console**: Look for admin check logs in development mode
4. **Check server logs**: Look for admin check logs on the server

### "User not found" error

- Make sure the user has signed up at least once
- The user must exist in `auth.users` table
- Try using the user_id directly instead of email

### Admin status not persisting

- Make sure you ran the migration to add the `is_admin` column
- Check that the `user_profiles` table has a row for your user
- Verify the update query ran successfully

## Security Notes

- Admin status is stored in the database, not just environment variables
- Only existing admins can grant admin access to others (via API)
- The `ADMIN_EMAILS` environment variable still works as a fallback
- Admin checks are performed server-side for security

## Future Admin Features

With the database-based admin system, you can now:
- Grant/revoke admin access via API
- View all admins in the database
- Set up role-based permissions (future enhancement)
- Track admin actions (future enhancement)

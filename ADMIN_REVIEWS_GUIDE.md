# Admin Review Approval Guide

## How to Use Admin Approve/Reject Feature

### Current Setup

The admin system uses an `ADMIN_SECRET_TOKEN` environment variable to verify admin access. Here's how to use it:

### Step 1: Set Up Admin Token

1. **Set the environment variable in Railway:**
   - Go to your Railway project
   - Navigate to Variables
   - Add: `ADMIN_SECRET_TOKEN` = `your-secret-token-here` (use a strong random string)

2. **Or set it locally in your `.env` file:**
   ```
   ADMIN_SECRET_TOKEN=your-secret-token-here
   ```

### Step 2: Access Admin Features

Currently, the admin check requires the `x-admin-token` header. The frontend needs to be updated to send this token. 

**Option A: Quick Fix - Update ReviewsTab.tsx**

The `checkAdminStatus` function needs to send the admin token. However, for security, you should:

1. **Create a simple admin check based on email** (recommended for now):

Update `server/routes/admin.ts` to add a route that checks if the authenticated user's email is in an admin list:

```typescript
// Add to server/routes/admin.ts
router.get('/check', verifyAuth, async (req: AuthRequest, res) => {
  // List of admin emails (you can move this to env var or database)
  const adminEmails = [
    'your-admin-email@example.com',
    // Add more admin emails here
  ];
  
  const isAdmin = adminEmails.includes(req.userEmail || '');
  res.json({ isAdmin });
});
```

2. **Or use the admin token approach** (less secure, but works immediately):

Update `components/ReviewsTab.tsx` line 48 to include the admin token:

```typescript
const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin/check`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-admin-token': import.meta.env.VITE_ADMIN_TOKEN || '' // Add this to your .env
  }
});
```

### Step 3: Approve/Reject Reviews

Once you're logged in as an admin:

1. **Navigate to the Reviews page** (from landing page footer, navigation menu, or app sidebar)
2. **You'll see a "Pending Reviews" section** at the top (only visible to admins)
3. **Each pending review shows:**
   - Reviewer name
   - Star rating
   - Review text
   - Reviewer email (if provided)
   - Two buttons: ✓ (Approve) and ✗ (Reject)

4. **Click the green checkmark** to approve a review (it will appear on the public reviews page)
5. **Click the red X** to reject a review (it will be hidden from public view)

### Recommended: Better Admin System

For a more secure and scalable solution, consider:

1. **Add an `is_admin` field to `user_profiles` table:**
   ```sql
   ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
   ```

2. **Update the admin check route to use this field:**
   ```typescript
   router.get('/check', verifyAuth, async (req: AuthRequest, res) => {
     const { data: profile } = await supabaseAdmin
       .from('user_profiles')
       .select('is_admin')
       .eq('user_id', req.userId)
       .single();
     
     res.json({ isAdmin: profile?.is_admin || false });
   });
   ```

3. **Manually set yourself as admin in Supabase:**
   ```sql
   UPDATE user_profiles 
   SET is_admin = true 
   WHERE user_id = 'your-user-id-here';
   ```

### Testing

1. Submit a test review (while logged in or as guest)
2. Log in as admin
3. Go to Reviews page
4. You should see the pending review in the yellow "Pending Reviews" section
5. Click approve or reject to test

### Troubleshooting

- **"Pending Reviews section not showing":** Make sure you're logged in and the admin check is returning `isAdmin: true`
- **"Can't approve reviews":** Check that `ADMIN_SECRET_TOKEN` is set in Railway environment variables
- **"Unauthorized error":** Verify the admin token matches between frontend and backend

# Supabase Security Fixes

## Fixed Issues

### 1. Function Search Path Mutable (Fixed in schema.sql)

Both functions now have explicit `SET search_path` to prevent search_path injection attacks:

- `public.handle_new_user()` - Now includes `SET search_path = public, pg_catalog`
- `public.update_updated_at_column()` - Now includes `SET search_path = public, pg_catalog`

**To apply the fix:**
Run the updated functions from `supabase/schema.sql` in your Supabase SQL Editor. The functions have been updated with the security fix.

### 2. Leaked Password Protection (Manual Setup Required)

This is a Supabase Auth setting that needs to be enabled in the dashboard.

**Steps to enable:**

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings** (or **Auth** → **Policies**)
3. Look for **Password Security** or **Password Strength** settings
4. Enable **"Leaked Password Protection"** or **"Check passwords against HaveIBeenPwned"**
5. Save the changes

**What it does:**
- Checks user passwords against the HaveIBeenPwned.org database
- Prevents users from using compromised passwords
- Enhances overall account security

**Note:** This feature is free and uses the HaveIBeenPwned API to check passwords without sending the actual password (uses k-anonymity).

## Running the Fixes

### For the SQL functions:

1. Open Supabase SQL Editor
2. Run these updated function definitions:

```sql
-- Fix for handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, credits, plan_type)
  VALUES (NEW.id, 3, 'free');
  RETURN NEW;
END;
$$;

-- Fix for update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

### For the reviews migration (if you haven't run it yet):

The `migration_reviews.sql` file also uses `update_updated_at_column()`, but since we're fixing the function itself, the trigger will automatically use the secure version.

## Verification

After applying the fixes:

1. **Check function security:** Run this query in Supabase SQL Editor:
   ```sql
   SELECT 
     proname as function_name,
     prosecdef as is_security_definer,
     proconfig as search_path_config
   FROM pg_proc
   WHERE proname IN ('handle_new_user', 'update_updated_at_column');
   ```

2. **Check Auth settings:** Go to Authentication → Settings and verify "Leaked Password Protection" is enabled.

## Additional Security Recommendations

1. **Enable Row Level Security (RLS)** - Already enabled ✅
2. **Use parameterized queries** - Already using Supabase client ✅
3. **Regular security audits** - Run Supabase linter regularly
4. **Keep dependencies updated** - Regularly update npm packages

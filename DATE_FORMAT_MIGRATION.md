# Date Format Migration Guide

## Overview

The application now stores and displays all dates in **MM/DD/YYYY** format (US standard). Dates are stored in the database as PostgreSQL `DATE` type (which uses YYYY-MM-DD internally), but are automatically converted to MM/DD/YYYY format for display.

## What Changed

1. **Frontend Display**: All dates are displayed in MM/DD/YYYY format
2. **Backend Parsing**: The backend now accepts MM/DD/YYYY format and converts it to YYYY-MM-DD for database storage
3. **Backend Response**: When retrieving dates from the database, they are automatically converted from YYYY-MM-DD to MM/DD/YYYY

## Database Schema

The `date` column in `verified_entries` table is already a `DATE` type, which means:
- Dates are stored internally as YYYY-MM-DD
- Dates already include years
- No schema changes are needed

## SQL Queries for Supabase

### 1. Check for any invalid or missing dates

Run this query to see if there are any NULL dates or dates that might need attention:

```sql
SELECT 
  id, 
  date, 
  created_at,
  TO_CHAR(date, 'MM/DD/YYYY') as formatted_date
FROM verified_entries
WHERE date IS NULL
ORDER BY created_at DESC;
```

### 2. Check date format in database (for verification)

This query shows how dates are currently stored (they should all be in YYYY-MM-DD format):

```sql
SELECT 
  id,
  date,
  TO_CHAR(date, 'YYYY-MM-DD') as db_format,
  TO_CHAR(date, 'MM/DD/YYYY') as display_format
FROM verified_entries
ORDER BY date DESC
LIMIT 10;
```

### 3. Verify all dates have valid years (should all be true)

Check that all dates are reasonable (not in 1970 or future dates):

```sql
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN date < '1900-01-01' THEN 1 END) as dates_before_1900,
  COUNT(CASE WHEN date > CURRENT_DATE THEN 1 END) as future_dates,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM verified_entries;
```

## No Action Required If...

✅ All dates in the database are in YYYY-MM-DD format (which they should be, since the column is DATE type)
✅ All dates have valid years (between 1900 and current date)
✅ No NULL dates exist that need attention

## Manual Fixes (If Needed)

If you find any dates that need correction, you can update them manually:

```sql
-- Example: Fix a specific date by entry ID
UPDATE verified_entries
SET date = '2024-12-25'  -- Use YYYY-MM-DD format
WHERE id = 'your-entry-id-here';

-- Example: Fix dates that might have incorrect years (like 1970)
-- This would update dates that are clearly wrong (before 1900)
-- Be careful with this query - verify the dates first!
UPDATE verified_entries
SET date = '2024-' || TO_CHAR(date, 'MM-DD')
WHERE date < '1900-01-01' AND date > '1970-01-01';
```

**Note**: The above queries are examples. Only run them if you find actual issues with your dates.

## Testing

After deployment, verify that:

1. New entries saved show dates in MM/DD/YYYY format
2. Existing entries loaded from database show dates in MM/DD/YYYY format
3. Dates with DD/MM format are correctly converted when the dropdown is used
4. Dates are correctly saved to the database

## Summary

**You likely do NOT need to run any SQL queries** because:
- The database already stores dates with years (DATE type)
- The conversion happens automatically in the application code
- Dates are displayed in MM/DD/YYYY format by the frontend
- Dates are parsed from MM/DD/YYYY format by the backend

Only run the queries above if you suspect data issues or want to verify your data.

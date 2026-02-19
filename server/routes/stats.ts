import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - reduces DB load from landing page traffic
let cachedTotalHours: number | null = null;
let cacheExpiry = 0;

/**
 * Round up to nearest 10 hours for display (e.g., 2543 -> 2550, 2551 -> 2560)
 */
function roundUpForDisplay(hours: number): number {
  if (hours <= 0) return 0;
  return Math.ceil(hours / 10) * 10;
}

/**
 * GET /api/stats/total-hours
 * Public endpoint - returns estimated total flight hours digitized across all users.
 * Cached for 5 minutes to avoid heavy DB load. Rounded up for a positive image.
 */
router.get('/stats/total-hours', async (_req, res) => {
  try {
    const now = Date.now();
    if (cachedTotalHours !== null && now < cacheExpiry) {
      return res.json({ totalHours: cachedTotalHours });
    }

    const { data, error } = await supabaseAdmin.rpc('get_total_hours_estimate');

    if (error) {
      console.error('Error fetching total hours:', error);
      // Return cached value if we have one, even if stale
      if (cachedTotalHours !== null) {
        return res.json({ totalHours: cachedTotalHours });
      }
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const rawTotal = typeof data === 'number' ? data : parseFloat(String(data ?? 0)) || 0;
    const estimated = roundUpForDisplay(rawTotal);
    cachedTotalHours = estimated;
    cacheExpiry = now + CACHE_TTL_MS;

    res.json({ totalHours: estimated });
  } catch (err: any) {
    console.error('Stats total-hours error:', err);
    if (cachedTotalHours !== null) {
      return res.json({ totalHours: cachedTotalHours });
    }
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

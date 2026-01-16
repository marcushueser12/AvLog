import express from 'express';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { LogbookEntry } from '../../types.js';

const router = express.Router();

/**
 * POST /api/verified/save-scan
 * Save verified scan and entries to database
 * Requires: Authorization Bearer token
 */
router.post('/save-scan', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      pageNumber,
      mode,
      timestamp,
      imageRotations,
      expectedEntries,
      clarityScore,
      entries
    } = req.body;

    if (!mode || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: mode and entries array' 
      });
    }

    // Insert verified scan
    const { data: scan, error: scanError } = await supabaseAdmin
      .from('verified_scans')
      .insert({
        user_id: userId,
        page_number: pageNumber || null,
        mode: mode,
        status: 'verified',
        timestamp: timestamp || Date.now(),
        image_rotations: imageRotations || null,
        expected_entries: expectedEntries || null,
        clarity_score: clarityScore || null
      })
      .select()
      .single();

    if (scanError || !scan) {
      console.error('Error saving scan:', scanError);
      return res.status(500).json({ error: 'Failed to save scan' });
    }

    // Transform entries to match database schema
    const dbEntries = entries.map((entry: LogbookEntry) => ({
      user_id: userId,
      scan_id: scan.id,
      date: entry.date || null,
      aircraft_id: entry.aircraftId || null,
      aircraft_type: entry.aircraftType || null,
      from_location: entry.from || null,
      to_location: entry.to || null,
      route: entry.route || null,
      total_time: entry.totalTime ? parseFloat(entry.totalTime) : null,
      day: entry.day ? parseFloat(entry.day) : null,
      night: entry.night ? parseFloat(entry.night) : null,
      cross_country: entry.crossCountry || null,
      pic: entry.pic || null,
      sic: entry.sic || null,
      dual_received: entry.dualReceived || null,
      dual_given: entry.dualGiven || null,
      instrument: entry.instrument || null,
      simulated_instrument: entry.simulatedInstrument || null,
      approaches: entry.approaches || null,
      landings_day: entry.landingsDay || null,
      landings_night: entry.landingsNight || null,
      comments: entry.comments || null,
      is_verified: entry.isVerified ?? true,
      ai_confidence: entry.aiConfidence || null,
      reconciliation_confidence: entry.reconciliationConfidence || null,
      uncertain_fields: entry.uncertainFields || null,
      row_anchor: entry.rowAnchor || null
    }));

    // Insert verified entries
    const { error: entriesError } = await supabaseAdmin
      .from('verified_entries')
      .insert(dbEntries);

    if (entriesError) {
      console.error('Error saving entries:', entriesError);
      // Try to delete the scan if entries failed
      await supabaseAdmin.from('verified_scans').delete().eq('id', scan.id);
      return res.status(500).json({ error: 'Failed to save entries' });
    }

    res.json({
      success: true,
      scanId: scan.id,
      entriesCount: dbEntries.length,
      message: 'Successfully saved verified scan and entries'
    });
  } catch (error: any) {
    console.error('Save verified scan error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/verified/scans
 * Get all verified scans for the authenticated user
 */
router.get('/scans', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const { data: scans, error } = await supabaseAdmin
      .from('verified_scans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scans:', error);
      return res.status(500).json({ error: 'Failed to fetch scans' });
    }

    res.json({ scans: scans || [] });
  } catch (error: any) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/verified/entries/:scanId
 * Get entries for a specific verified scan
 */
router.get('/entries/:scanId', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;

    // First verify the scan belongs to the user
    const { data: scan, error: scanError } = await supabaseAdmin
      .from('verified_scans')
      .select('id')
      .eq('id', scanId)
      .eq('user_id', userId)
      .single();

    if (scanError || !scan) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('verified_entries')
      .select('*')
      .eq('scan_id', scanId)
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return res.status(500).json({ error: 'Failed to fetch entries' });
    }

    // Transform back to frontend format
    const transformedEntries = (entries || []).map((entry: any) => ({
      id: entry.id,
      scanId: entry.scan_id,
      date: entry.date,
      aircraftId: entry.aircraft_id || '',
      aircraftType: entry.aircraft_type || '',
      from: entry.from_location || '',
      to: entry.to_location || '',
      route: entry.route || '',
      totalTime: entry.total_time?.toString() || '',
      day: entry.day?.toString() || '',
      night: entry.night?.toString() || '',
      crossCountry: entry.cross_country || '',
      pic: entry.pic || '',
      sic: entry.sic || '',
      dualReceived: entry.dual_received || '',
      dualGiven: entry.dual_given || '',
      instrument: entry.instrument || '',
      simulatedInstrument: entry.simulated_instrument || '',
      approaches: entry.approaches || '',
      landingsDay: entry.landings_day || '',
      landingsNight: entry.landings_night || '',
      comments: entry.comments || '',
      isVerified: entry.is_verified ?? true,
      aiConfidence: entry.ai_confidence,
      reconciliationConfidence: entry.reconciliation_confidence,
      uncertainFields: entry.uncertain_fields || [],
      rowAnchor: entry.row_anchor
    }));

    res.json({ entries: transformedEntries });
  } catch (error: any) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

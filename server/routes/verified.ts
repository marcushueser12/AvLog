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

    // Helper function to parse date string to Date object or null
    // Accepts MM/DD/YYYY format and converts to YYYY-MM-DD for database
    const parseDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr || dateStr.trim() === '') return null;
      
      const trimmed = dateStr.trim();
      
      // If already in YYYY-MM-DD format (database format), return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      
      // Parse MM/DD/YYYY format (display format)
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts;
        if (/^\d+$/.test(month) && /^\d+$/.test(day) && /^\d+$/.test(year)) {
          const monthNum = parseInt(month, 10);
          const dayNum = parseInt(day, 10);
          const yearNum = parseInt(year, 10);
          
          // Basic validation
          if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
            return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          }
        }
      }
      
      // Try to parse as Date and format
      try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        return null;
      }
      
      return null;
    };

    // Helper function to parse float, return null if invalid
    const parseFloatOrNull = (value: string | null | undefined): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Helper function to parse integer, return null if invalid
    const parseIntOrNull = (value: string | null | undefined): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };

    // Transform entries to match database schema
    const dbEntries = entries.map((entry: LogbookEntry) => ({
      user_id: userId,
      scan_id: scan.id,
      date: parseDate(entry.date),
      aircraft_id: entry.aircraftId?.trim() || null,
      aircraft_type: entry.aircraftType?.trim() || null,
      from_location: entry.from?.trim() || null,
      to_location: entry.to?.trim() || null,
      route: entry.route?.trim() || null,
      total_time: parseFloatOrNull(entry.totalTime),
      day: parseFloatOrNull(entry.day),
      night: parseFloatOrNull(entry.night),
      cross_country: entry.crossCountry?.trim() || null,
      pic: entry.pic?.trim() || null,
      sic: entry.sic?.trim() || null,
      dual_received: entry.dualReceived?.trim() || null,
      dual_given: entry.dualGiven?.trim() || null,
      instrument: entry.instrument?.trim() || null,
      simulated_instrument: entry.simulatedInstrument?.trim() || null,
      approaches: entry.approaches?.trim() || null,
      landings_day: entry.landingsDay?.trim() || null,
      landings_night: entry.landingsNight?.trim() || null,
      comments: entry.comments?.trim() || null,
      is_verified: entry.isVerified ?? true,
      ai_confidence: entry.aiConfidence || null,
      reconciliation_confidence: entry.reconciliationConfidence || null,
      uncertain_fields: entry.uncertainFields && entry.uncertainFields.length > 0 ? entry.uncertainFields : null,
      row_anchor: entry.rowAnchor?.trim() || null
    }));

    // Insert verified entries
    const { data: insertedEntries, error: entriesError } = await supabaseAdmin
      .from('verified_entries')
      .insert(dbEntries)
      .select();

    if (entriesError) {
      console.error('Error saving entries:', entriesError);
      console.error('Entries data that failed:', JSON.stringify(dbEntries, null, 2));
      console.error('Error details:', {
        message: entriesError.message,
        details: entriesError.details,
        hint: entriesError.hint,
        code: entriesError.code
      });
      
      // Try to delete the scan if entries failed
      await supabaseAdmin.from('verified_scans').delete().eq('id', scan.id);
      
      // Return more detailed error message
      const errorMessage = entriesError.message || 'Failed to save entries';
      const errorDetails = entriesError.details ? ` Details: ${entriesError.details}` : '';
      const errorHint = entriesError.hint ? ` Hint: ${entriesError.hint}` : '';
      
      return res.status(500).json({ 
        error: 'Failed to save entries',
        message: errorMessage + errorDetails + errorHint,
        code: entriesError.code
      });
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
 * PUT /api/verified/update-scan
 * Update verified entries for a scan
 * Requires: Authorization Bearer token
 */
router.put('/update-scan', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { scanId, entries } = req.body;

    if (!scanId || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ 
        error: 'Missing required fields: scanId and entries array' 
      });
    }

    // Verify the scan belongs to the user
    const { data: scan, error: scanError } = await supabaseAdmin
      .from('verified_scans')
      .select('id')
      .eq('id', scanId)
      .eq('user_id', userId)
      .single();

    if (scanError || !scan) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    // Helper functions (same as save-scan)
    // Accepts MM/DD/YYYY format and converts to YYYY-MM-DD for database
    const parseDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr || dateStr.trim() === '') return null;
      
      const trimmed = dateStr.trim();
      
      // If already in YYYY-MM-DD format (database format), return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      
      // Parse MM/DD/YYYY format (display format)
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts;
        if (/^\d+$/.test(month) && /^\d+$/.test(day) && /^\d+$/.test(year)) {
          const monthNum = parseInt(month, 10);
          const dayNum = parseInt(day, 10);
          const yearNum = parseInt(year, 10);
          
          // Basic validation
          if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
            return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          }
        }
      }
      
      // Try to parse as Date and format
      try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        return null;
      }
      
      return null;
    };

    const parseFloatOrNull = (value: string | null | undefined): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const parseIntOrNull = (value: string | null | undefined): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };

    // Delete all existing entries for this scan
    const { error: deleteError } = await supabaseAdmin
      .from('verified_entries')
      .delete()
      .eq('scan_id', scanId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting existing entries:', deleteError);
      return res.status(500).json({ error: 'Failed to update entries' });
    }

    // Transform and insert updated entries
    const dbEntries = entries.map((entry: LogbookEntry) => ({
      user_id: userId,
      scan_id: scanId,
      date: parseDate(entry.date),
      aircraft_id: entry.aircraftId?.trim() || null,
      aircraft_type: entry.aircraftType?.trim() || null,
      from_location: entry.from?.trim() || null,
      to_location: entry.to?.trim() || null,
      route: entry.route?.trim() || null,
      total_time: parseFloatOrNull(entry.totalTime),
      day: parseFloatOrNull(entry.day),
      night: parseFloatOrNull(entry.night),
      cross_country: entry.crossCountry?.trim() || null,
      pic: entry.pic?.trim() || null,
      sic: entry.sic?.trim() || null,
      dual_received: entry.dualReceived?.trim() || null,
      dual_given: entry.dualGiven?.trim() || null,
      instrument: parseFloatOrNull(entry.instrument),
      simulated_instrument: parseFloatOrNull(entry.simulatedInstrument),
      approaches: parseIntOrNull(entry.approaches),
      landings_day: parseIntOrNull(entry.landingsDay),
      landings_night: parseIntOrNull(entry.landingsNight),
      comments: entry.comments?.trim() || null,
      is_verified: entry.isVerified ?? true,
      ai_confidence: entry.aiConfidence || null,
      reconciliation_confidence: entry.reconciliationConfidence || null,
      uncertain_fields: entry.uncertainFields && entry.uncertainFields.length > 0 ? entry.uncertainFields : null,
      row_anchor: entry.rowAnchor?.trim() || null
    }));

    // If we have entries to insert, do so
    if (dbEntries.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('verified_entries')
        .insert(dbEntries);

      if (insertError) {
        console.error('Error inserting updated entries:', insertError);
        console.error('Entries data that failed:', JSON.stringify(dbEntries, null, 2));
        return res.status(500).json({ 
          error: 'Failed to save updated entries',
          message: insertError.message,
          details: insertError.details
        });
      }
    }

    res.json({
      success: true,
      scanId,
      entriesCount: dbEntries.length,
      message: 'Successfully updated verified entries'
    });
  } catch (error: any) {
    console.error('Update verified scan error:', error);
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

    // Helper function to format date from YYYY-MM-DD (database) to MM/DD/YYYY (display)
    const formatDateForDisplay = (dateStr: string | null): string => {
      if (!dateStr) return '';
      // If already in MM/DD/YYYY format, return as-is
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return dateStr;
      // Convert YYYY-MM-DD to MM/DD/YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${month}/${day}/${year}`;
      }
      return dateStr;
    };

    // Transform back to frontend format
    const transformedEntries = (entries || []).map((entry: any) => ({
      id: entry.id,
      scanId: entry.scan_id,
      date: formatDateForDisplay(entry.date),
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

/**
 * GET /api/verified/credits
 * Get user credit balance
 * Requires: Authorization Bearer token
 */
router.get('/credits', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile doesn't exist yet, return default credits
        return res.json({ credits: 0 });
      }
      console.error('Error fetching credits:', error);
      return res.status(500).json({ error: 'Failed to fetch credits' });
    }

    res.json({ credits: profile?.credits || 0 });
  } catch (error: any) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/verified/deduct-credits
 * Deduct credits for a scan (1 credit per scan, single or spread)
 * Requires: Authorization Bearer token
 * Body: { amount: number (optional, defaults to 1), reason?: string }
 */
router.post('/deduct-credits', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { amount = 1, reason } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Get current credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    const currentCredits = profile?.credits || 0;

    if (currentCredits < amount) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        currentCredits,
        required: amount,
        message: `You need ${amount} credit${amount > 1 ? 's' : ''} but only have ${currentCredits}.`
      });
    }

    const newCredits = currentCredits - amount;

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
      return res.status(500).json({ error: 'Failed to deduct credits' });
    }

    // Log transaction
    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount, // Negative for deduction
        type: 'scan_deduction',
        description: reason || `Used ${amount} credit${amount > 1 ? 's' : ''} for scan extraction`
      });

    if (transactionError) {
      console.error('Error logging transaction:', transactionError);
      // Don't fail the request if logging fails
    }

    res.json({
      success: true,
      previousBalance: currentCredits,
      creditsDeducted: amount,
      newBalance: newCredits,
      message: `Successfully deducted ${amount} credit${amount > 1 ? 's' : ''}`
    });
  } catch (error: any) {
    console.error('Deduct credits error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/verified/scan/:scanId
 * Delete a verified scan and all its entries
 * Requires: Authorization Bearer token
 */
router.delete('/scan/:scanId', verifyAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { scanId } = req.params;

    // Verify the scan belongs to the user
    const { data: scan, error: scanError } = await supabaseAdmin
      .from('verified_scans')
      .select('id')
      .eq('id', scanId)
      .eq('user_id', userId)
      .single();

    if (scanError || !scan) {
      return res.status(404).json({ error: 'Scan not found or access denied' });
    }

    // Delete all entries for this scan first (foreign key constraint)
    const { error: entriesError } = await supabaseAdmin
      .from('verified_entries')
      .delete()
      .eq('scan_id', scanId)
      .eq('user_id', userId);

    if (entriesError) {
      console.error('Error deleting entries:', entriesError);
      return res.status(500).json({ error: 'Failed to delete entries' });
    }

    // Delete the scan
    const { error: deleteError } = await supabaseAdmin
      .from('verified_scans')
      .delete()
      .eq('id', scanId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting scan:', deleteError);
      return res.status(500).json({ error: 'Failed to delete scan' });
    }

    res.json({
      success: true,
      message: 'Scan and entries deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete scan error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

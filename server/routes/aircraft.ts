import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/security.js';
import { validateAndSanitizeBody, validateParams } from '../middleware/validation.js';

const router = express.Router();
router.use(verifyAuth, authenticatedLimiter);

// Helper function to transform snake_case to camelCase
const transformAircraftProfile = (dbProfile: any) => {
  return {
    id: dbProfile.id,
    userId: dbProfile.user_id,
    aircraftId: dbProfile.aircraft_id,
    equipmentType: dbProfile.equipment_type || '',
    typeCode: dbProfile.type_code || '',
    year: dbProfile.year || '',
    make: dbProfile.make || '',
    model: dbProfile.model || '',
    gearType: dbProfile.gear_type || '',
    engineType: dbProfile.engine_type || '',
    categoryClass: dbProfile.category_class || '',
    complex: dbProfile.complex || false,
    highPerformance: dbProfile.high_performance || false,
    pressurized: dbProfile.pressurized || false,
    taa: dbProfile.taa || false,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at
  };
};

// Get all aircraft profiles for the authenticated user
router.get('/aircraft', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const { data, error } = await supabaseAdmin
      .from('aircraft_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('aircraft_id', { ascending: true });

    if (error) throw error;

    // Transform snake_case to camelCase
    const transformedAircraft = (data || []).map(transformAircraftProfile);

    res.json({ aircraft: transformedAircraft });
  } catch (error: any) {
    console.error('Error fetching aircraft profiles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch aircraft profiles',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Create or update an aircraft profile
router.post(
  '/aircraft',
  validateAndSanitizeBody({
    aircraftId: { type: 'string', required: true, maxLength: 50 },
    equipmentType: { type: 'string', required: false, maxLength: 100 },
    typeCode: { type: 'string', required: false, maxLength: 50 },
    year: { type: 'string', required: false, maxLength: 10 },
    make: { type: 'string', required: false, maxLength: 100 },
    model: { type: 'string', required: false, maxLength: 100 },
    gearType: { type: 'string', required: false, maxLength: 50 },
    engineType: { type: 'string', required: false, maxLength: 50 },
    categoryClass: { type: 'string', required: false, maxLength: 50 },
    complex: { type: 'boolean', required: false },
    highPerformance: { type: 'boolean', required: false },
    pressurized: { type: 'boolean', required: false },
    taa: { type: 'boolean', required: false },
  }),
  async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const {
    aircraftId,
    equipmentType = '',
    typeCode = '',
    year = '',
    make = '',
    model = '',
    gearType = '',
    engineType = '',
    categoryClass = '',
    complex = false,
    highPerformance = false,
    pressurized = false,
    taa = false
  } = req.body;

  // Normalize aircraft ID: add "N" prefix if not present and convert to uppercase
  let normalizedAircraftId = aircraftId.trim().toUpperCase();
  if (normalizedAircraftId && !normalizedAircraftId.startsWith('N')) {
    normalizedAircraftId = `N${normalizedAircraftId}`;
  }

  try {

    // Helper function to safely trim or return null
    const safeTrim = (value: string | null | undefined): string | null => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    // Try to insert first, if duplicate then update
    const profileData = {
      user_id: userId,
      aircraft_id: normalizedAircraftId,
      equipment_type: safeTrim(equipmentType),
      type_code: safeTrim(typeCode),
      year: safeTrim(year),
      make: safeTrim(make),
      model: safeTrim(model),
      gear_type: safeTrim(gearType),
      engine_type: safeTrim(engineType),
      category_class: safeTrim(categoryClass),
      complex: Boolean(complex),
      high_performance: Boolean(highPerformance),
      pressurized: Boolean(pressurized),
      taa: Boolean(taa)
    };

    // Try insert first
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('aircraft_profiles')
      .insert(profileData)
      .select()
      .single();

    if (insertError) {
      // If duplicate key error, fetch existing and update it
      if (insertError.code === '23505') {
        // Fetch existing profile
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('aircraft_profiles')
          .select('*')
          .eq('user_id', userId)
          .eq('aircraft_id', normalizedAircraftId)
          .single();

        if (fetchError) throw fetchError;

        // Update existing profile - only update fields that have actual data (preserve existing data for empty fields)
        // This prevents auto-extracted minimal data from overwriting manually entered detailed profiles
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        // Only update fields that have non-empty values (preserve existing data if incoming is empty)
        if (safeTrim(equipmentType) !== null) updateData.equipment_type = safeTrim(equipmentType);
        if (safeTrim(typeCode) !== null) updateData.type_code = safeTrim(typeCode);
        if (safeTrim(year) !== null) updateData.year = safeTrim(year);
        if (safeTrim(make) !== null) updateData.make = safeTrim(make);
        if (safeTrim(model) !== null) updateData.model = safeTrim(model);
        if (safeTrim(gearType) !== null) updateData.gear_type = safeTrim(gearType);
        if (safeTrim(engineType) !== null) updateData.engine_type = safeTrim(engineType);
        if (safeTrim(categoryClass) !== null) updateData.category_class = safeTrim(categoryClass);
        
        // Boolean fields: only update if explicitly provided (not just default false)
        // Check if the request body explicitly contains these fields
        if (req.body.hasOwnProperty('complex')) updateData.complex = Boolean(complex);
        if (req.body.hasOwnProperty('highPerformance')) updateData.high_performance = Boolean(highPerformance);
        if (req.body.hasOwnProperty('pressurized')) updateData.pressurized = Boolean(pressurized);
        if (req.body.hasOwnProperty('taa')) updateData.taa = Boolean(taa);

        const { data: updatedData, error: updateError } = await supabaseAdmin
          .from('aircraft_profiles')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        res.json({ aircraft: transformAircraftProfile(updatedData) });
      } else {
        throw insertError;
      }
    } else {
      // Successfully inserted
      res.json({ aircraft: transformAircraftProfile(insertedData) });
    }
  } catch (error: any) {
    console.error('Error saving aircraft profile:', error);
    // If we still get a duplicate error after our upsert logic, it means something went wrong
    // In this case, try to fetch and return the existing record
    if (error.code === '23505') {
      try {
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from('aircraft_profiles')
          .select('*')
          .eq('user_id', userId)
          .eq('aircraft_id', normalizedAircraftId)
          .single();

        if (fetchError) throw fetchError;
        // Return existing record instead of error
        res.json({ aircraft: transformAircraftProfile(existing) });
      } catch (fallbackError: any) {
        console.error('Error fetching existing aircraft profile:', fallbackError);
        res.status(500).json({ 
          error: 'Failed to save aircraft profile',
          ...(process.env.NODE_ENV === 'development' && { details: fallbackError.message })
        });
      }
    } else {
      res.status(500).json({ 
        error: 'Failed to save aircraft profile',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  }
  }
);

// Delete an aircraft profile
router.delete(
  '/aircraft/:id',
  validateParams({ id: 'id' }),
  async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('aircraft_profiles')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Ensure user can only delete their own aircraft

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting aircraft profile:', error);
    res.status(500).json({ 
      error: 'Failed to delete aircraft profile',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
  }
);

export default router;

import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

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
router.get('/aircraft', verifyAuth, async (req: AuthRequest, res) => {
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
    res.status(500).json({ error: error.message || 'Failed to fetch aircraft profiles' });
  }
});

// Create or update an aircraft profile
router.post('/aircraft', verifyAuth, async (req: AuthRequest, res) => {
  try {
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

    if (!aircraftId || !aircraftId.trim()) {
      return res.status(400).json({ error: 'Aircraft ID is required' });
    }

    // Normalize aircraft ID to uppercase for consistency
    const normalizedAircraftId = aircraftId.trim().toUpperCase();

    // Check if aircraft profile already exists for this user/aircraft
    const { data: existing } = await supabaseAdmin
      .from('aircraft_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('aircraft_id', normalizedAircraftId)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('aircraft_profiles')
        .update({
          aircraft_id: normalizedAircraftId, // Ensure it's normalized
          equipment_type: equipmentType.trim() || null,
          type_code: typeCode.trim() || null,
          year: year.trim() || null,
          make: make.trim() || null,
          model: model.trim() || null,
          gear_type: gearType.trim() || null,
          engine_type: engineType.trim() || null,
          category_class: categoryClass.trim() || null,
          complex: Boolean(complex),
          high_performance: Boolean(highPerformance),
          pressurized: Boolean(pressurized),
          taa: Boolean(taa),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      res.json({ aircraft: transformAircraftProfile(data) });
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('aircraft_profiles')
        .insert({
          user_id: userId,
          aircraft_id: normalizedAircraftId,
          equipment_type: equipmentType.trim() || null,
          type_code: typeCode.trim() || null,
          year: year.trim() || null,
          make: make.trim() || null,
          model: model.trim() || null,
          gear_type: gearType.trim() || null,
          engine_type: engineType.trim() || null,
          category_class: categoryClass.trim() || null,
          complex: Boolean(complex),
          high_performance: Boolean(highPerformance),
          pressurized: Boolean(pressurized),
          taa: Boolean(taa)
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ aircraft: transformAircraftProfile(data) });
    }
  } catch (error: any) {
    console.error('Error saving aircraft profile:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      res.status(409).json({ error: 'An aircraft profile with this ID already exists' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to save aircraft profile' });
    }
  }
});

// Delete an aircraft profile
router.delete('/aircraft/:id', verifyAuth, async (req: AuthRequest, res) => {
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
    res.status(500).json({ error: error.message || 'Failed to delete aircraft profile' });
  }
});

export default router;

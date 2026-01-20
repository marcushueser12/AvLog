import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Get all aircraft profiles for the authenticated user
router.get('/aircraft', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;

    const { data, error } = await supabaseAdmin
      .from('aircraft_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('aircraft_id', { ascending: true });

    if (error) throw error;

    res.json({ aircraft: data || [] });
  } catch (error: any) {
    console.error('Error fetching aircraft profiles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch aircraft profiles' });
  }
});

// Create or update an aircraft profile
router.post('/aircraft', authenticateUser, async (req, res) => {
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

    // Check if aircraft profile already exists for this user/aircraft
    const { data: existing } = await supabaseAdmin
      .from('aircraft_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('aircraft_id', aircraftId.trim())
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('aircraft_profiles')
        .update({
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
      res.json({ aircraft: data });
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('aircraft_profiles')
        .insert({
          user_id: userId,
          aircraft_id: aircraftId.trim(),
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
      res.json({ aircraft: data });
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
router.delete('/aircraft/:id', authenticateUser, async (req, res) => {
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

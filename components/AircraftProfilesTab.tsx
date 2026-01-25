import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AircraftProfile } from '../types';
import { ICONS } from '../constants';
import AuthModal from './AuthModal';
import { normalizeAircraftId } from '../utils/logbookUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Dropdown options
const ENGINE_TYPE_OPTIONS = [
  'Diesel',
  'Electric',
  'Non-Powered',
  'Piston',
  'Radial',
  'Turbofan',
  'Turbojet',
  'Turboprop',
  'Turboshaft'
];

const GEAR_TYPE_OPTIONS = [
  'Amphibian (AM)',
  'Fixed Tailwheel (FC)',
  'Fixed Tricycle (FT)',
  'Floats (FL)',
  'Retractable Tailwheel (RC)',
  'Retractable Tricycle (RT)',
  'Skids',
  'Skis'
];

const CATEGORY_CLASS_OPTIONS = [
  'Airplane Single Engine Land (ASEL)',
  'Airplane Multi Engine Land (AMEL)',
  'Airplane Single Engine Sea (ASES)',
  'Airplane Multi Engine Sea (AMES)',
  'Rotorcraft Helicopter (RH)',
  'Rotorcraft Gyroplane (RG)',
  'Glider (GL)',
  'Lighter Than Air Airship (LA)',
  'Lighter Than Air Balloon (LB)',
  'Powered Lift (PLIFT)',
  'Powered Parachute Land (PL)',
  'Powered Parachute Sea (PS)',
  'Weight Shift Control Land (WL)',
  'Weight Shift Control Sea (WS)'
];

// Helper function to extract abbreviation from strings like "Amphibian (AM)" -> "AM"
// If no parentheses, returns the full string
const extractAbbreviation = (value: string): string => {
  const match = value.match(/\(([^)]+)\)/);
  return match ? match[1] : value;
};

// Helper function to find the display text for a stored value
// If value is an abbreviation, find the full text; otherwise return the value
const findDisplayText = (value: string, options: string[]): string => {
  if (!value) return '';
  // Check if value matches an abbreviation
  for (const option of options) {
    if (extractAbbreviation(option) === value) {
      return option;
    }
  }
  // If no match, return the value as-is (for backward compatibility)
  return value;
};

const AircraftProfilesTab: React.FC = () => {
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedAircraft, setEditedAircraft] = useState<Partial<AircraftProfile>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [newAircraft, setNewAircraft] = useState<Partial<AircraftProfile>>({
    aircraftId: '',
    equipmentType: '',
    typeCode: '',
    year: '',
    make: '',
    model: '',
    gearType: '',
    engineType: '',
    categoryClass: '',
    complex: false,
    highPerformance: false,
    pressurized: false,
    taa: false
  });

  useEffect(() => {
    if (user) {
      loadAircraft();
    }
  }, [user]);

  const loadAircraft = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/aircraft`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load aircraft profiles');
      }

      const data = await response.json();
      setAircraft(data.aircraft || []);
    } catch (error) {
      console.error('Error loading aircraft profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (aircraftProfile: AircraftProfile) => {
    setEditingId(aircraftProfile.id);
    setEditedAircraft({ ...aircraftProfile });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedAircraft({});
  };

  const handleSave = async (id: string) => {
    if (!user) return;

    setSaving(prev => new Set(prev).add(id));
    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/aircraft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aircraftId: editedAircraft.aircraftId,
          equipmentType: editedAircraft.equipmentType || '',
          typeCode: editedAircraft.typeCode || '',
          year: editedAircraft.year || '',
          make: editedAircraft.make || '',
          model: editedAircraft.model || '',
          gearType: editedAircraft.gearType || '',
          engineType: editedAircraft.engineType || '',
          categoryClass: editedAircraft.categoryClass || '',
          complex: editedAircraft.complex || false,
          highPerformance: editedAircraft.highPerformance || false,
          pressurized: editedAircraft.pressurized || false,
          taa: editedAircraft.taa || false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save aircraft profile');
      }

      await loadAircraft();
      setEditingId(null);
      setEditedAircraft({});
    } catch (error: any) {
      console.error('Error saving aircraft profile:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleCreate = async () => {
    if (!user || !newAircraft.aircraftId?.trim()) {
      alert('Aircraft ID is required');
      return;
    }

    setSaving(prev => new Set(prev).add('new'));
    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/aircraft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aircraftId: newAircraft.aircraftId.trim(),
          equipmentType: newAircraft.equipmentType || '',
          typeCode: newAircraft.typeCode || '',
          year: newAircraft.year || '',
          make: newAircraft.make || '',
          model: newAircraft.model || '',
          gearType: newAircraft.gearType || '',
          engineType: newAircraft.engineType || '',
          categoryClass: newAircraft.categoryClass || '',
          complex: newAircraft.complex || false,
          highPerformance: newAircraft.highPerformance || false,
          pressurized: newAircraft.pressurized || false,
          taa: newAircraft.taa || false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create aircraft profile');
      }

      await loadAircraft();
      setShowCreateForm(false);
      setNewAircraft({
        aircraftId: '',
        equipmentType: '',
        typeCode: '',
        year: '',
        make: '',
        model: '',
        gearType: '',
        engineType: '',
        categoryClass: '',
        complex: false,
        highPerformance: false,
        pressurized: false,
        taa: false
      });
    } catch (error: any) {
      console.error('Error creating aircraft profile:', error);
      alert(`Failed to create: ${error.message}`);
    } finally {
      setSaving(prev => {
        const newSet = new Set(prev);
        newSet.delete('new');
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this aircraft profile?')) return;

    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/aircraft/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete aircraft profile');
      }

      await loadAircraft();
    } catch (error: any) {
      console.error('Error deleting aircraft profile:', error);
      alert(`Failed to delete: ${error.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#003366]/70">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-6 bg-white/80 backdrop-blur-sm/50 border border-[#E2E8F0] rounded-3xl">
            <div className="w-16 h-16 bg-[#003366]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Aircraft />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">Create a free account to start</h3>
            <p className="text-[#003366]/70 text-sm mb-6">
              Sign up to manage your aircraft profiles and streamline your logbook entries.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#003366]/20 shiny-button"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#003366]/70">Loading aircraft profiles...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-[#003366] mb-2">Aircraft Profiles</h2>
          <p className="text-[#003366]/70 text-sm">
            Manage aircraft information for ForeFlight import. Aircraft are automatically added from your logbook entries.
          </p>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
          >
            <ICONS.Plus />
            Add Aircraft
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-[#003366] mb-4">New Aircraft Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Aircraft ID (Tail Number) *</label>
                <input
                  type="text"
                  value={newAircraft.aircraftId || ''}
                  onChange={(e) => {
                    const normalized = normalizeAircraftId(e.target.value);
                    setNewAircraft({ ...newAircraft, aircraftId: normalized });
                  }}
                  placeholder="N123AB"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Type Code</label>
                <input
                  type="text"
                  value={newAircraft.typeCode || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, typeCode: e.target.value.toUpperCase() })}
                  placeholder="C172"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Year</label>
                <input
                  type="text"
                  value={newAircraft.year || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, year: e.target.value })}
                  placeholder="2020"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Make</label>
                <input
                  type="text"
                  value={newAircraft.make || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, make: e.target.value })}
                  placeholder="Cessna"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Model</label>
                <input
                  type="text"
                  value={newAircraft.model || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, model: e.target.value })}
                  placeholder="172S"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Equipment Type</label>
                <input
                  type="text"
                  value={newAircraft.equipmentType || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, equipmentType: e.target.value })}
                  placeholder="Full description"
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Gear Type</label>
                <select
                  value={findDisplayText(newAircraft.gearType || '', GEAR_TYPE_OPTIONS)}
                  onChange={(e) => setNewAircraft({ ...newAircraft, gearType: extractAbbreviation(e.target.value) })}
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                >
                  <option value="">Select Gear Type</option>
                  {GEAR_TYPE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Engine Type</label>
                <select
                  value={findDisplayText(newAircraft.engineType || '', ENGINE_TYPE_OPTIONS)}
                  onChange={(e) => setNewAircraft({ ...newAircraft, engineType: extractAbbreviation(e.target.value) })}
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                >
                  <option value="">Select Engine Type</option>
                  {ENGINE_TYPE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#003366]/70 mb-2">Category/Class</label>
                <select
                  value={findDisplayText(newAircraft.categoryClass || '', CATEGORY_CLASS_OPTIONS)}
                  onChange={(e) => setNewAircraft({ ...newAircraft, categoryClass: extractAbbreviation(e.target.value) })}
                  className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                >
                  <option value="">Select Category/Class</option>
                  {CATEGORY_CLASS_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.complex || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, complex: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF]"
                  />
                  <span className="text-sm text-[#003366]">Complex</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.highPerformance || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, highPerformance: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF]"
                  />
                  <span className="text-sm text-[#003366]">High Performance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.pressurized || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, pressurized: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF]"
                  />
                  <span className="text-sm text-[#003366]">Pressurized</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.taa || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, taa: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF]"
                  />
                  <span className="text-sm text-[#003366]">TAA</span>
                </label>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={saving.has('new')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
                >
                  {saving.has('new') ? 'Saving...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewAircraft({
                      aircraftId: '',
                      equipmentType: '',
                      typeCode: '',
                      year: '',
                      make: '',
                      model: '',
                      gearType: '',
                      engineType: '',
                      categoryClass: '',
                      complex: false,
                      highPerformance: false,
                      pressurized: false,
                      taa: false
                    });
                  }}
                  className="px-4 py-2 bg-white/80 backdrop-blur-sm hover:bg-white text-[#003366] rounded-lg font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {aircraft.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Aircraft />
            </div>
            <h3 className="text-lg font-bold text-[#003366] mb-2">No Aircraft Profiles</h3>
            <p className="text-[#003366]/70 text-sm mb-4">
              Aircraft will automatically be added when you scan logbook entries, or you can add them manually above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {aircraft.map(aircraftProfile => {
              const isEditing = editingId === aircraftProfile.id;
              const profile = isEditing ? editedAircraft : aircraftProfile;

              return (
                <div key={aircraftProfile.id} className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#003366]">{aircraftProfile.aircraftId}</h3>
                      {aircraftProfile.typeCode && (
                        <p className="text-sm text-[#003366]/70">{aircraftProfile.typeCode}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(aircraftProfile.id)}
                            disabled={saving.has(aircraftProfile.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                          >
                            {saving.has(aircraftProfile.id) ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-white/80 backdrop-blur-sm hover:bg-white text-[#003366] rounded-lg text-sm font-semibold transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(aircraftProfile)}
                            className="px-3 py-1.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(aircraftProfile.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Aircraft ID</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.aircraftId || ''}
                          onChange={(e) => {
                            const normalized = normalizeAircraftId(e.target.value);
                            setEditedAircraft({ ...editedAircraft, aircraftId: normalized });
                          }}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.aircraftId}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Type Code</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.typeCode || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, typeCode: e.target.value.toUpperCase() })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.typeCode || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Year</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.year || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, year: e.target.value })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.year || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Make</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.make || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, make: e.target.value })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.make || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Model</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.model || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, model: e.target.value })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.model || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Equipment Type</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.equipmentType || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, equipmentType: e.target.value })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        />
                      ) : (
                        <p className="text-sm text-[#003366]">{aircraftProfile.equipmentType || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Gear Type</label>
                      {isEditing ? (
                        <select
                          value={findDisplayText(profile.gearType || '', GEAR_TYPE_OPTIONS)}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, gearType: extractAbbreviation(e.target.value) })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        >
                          <option value="">Select Gear Type</option>
                          {GEAR_TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-[#003366]">{findDisplayText(aircraftProfile.gearType || '', GEAR_TYPE_OPTIONS) || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Engine Type</label>
                      {isEditing ? (
                        <select
                          value={findDisplayText(profile.engineType || '', ENGINE_TYPE_OPTIONS)}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, engineType: extractAbbreviation(e.target.value) })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        >
                          <option value="">Select Engine Type</option>
                          {ENGINE_TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-[#003366]">{findDisplayText(aircraftProfile.engineType || '', ENGINE_TYPE_OPTIONS) || '-'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[#003366]/70 mb-1">Category/Class</label>
                      {isEditing ? (
                        <select
                          value={findDisplayText(profile.categoryClass || '', CATEGORY_CLASS_OPTIONS)}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, categoryClass: extractAbbreviation(e.target.value) })}
                          className="w-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF]"
                        >
                          <option value="">Select Category/Class</option>
                          {CATEGORY_CLASS_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-[#003366]">{findDisplayText(aircraftProfile.categoryClass || '', CATEGORY_CLASS_OPTIONS) || '-'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2 flex gap-4 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.complex || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, complex: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF] disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-[#003366]' : 'text-[#003366]/70'}`}>Complex</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.highPerformance || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, highPerformance: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF] disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-[#003366]' : 'text-[#003366]/70'}`}>High Performance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.pressurized || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, pressurized: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF] disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-[#003366]' : 'text-[#003366]/70'}`}>Pressurized</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.taa || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, taa: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-white/80 backdrop-blur-sm border-[#E2E8F0] rounded focus:ring-[#007BFF] disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-[#003366]' : 'text-[#003366]/70'}`}>TAA</span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AircraftProfilesTab;

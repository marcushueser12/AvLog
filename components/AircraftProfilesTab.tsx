import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AircraftProfile } from '../types';
import { ICONS } from '../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AircraftProfilesTab: React.FC = () => {
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedAircraft, setEditedAircraft] = useState<Partial<AircraftProfile>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
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
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Aircraft />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sign In Required</h3>
            <p className="text-slate-400 text-sm">
              Please sign in to manage your aircraft profiles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400">Loading aircraft profiles...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Aircraft Profiles</h2>
          <p className="text-slate-400 text-sm">
            Manage aircraft information for ForeFlight import. Aircraft are automatically added from your logbook entries.
          </p>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all"
          >
            <ICONS.Plus />
            Add Aircraft
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">New Aircraft Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Aircraft ID (Tail Number) *</label>
                <input
                  type="text"
                  value={newAircraft.aircraftId || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, aircraftId: e.target.value.toUpperCase() })}
                  placeholder="N123AB"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Type Code</label>
                <input
                  type="text"
                  value={newAircraft.typeCode || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, typeCode: e.target.value.toUpperCase() })}
                  placeholder="C172"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Year</label>
                <input
                  type="text"
                  value={newAircraft.year || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, year: e.target.value })}
                  placeholder="2020"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Make</label>
                <input
                  type="text"
                  value={newAircraft.make || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, make: e.target.value })}
                  placeholder="Cessna"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Model</label>
                <input
                  type="text"
                  value={newAircraft.model || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, model: e.target.value })}
                  placeholder="172S"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Equipment Type</label>
                <input
                  type="text"
                  value={newAircraft.equipmentType || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, equipmentType: e.target.value })}
                  placeholder="Full description"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Gear Type</label>
                <input
                  type="text"
                  value={newAircraft.gearType || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, gearType: e.target.value })}
                  placeholder="Fixed, Retractable"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Engine Type</label>
                <input
                  type="text"
                  value={newAircraft.engineType || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, engineType: e.target.value })}
                  placeholder="Single, Twin, Turbo"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-400 mb-2">Category/Class</label>
                <input
                  type="text"
                  value={newAircraft.categoryClass || ''}
                  onChange={(e) => setNewAircraft({ ...newAircraft, categoryClass: e.target.value })}
                  placeholder="Airplane/Single Engine Land"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.complex || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, complex: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Complex</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.highPerformance || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, highPerformance: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">High Performance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.pressurized || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, pressurized: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Pressurized</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAircraft.taa || false}
                    onChange={(e) => setNewAircraft({ ...newAircraft, taa: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">TAA</span>
                </label>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={saving.has('new')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {aircraft.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Aircraft />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Aircraft Profiles</h3>
            <p className="text-slate-400 text-sm mb-4">
              Aircraft will automatically be added when you scan logbook entries, or you can add them manually above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {aircraft.map(aircraftProfile => {
              const isEditing = editingId === aircraftProfile.id;
              const profile = isEditing ? editedAircraft : aircraftProfile;

              return (
                <div key={aircraftProfile.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{aircraftProfile.aircraftId}</h3>
                      {aircraftProfile.typeCode && (
                        <p className="text-sm text-slate-400">{aircraftProfile.typeCode}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(aircraftProfile.id)}
                            disabled={saving.has(aircraftProfile.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            {saving.has(aircraftProfile.id) ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(aircraftProfile)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(aircraftProfile.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Aircraft ID</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.aircraftId || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, aircraftId: e.target.value.toUpperCase() })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.aircraftId}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Type Code</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.typeCode || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, typeCode: e.target.value.toUpperCase() })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.typeCode || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.year || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, year: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.year || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Make</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.make || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, make: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.make || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Model</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.model || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, model: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.model || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Equipment Type</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.equipmentType || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, equipmentType: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.equipmentType || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Gear Type</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.gearType || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, gearType: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.gearType || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Engine Type</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.engineType || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, engineType: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.engineType || '-'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Category/Class</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profile.categoryClass || ''}
                          onChange={(e) => setEditedAircraft({ ...editedAircraft, categoryClass: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm text-white">{aircraftProfile.categoryClass || '-'}</p>
                      )}
                    </div>
                    <div className="md:col-span-2 flex gap-4 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.complex || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, complex: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-slate-300' : 'text-slate-400'}`}>Complex</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.highPerformance || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, highPerformance: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-slate-300' : 'text-slate-400'}`}>High Performance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.pressurized || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, pressurized: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-slate-300' : 'text-slate-400'}`}>Pressurized</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.taa || false}
                          disabled={!isEditing}
                          onChange={(e) => isEditing && setEditedAircraft({ ...editedAircraft, taa: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className={`text-sm ${isEditing ? 'text-slate-300' : 'text-slate-400'}`}>TAA</span>
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

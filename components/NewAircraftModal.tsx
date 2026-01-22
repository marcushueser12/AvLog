import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeAircraftId } from '../utils/logbookUtils';
import { ICONS } from '../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Dropdown options (shared with AircraftProfilesTab)
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

interface NewAircraftModalProps {
  isOpen: boolean;
  aircraftId: string;
  aircraftType?: string;
  onClose: () => void;
  onCreated: () => void;
}

const NewAircraftModal: React.FC<NewAircraftModalProps> = ({
  isOpen,
  aircraftId,
  aircraftType = '',
  onClose,
  onCreated
}) => {
  const { user, getAccessToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    aircraftId: normalizeAircraftId(aircraftId),
    typeCode: aircraftType || '',
    equipmentType: '',
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

  const handleCreate = async () => {
    if (!user) return;

    setError(null);
    setSaving(true);

    try {
      const token = getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const normalizedId = normalizeAircraftId(formData.aircraftId);
      
      const response = await fetch(`${API_URL}/api/aircraft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aircraftId: normalizedId,
          typeCode: formData.typeCode.trim() || '',
          equipmentType: formData.equipmentType.trim() || '',
          year: formData.year.trim() || '',
          make: formData.make.trim() || '',
          model: formData.model.trim() || '',
          gearType: formData.gearType.trim() || '',
          engineType: formData.engineType.trim() || '',
          categoryClass: formData.categoryClass.trim() || '',
          complex: formData.complex,
          highPerformance: formData.highPerformance,
          pressurized: formData.pressurized,
          taa: formData.taa
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          setError('An aircraft profile with this tail number already exists');
        } else {
          setError(errorData.error || 'Failed to create aircraft profile');
        }
        return;
      }

      onCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating aircraft profile:', error);
      setError(error.message || 'Failed to create aircraft profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Create New Aircraft Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Create a new aircraft profile for <span className="font-bold text-white">{formData.aircraftId}</span>
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Aircraft ID (Tail Number) *</label>
              <input
                type="text"
                value={formData.aircraftId}
                onChange={(e) => {
                  const normalized = normalizeAircraftId(e.target.value);
                  setFormData({ ...formData, aircraftId: normalized });
                }}
                placeholder="N123AB"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Type Code</label>
              <input
                type="text"
                value={formData.typeCode}
                onChange={(e) => setFormData({ ...formData, typeCode: e.target.value.toUpperCase() })}
                placeholder="C172"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Year</label>
              <input
                type="text"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="2020"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Make</label>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                placeholder="Cessna"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="172S"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Gear Type</label>
              <select
                value={findDisplayText(formData.gearType || '', GEAR_TYPE_OPTIONS)}
                onChange={(e) => setFormData({ ...formData, gearType: extractAbbreviation(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Gear Type</option>
                {GEAR_TYPE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Engine Type</label>
              <select
                value={findDisplayText(formData.engineType || '', ENGINE_TYPE_OPTIONS)}
                onChange={(e) => setFormData({ ...formData, engineType: extractAbbreviation(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Engine Type</option>
                {ENGINE_TYPE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-400 mb-2">Category/Class</label>
              <select
                value={findDisplayText(formData.categoryClass || '', CATEGORY_CLASS_OPTIONS)}
                onChange={(e) => setFormData({ ...formData, categoryClass: extractAbbreviation(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  checked={formData.complex}
                  onChange={(e) => setFormData({ ...formData, complex: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-300">Complex</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.highPerformance}
                  onChange={(e) => setFormData({ ...formData, highPerformance: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-300">High Performance</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !formData.aircraftId.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              'Create Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewAircraftModal;

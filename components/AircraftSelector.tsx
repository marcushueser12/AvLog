import React, { useState, useEffect, useRef } from 'react';
import { AircraftProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AircraftSelectorProps {
  value: string; // Current aircraft ID (tail number)
  onChange: (aircraftId: string, aircraftType?: string) => void;
  onTypeChange?: (aircraftType: string) => void; // Optional callback for type change
  className?: string;
  placeholder?: string;
}

const AircraftSelector: React.FC<AircraftSelectorProps> = ({
  value,
  onChange,
  onTypeChange,
  className = '',
  placeholder = 'Tail Number'
}) => {
  const { user, getAccessToken } = useAuth();
  const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadAircraft();
    }
  }, [user, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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

      if (response.ok) {
        const data = await response.json();
        setAircraft(data.aircraft || []);
      }
    } catch (error) {
      console.error('Error loading aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAircraft = aircraft.filter(a => {
    const search = searchTerm.toLowerCase();
    return (
      a.aircraftId.toLowerCase().includes(search) ||
      (a.typeCode && a.typeCode.toLowerCase().includes(search)) ||
      (a.make && a.make.toLowerCase().includes(search)) ||
      (a.model && a.model.toLowerCase().includes(search))
    );
  });

  const handleSelect = (selectedAircraft: AircraftProfile) => {
    onChange(selectedAircraft.aircraftId, selectedAircraft.typeCode || '');
    if (onTypeChange && selectedAircraft.typeCode) {
      onTypeChange(selectedAircraft.typeCode);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
    if (!isOpen && newValue) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (user) {
      setIsOpen(true);
      loadAircraft();
    }
  };

  const currentAircraft = aircraft.find(a => a.aircraftId === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="w-full bg-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2 py-1.5 outline-none text-xs font-bold uppercase"
        />
        {currentAircraft && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-slate-500">
            {currentAircraft.typeCode || currentAircraft.make || ''}
          </div>
        )}
        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {isOpen && user && (
        <div className="absolute z-50 mt-1 w-full max-w-xs bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
          ) : (
            <>
              <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search aircraft..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="py-1">
                {filteredAircraft.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    {searchTerm ? 'No aircraft found' : 'No aircraft profiles. Add one in Aircraft Profiles tab.'}
                  </div>
                ) : (
                  filteredAircraft.map(aircraftProfile => (
                    <button
                      key={aircraftProfile.id}
                      onClick={() => handleSelect(aircraftProfile)}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors ${
                        aircraftProfile.aircraftId === value ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{aircraftProfile.aircraftId}</div>
                          {(aircraftProfile.typeCode || aircraftProfile.make || aircraftProfile.model) && (
                            <div className="text-xs text-slate-400">
                              {aircraftProfile.typeCode || `${aircraftProfile.make || ''} ${aircraftProfile.model || ''}`.trim()}
                            </div>
                          )}
                        </div>
                        {aircraftProfile.aircraftId === value && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AircraftSelector;

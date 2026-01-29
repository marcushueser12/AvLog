import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogbookEntry } from '../types';
import { ICONS } from '../constants';
import AuthModal from './AuthModal';
import EntryEditor from './EntryEditor';
import NewAircraftModal from './NewAircraftModal';
import { reconcileFlightTimes, reconcileIFRData, normalizeAircraftId } from '../utils/logbookUtils';
import { fetchWithRetry } from '../utils/apiUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface VerifiedScan {
  id: string;
  page_number: number | null;
  mode: string;
  status: string;
  timestamp: number | null;
  created_at: string;
}

const PermanentLogTab: React.FC = () => {
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [scans, setScans] = useState<VerifiedScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, LogbookEntry[]>>({});
  const [editableEntries, setEditableEntries] = useState<Record<string, LogbookEntry[]>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [expandedScans, setExpandedScans] = useState<Set<string>>(new Set());
  const [showNewAircraftModal, setShowNewAircraftModal] = useState(false);
  const [newAircraftData, setNewAircraftData] = useState<{ aircraftId: string; aircraftType?: string; entryId?: string } | null>(null);
  const [existingAircraftIds, setExistingAircraftIds] = useState<Set<string>>(new Set());
  const [editingPageNumber, setEditingPageNumber] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      loadVerifiedScans();
      loadExistingAircraft();
    } else {
      setExistingAircraftIds(new Set<string>());
    }
  }, [user]);

  // Load existing aircraft IDs
  const loadExistingAircraft = async () => {
    if (!user) return;

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
        const aircraftIds = new Set<string>(
          (data.aircraft || []).map((a: any) => (a.aircraftId || a.aircraft_id || '').toUpperCase())
        );
        setExistingAircraftIds(aircraftIds);
      }
    } catch (error) {
      console.error('Error loading existing aircraft:', error);
    }
  };

  const handleAircraftIdChange = (entryId: string, aircraftId: string) => {
    if (!user || !aircraftId || !aircraftId.trim()) return;

    const normalized = normalizeAircraftId(aircraftId, false); // Permanent log always uses USA mode
    
    // Check if this aircraft already exists
    if (!existingAircraftIds.has(normalized)) {
      // New aircraft - prompt to create profile
      const scanId = Object.keys(editableEntries).find(sid => 
        editableEntries[sid]?.some(e => e.id === entryId)
      );
      const entry = scanId ? editableEntries[scanId]?.find(e => e.id === entryId) : null;
      
      setNewAircraftData({
        aircraftId: normalized,
        aircraftType: entry?.aircraftType || '',
        entryId: entryId
      });
      setShowNewAircraftModal(true);
      // Add to existing set to prevent duplicate prompts
      setExistingAircraftIds(prev => new Set(prev).add(normalized));
    }
  };

  const handleAircraftCreated = () => {
    // Reload existing aircraft IDs after creation
    loadExistingAircraft();
  };

  // Helper function to parse date for sorting
  const parseDateForSort = (dateStr: string | null | undefined): number => {
    if (!dateStr) return 0;
    // Handle MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.getTime();
    }
    // Try ISO format (YYYY-MM-DD)
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }
    return 0;
  };

  // Auto-extract aircraft from entries and create profiles
  const autoExtractAircraft = async (entriesList: LogbookEntry[]) => {
    if (!user) return;

    try {
      const token = getAccessToken();
      if (!token) return;

      // Get existing aircraft profiles to check for duplicates
      const aircraftResponse = await fetch(`${API_URL}/api/aircraft`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let existingAircraft: string[] = [];
      if (aircraftResponse.ok) {
        const aircraftData = await aircraftResponse.json();
        existingAircraft = (aircraftData.aircraft || []).map((a: any) => (a.aircraftId || a.aircraft_id || '').toUpperCase());
      }

      // Extract unique aircraft from entries
      const uniqueAircraft = new Map<string, { aircraftId: string; aircraftType: string }>();
      entriesList.forEach(entry => {
        if (entry.aircraftId && entry.aircraftId.trim()) {
          const id = normalizeAircraftId(entry.aircraftId, false); // Permanent log always uses USA mode
          // Only add if not already in existing profiles
          if (!existingAircraft.includes(id)) {
            if (!uniqueAircraft.has(id)) {
              uniqueAircraft.set(id, {
                aircraftId: id,
                aircraftType: entry.aircraftType?.trim() || ''
              });
            }
          }
        }
      });

      // Create aircraft profiles for any new aircraft
      for (const [aircraftId, aircraftData] of uniqueAircraft.entries()) {
        try {
          const createResponse = await fetch(`${API_URL}/api/aircraft`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              aircraftId: aircraftData.aircraftId,
              typeCode: aircraftData.aircraftType,
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
            })
          });
          // Don't throw on error - profile might already exist or be created by another process
          if (createResponse.ok) {
            console.log(`Auto-created aircraft profile for ${aircraftId}`);
          }
        } catch (aircraftError) {
          // Silently continue - aircraft profile might already exist
          console.log(`Aircraft profile for ${aircraftId} may already exist`);
        }
      }
    } catch (error) {
      console.error('Error auto-extracting aircraft:', error);
      // Don't block the UI if auto-extraction fails
    }
  };

  const loadVerifiedScans = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      const response = await fetchWithRetry(
        `${API_URL}/api/verified/scans`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        20000, // 20 second timeout
        1 // 1 retry
      );

      if (!response.ok) {
        throw new Error('Failed to load verified scans');
      }

      const data = await response.json();
      setScans(data.scans || []);
      
      // Auto-extract aircraft from entries in permanent log
      // Only load entries for first 10 scans to avoid timeout for users with many pages
      if (data.scans && data.scans.length > 0) {
        const allEntries: LogbookEntry[] = [];
        const scansToProcess = data.scans.slice(0, 10); // Only process first 10 scans
        
        // Load entries in parallel batches of 5
        const batchSize = 5;
        for (let i = 0; i < scansToProcess.length; i += batchSize) {
          const batch = scansToProcess.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (scan) => {
              try {
                const entriesResponse = await fetchWithRetry(
                  `${API_URL}/api/verified/entries/${scan.id}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  },
                  15000, // 15 second timeout
                  1 // 1 retry
                );
                if (entriesResponse && entriesResponse.ok) {
                  const entriesData = await entriesResponse.json();
                  allEntries.push(...(entriesData.entries || []));
                }
              } catch (err) {
                console.error(`Error loading entries for scan ${scan.id}:`, err);
              }
            })
          );
        }
        
        // Auto-extract aircraft from entries
        await autoExtractAircraft(allEntries);
      }
    } catch (error) {
      console.error('Error loading verified scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScanEntries = async (scanId: string) => {
    if (!user || entries[scanId]) return; // Already loaded

    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await fetchWithRetry(
        `${API_URL}/api/verified/entries/${scanId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        20000, // 20 second timeout for large pages
        1 // 1 retry
      );

      if (!response.ok) {
        throw new Error('Failed to load entries');
      }

      const data = await response.json();
      const loadedEntries = data.entries || [];
      
      // Sort entries by date
      const sortedEntries = [...loadedEntries].sort((a, b) => {
        const dateA = parseDateForSort(a.date);
        const dateB = parseDateForSort(b.date);
        return dateA - dateB;
      });
      
      setEntries(prev => ({
        ...prev,
        [scanId]: sortedEntries
      }));
      // Initialize editable entries (copy, already sorted)
      setEditableEntries(prev => ({
        ...prev,
        [scanId]: sortedEntries.map(e => ({ ...e }))
      }));
      
      // Auto-extract aircraft from entries and create profiles if they don't exist
      await autoExtractAircraft(loadedEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const toggleScanExpand = (scanId: string) => {
    setExpandedScans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scanId)) {
        newSet.delete(scanId);
        // Exit edit mode when collapsing
        setIsEditing(prev => {
          const newEdit = { ...prev };
          delete newEdit[scanId];
          return newEdit;
        });
      } else {
        newSet.add(scanId);
        loadScanEntries(scanId);
      }
      return newSet;
    });
  };

  const handleEditScan = (scanId: string) => {
    setIsEditing(prev => ({ ...prev, [scanId]: true }));
    // Initialize editable entries from saved entries if not already set
    if (!editableEntries[scanId] && entries[scanId]) {
      setEditableEntries(prev => ({
        ...prev,
        [scanId]: entries[scanId].map(e => ({ ...e }))
      }));
    }
  };

  const handleCancelEdit = (scanId: string) => {
    setIsEditing(prev => {
      const newEdit = { ...prev };
      delete newEdit[scanId];
      return newEdit;
    });
    // Restore original entries
    if (entries[scanId]) {
      setEditableEntries(prev => ({
        ...prev,
        [scanId]: entries[scanId].map(e => ({ ...e }))
      }));
    }
  };

  const handleUpdateEntry = (scanId: string, entryId: string, field: keyof LogbookEntry, value: string) => {
    setEditableEntries(prev => {
      const scanEntries = prev[scanId] || [];
      const updatedEntries = scanEntries.map(e => {
        if (e.id === entryId) {
          let updatedEntry: LogbookEntry = { ...e, [field]: value };
          
          // Apply reconciliation logic
          if (['totalTime', 'night', 'day'].includes(field)) {
            updatedEntry = { ...updatedEntry, ...reconcileFlightTimes(updatedEntry) } as LogbookEntry;
          }
          
          if (['totalTime', 'instrument', 'simulatedInstrument', 'approaches', 'comments'].includes(field)) {
            updatedEntry = { ...updatedEntry, ...reconcileIFRData(updatedEntry) } as LogbookEntry;
          }
          
          return updatedEntry;
        }
        return e;
      });
      
      // Sort by date if date field was updated
      if (field === 'date') {
        updatedEntries.sort((a, b) => {
          const dateA = parseDateForSort(a.date);
          const dateB = parseDateForSort(b.date);
          return dateA - dateB;
        });
      }
      
      return {
        ...prev,
        [scanId]: updatedEntries
      };
    });
  };

  const handleSaveScan = async (scanId: string) => {
    if (!user) return;

    const scanEntries = editableEntries[scanId] || [];
    if (scanEntries.length === 0) return;

    setSaving(prev => new Set(prev).add(scanId));

    try {
      const token = getAccessToken();
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${API_URL}/api/verified/update-scan`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            scanId,
            entries: scanEntries
          })
        });
      } catch (networkError: any) {
        console.error('Network error:', networkError);
        throw new Error(`Network error: ${networkError.message || 'Failed to connect to server. Please check your connection and try again.'}`);
      }

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (jsonError) {
          // Response might not be JSON, try to get text
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch (textError) {
            // Fall back to status text
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Update saved entries
      setEntries(prev => ({
        ...prev,
        [scanId]: scanEntries.map(e => ({ ...e }))
      }));
      
      // Exit edit mode
      setIsEditing(prev => {
        const newEdit = { ...prev };
        delete newEdit[scanId];
        return newEdit;
      });

      alert('Changes saved successfully!');
    } catch (error: any) {
      console.error('Error saving scan:', error);
      alert(`Failed to save changes: ${error.message}. Please try again.`);
    } finally {
      setSaving(prev => {
        const newSet = new Set(prev);
        newSet.delete(scanId);
        return newSet;
      });
    }
  };

  const handleDeleteEntry = (scanId: string, entryId: string) => {
    setEditableEntries(prev => {
      const scanEntries = prev[scanId] || [];
      return {
        ...prev,
        [scanId]: scanEntries.filter(e => e.id !== entryId)
      };
    });
  };

  const handleUpdateApproaches = (scanId: string, entryId: string, approaches: ApproachDetail[]) => {
    setEditableEntries(prev => {
      const scanEntries = prev[scanId] || [];
      return {
        ...prev,
        [scanId]: scanEntries.map(e => 
          e.id === entryId ? { ...e, approachDetails: approaches } : e
        )
      };
    });
  };

  const handleAddEntry = (scanId: string) => {
    setEditableEntries(prev => {
      const scanEntries = prev[scanId] || [];
      const newEntry: LogbookEntry = {
        id: `new-${Date.now()}`,
        scanId,
        date: scanEntries.length > 0 ? scanEntries[scanEntries.length - 1].date : new Date().toISOString().slice(0, 10),
        aircraftId: '',
        aircraftType: '',
        from: '',
        to: '',
        route: '',
        totalTime: '0.0',
        day: '0.0',
        night: '0.0',
        crossCountry: '',
        pic: '',
        solo: '',
        sic: '',
        dualReceived: '',
        dualGiven: '',
        instrument: '',
        simulatedInstrument: '',
        approaches: '',
        landingsDay: '',
        landingsNight: '',
        groundReceived: '',
        groundGiven: '',
        comments: '',
        isVerified: true
      };
      return {
        ...prev,
        [scanId]: [...scanEntries, newEntry]
      };
    });
  };

  const handleDeleteScan = async (scanId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this verified scan and all its entries? This action cannot be undone.')) {
      return;
    }

    try {
      const token = getAccessToken();
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      const response = await fetch(`${API_URL}/api/verified/scan/${scanId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to delete scan');
      }

      // Remove from local state
      setScans(prev => prev.filter(s => s.id !== scanId));
      setEntries(prev => {
        const newEntries = { ...prev };
        delete newEntries[scanId];
        return newEntries;
      });
      setEditableEntries(prev => {
        const newEntries = { ...prev };
        delete newEntries[scanId];
        return newEntries;
      });
      setExpandedScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(scanId);
        return newSet;
      });

      alert('Scan deleted successfully');
    } catch (error: any) {
      console.error('Error deleting scan:', error);
      alert(`Failed to delete scan: ${error.message}. Please try again.`);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
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
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#007BFF]">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">Create a free account to start</h3>
            <p className="text-[#003366]/70 text-sm mb-6">
              Sign up to access your verified logbook entries that have been saved to your account.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#003366]/20 shiny-button"
            >
              Sign Up Free
            </button>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#003366]/70">Loading your verified entries...</div>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-6 bg-white/80 backdrop-blur-sm/50 border border-[#E2E8F0] rounded-3xl">
            <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Check />
            </div>
            <h3 className="text-xl font-bold text-[#003366] mb-2">No Verified Entries Yet</h3>
            <p className="text-[#003366]/70 text-sm mb-4">
              Once you verify entries in the Scanner Dashboard, they will be saved here permanently.
            </p>
            <p className="text-[#003366]/70 text-xs">
              Go to the Scanner Dashboard to scan and verify your logbook pages.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-[#003366] mb-2">Permanent Log</h2>
          <p className="text-[#003366]/70 text-sm">
            Your verified logbook entries saved to your account. These are stored permanently and can be exported anytime.
          </p>
        </div>

        <div className="space-y-6">
          {scans.map(scan => {
            const isExpanded = expandedScans.has(scan.id);
            const scanEntries = entries[scan.id] || [];
            const currentEntries = isEditing[scan.id] ? (editableEntries[scan.id] || scanEntries) : scanEntries;
            const entriesCount = currentEntries.length;
            const isEditingScan = isEditing[scan.id] || false;
            const isSavingScan = saving.has(scan.id);

            return (
              <div key={scan.id} className="space-y-4">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl overflow-visible md:overflow-hidden">
                  <div className="p-4 border-b border-[#E2E8F0]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#003366]/10 rounded-xl flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#007BFF]">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {editingPageNumber[scan.id] !== undefined ? (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#003366]">Page #</span>
                                <input
                                  type="number"
                                  value={editingPageNumber[scan.id]}
                                  onChange={(e) => {
                                    setEditingPageNumber(prev => ({
                                      ...prev,
                                      [scan.id]: e.target.value
                                    }));
                                  }}
                                  onBlur={async () => {
                                    const newPageNumber = editingPageNumber[scan.id];
                                    const pageNum = newPageNumber === '' ? null : parseInt(newPageNumber, 10);
                                    
                                    // Validate page number
                                    if (newPageNumber !== '' && (isNaN(pageNum) || pageNum < 1)) {
                                      alert('Page number must be a positive integer');
                                      setEditingPageNumber(prev => {
                                        const newState = { ...prev };
                                        delete newState[scan.id];
                                        return newState;
                                      });
                                      return;
                                    }

                                    // Save page number
                                    try {
                                      const token = getAccessToken();
                                      if (!token) {
                                        setShowAuthModal(true);
                                        return;
                                      }

                                      const response = await fetch(`${API_URL}/api/verified/update-scan`, {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                          scanId: scan.id,
                                          pageNumber: pageNum
                                        })
                                      });

                                      if (!response.ok) {
                                        const error = await response.json();
                                        throw new Error(error.message || error.error || 'Failed to update page number');
                                      }

                                      // Update local state
                                      setScans(prev => prev.map(s => 
                                        s.id === scan.id ? { ...s, page_number: pageNum } : s
                                      ));
                                    } catch (error: any) {
                                      console.error('Error updating page number:', error);
                                      alert(`Failed to update page number: ${error.message}`);
                                    } finally {
                                      setEditingPageNumber(prev => {
                                        const newState = { ...prev };
                                        delete newState[scan.id];
                                        return newState;
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      setEditingPageNumber(prev => {
                                        const newState = { ...prev };
                                        delete newState[scan.id];
                                        return newState;
                                      });
                                    }
                                  }}
                                  autoFocus
                                  className="w-20 px-2 py-1 border border-[#007BFF] rounded-lg text-[#003366] font-bold outline-none focus:ring-2 focus:ring-[#007BFF]"
                                  min="1"
                                  placeholder="N/A"
                                />
                              </div>
                            ) : (
                              <h3 
                                className="font-bold text-[#003366] cursor-pointer hover:text-[#007BFF] transition-colors"
                                onClick={() => {
                                  setEditingPageNumber(prev => ({
                                    ...prev,
                                    [scan.id]: scan.page_number?.toString() || ''
                                  }));
                                }}
                                title="Click to edit page number"
                              >
                                Page #{scan.page_number || 'N/A'}
                              </h3>
                            )}
                            <span className="ml-2 text-[#003366]/70 font-normal text-sm">
                              ({scan.mode === 'single' ? 'Single Page' : 'Spread Pair'})
                            </span>
                          </div>
                          <p className="text-xs text-[#003366]/70 mt-1">
                            {entries[scan.id] ? `${entriesCount} entries` : 'Loading...'} • {formatDate(scan.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isExpanded && !isEditingScan && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditScan(scan.id);
                              }}
                              className="px-4 py-2 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteScan(scan.id);
                              }}
                              className="px-4 py-2 bg-red-100 hover:bg-red-200 border border-red-300 text-red-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                              title="Delete this verified scan"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              Delete
                            </button>
                          </>
                        )}
                        {isEditingScan && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit(scan.id);
                              }}
                              className="px-4 py-2 bg-white hover:bg-[#F4F7FA] border border-[#E2E8F0] text-[#003366] rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
                              disabled={isSavingScan}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveScan(scan.id);
                              }}
                              disabled={isSavingScan}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                            >
                              {isSavingScan ? (
                                <>
                                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <ICONS.Check />
                                  Save Changes
                                </>
                              )}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleScanExpand(scan.id)}
                          className="text-[#003366]/70 hover:text-[#007BFF] transition-colors"
                        >
                          {isExpanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15"/>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* EntryEditor when expanded */}
                  {isExpanded && entriesCount > 0 && (
                    <div className="p-2 md:p-4 md:px-4 border-t border-[#E2E8F0] overflow-visible">
                      <EntryEditor
                        entries={currentEntries}
                        images={[]} // No images stored - just data
                        rotations={[0, 0]}
                        twoColumnCards={true}
                        readOnly={!isEditingScan}
                        onAircraftIdChange={handleAircraftIdChange}
                        onUpdate={(entryId, field, value) => {
                          // Allow year adjustment (date field updates) even when not in edit mode
                          // This enables bulk year adjustment functionality
                          if (!isEditingScan && field === 'date') {
                            // Enter edit mode first if not already editing
                            handleEditScan(scan.id);
                            // Small delay to ensure edit mode is set before updating
                            setTimeout(() => {
                              handleUpdateEntry(scan.id, entryId, field, value);
                            }, 0);
                          } else if (isEditingScan) {
                            handleUpdateEntry(scan.id, entryId, field, value);
                          }
                        }}
                        onDelete={(entryId) => {
                          if (isEditingScan) {
                            handleDeleteEntry(scan.id, entryId);
                          }
                        }}
                        onAdd={() => {
                          if (isEditingScan) {
                            handleAddEntry(scan.id);
                          }
                        }}
                        onUpdateApproaches={(entryId, approaches) => {
                          if (isEditingScan) {
                            handleUpdateApproaches(scan.id, entryId, approaches);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Aircraft Modal */}
      {newAircraftData && (
        <NewAircraftModal
          isOpen={showNewAircraftModal}
          aircraftId={newAircraftData.aircraftId}
          aircraftType={newAircraftData.aircraftType}
          onClose={() => {
            setShowNewAircraftModal(false);
            setNewAircraftData(null);
          }}
          onCreated={handleAircraftCreated}
        />
      )}
    </div>
  );
};

export default PermanentLogTab;

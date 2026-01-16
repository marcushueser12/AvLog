import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogbookEntry } from '../types';
import { ICONS } from '../constants';
import AuthModal from './AuthModal';
import EntryEditor from './EntryEditor';
import { reconcileFlightTimes, reconcileIFRData } from '../utils/logbookUtils';

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

  useEffect(() => {
    if (user) {
      loadVerifiedScans();
    }
  }, [user]);

  const loadVerifiedScans = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      const response = await fetch(`${API_URL}/api/verified/scans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load verified scans');
      }

      const data = await response.json();
      setScans(data.scans || []);
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

      const response = await fetch(`${API_URL}/api/verified/entries/${scanId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load entries');
      }

      const data = await response.json();
      const loadedEntries = data.entries || [];
      setEntries(prev => ({
        ...prev,
        [scanId]: loadedEntries
      }));
      // Initialize editable entries (copy)
      setEditableEntries(prev => ({
        ...prev,
        [scanId]: loadedEntries.map(e => ({ ...e }))
      }));
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
      return {
        ...prev,
        [scanId]: scanEntries.map(e => {
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
        })
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

      const response = await fetch(`${API_URL}/api/verified/update-scan`, {
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to save changes');
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
        sic: '',
        dualReceived: '',
        dualGiven: '',
        instrument: '',
        simulatedInstrument: '',
        approaches: '',
        landingsDay: '',
        landingsNight: '',
        comments: '',
        isVerified: true
      };
      return {
        ...prev,
        [scanId]: [...scanEntries, newEntry]
      };
    });
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
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sign In Required</h3>
            <p className="text-slate-400 text-sm mb-6">
              Please sign in to view your verified logbook entries that have been saved to your account.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              Sign In
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
        <div className="text-slate-400">Loading your verified entries...</div>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Check />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Verified Entries Yet</h3>
            <p className="text-slate-400 text-sm mb-4">
              Once you verify entries in the Scanner Dashboard, they will be saved here permanently.
            </p>
            <p className="text-slate-500 text-xs">
              Go to the Scanner Dashboard to scan and verify your logbook pages.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Permanent Log</h2>
          <p className="text-slate-400 text-sm">
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
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-white">
                            Page #{scan.page_number || 'N/A'}
                            <span className="ml-2 text-slate-500 font-normal text-sm">
                              ({scan.mode === 'single' ? 'Single Page' : 'Spread Pair'})
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {entriesCount > 0 ? `${entriesCount} entries` : 'Loading...'} • {formatDate(scan.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isExpanded && !isEditingScan && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditScan(scan.id);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>
                        )}
                        {isEditingScan && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit(scan.id);
                              }}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all"
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
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
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
                          className="text-slate-500 hover:text-slate-300 transition-colors"
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
                    <div className="p-4 border-t border-slate-800">
                      <EntryEditor
                        entries={currentEntries}
                        images={[]} // No images stored - just data
                        rotations={[0, 0]}
                        onUpdate={(entryId, field, value) => {
                          if (isEditingScan) {
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
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PermanentLogTab;

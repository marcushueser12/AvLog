import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogbookEntry } from '../types';
import { ICONS } from '../constants';
import AuthModal from './AuthModal';

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
      setEntries(prev => ({
        ...prev,
        [scanId]: data.entries || []
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
      } else {
        newSet.add(scanId);
        loadScanEntries(scanId);
      }
      return newSet;
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

        <div className="space-y-4">
          {scans.map(scan => {
            const isExpanded = expandedScans.has(scan.id);
            const scanEntries = entries[scan.id] || [];
            const entriesCount = scanEntries.length;

            return (
              <div key={scan.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Header */}
                <div 
                  className="p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => toggleScanExpand(scan.id)}
                >
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
                    <div className="text-slate-500">
                      {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* Entries Table */}
                {isExpanded && entriesCount > 0 && (
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="text-left py-3 px-4 text-slate-400 font-bold text-xs uppercase">Date</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-bold text-xs uppercase">Aircraft</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-bold text-xs uppercase">Route</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">Total</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">PIC</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">Day</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">Night</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">XC</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">Inst</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-bold text-xs uppercase">Approach</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scanEntries.map((entry, idx) => (
                            <tr key={entry.id || idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-300 font-mono text-xs">{entry.date || '-'}</td>
                              <td className="py-3 px-4 text-slate-300">
                                <div className="text-xs">{entry.aircraftId || '-'}</div>
                                <div className="text-xs text-slate-500">{entry.aircraftType || ''}</div>
                              </td>
                              <td className="py-3 px-4 text-slate-300 text-xs">
                                {entry.from && entry.to ? `${entry.from} → ${entry.to}` : entry.route || '-'}
                              </td>
                              <td className="py-3 px-4 text-right text-blue-400 font-mono text-xs">{entry.totalTime || '0.0'}</td>
                              <td className="py-3 px-4 text-right text-slate-300 font-mono text-xs">{entry.pic || '-'}</td>
                              <td className="py-3 px-4 text-right text-slate-300 font-mono text-xs">{entry.day || '0.0'}</td>
                              <td className="py-3 px-4 text-right text-slate-300 font-mono text-xs">{entry.night || '0.0'}</td>
                              <td className="py-3 px-4 text-right text-slate-300 font-mono text-xs">{entry.crossCountry || '-'}</td>
                              <td className="py-3 px-4 text-right text-emerald-400 font-mono text-xs">{entry.instrument || '-'}</td>
                              <td className="py-3 px-4 text-right text-amber-400 font-mono text-xs">{entry.approaches || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PermanentLogTab;

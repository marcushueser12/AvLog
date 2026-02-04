
import React, { useState, useMemo, useEffect } from 'react';
import { LogbookEntry, ScanDocument, ScanMode, AppTab, PageTotals, AircraftProfile, ApproachDetail } from './types';
import { ICONS } from './constants';
import EntryEditor from './components/EntryEditor';
import ScanReviewRow from './components/ScanReviewRow';
import LandingPage from './components/LandingPage';
import TutorialTab from './components/TutorialTab';
import PermanentLogTab from './components/PermanentLogTab';
import AircraftProfilesTab from './components/AircraftProfilesTab';
import ReviewsTab from './components/ReviewsTab';
import AuthModal from './components/AuthModal';
import PaymentModal from './components/PaymentModal';
import SupportRequestModal from './components/SupportRequestModal';
import Logo from './components/Logo';
import LandscapePrompt from './components/LandscapePrompt';
import CloudSelectionModal from './components/CloudSelectionModal';
import { useCloudUploads, markCloudUploadsProcessed, uploadToCloud, prepareImageForCloud, deleteStorageAndMarkProcessed } from './hooks/useCloudUploads';
import { useAuth } from './contexts/AuthContext';
import { extractLogbookEntriesFromPair, extractLogbookEntriesSingle } from './services/geminiService';
import { generateForeFlightCSV, downloadCSV } from './utils/csvUtils';
import { reconcileFlightTimes, reconcileIFRData, normalizeDateSeparator, normalizeAircraftId } from './utils/logbookUtils';
import { fetchWithRetry, safeApiCall } from './utils/apiUtils';
import { getExifOrientation } from './utils/exifUtils';
import { useMobile } from './utils/useMobile';
import { motion } from 'framer-motion';
import { Plane, Grid3x3, FileText, Clock, Home, LogOut, Download, Plus, Trash2, Upload, X, MessageSquare, Headphones, Cloud, ChevronDown } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const App: React.FC = () => {
  const { user, loading: authLoading, getAccessToken, signOut } = useAuth();
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const isMobile = useMobile();
  
  // Load scans and entries from localStorage on mount
  const loadFromLocalStorage = (): { scans: ScanDocument[], entries: LogbookEntry[] } => {
    try {
      const savedScans = localStorage.getItem('logextract_scans');
      const savedEntries = localStorage.getItem('logextract_entries');
      
      if (savedScans) {
        const parsedScans = JSON.parse(savedScans);
        // Filter out verified scans (they're saved to database)
        return {
          scans: parsedScans.filter((s: ScanDocument) => s.status !== 'verified'),
          entries: savedEntries ? JSON.parse(savedEntries).filter((e: LogbookEntry) => !e.isVerified) : []
        };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return { scans: [], entries: [] };
  };

  const { scans: initialScans, entries: initialEntries } = loadFromLocalStorage();
  const [scans, setScans] = useState<ScanDocument[]>(initialScans);
  const [entries, setEntries] = useState<LogbookEntry[]>(initialEntries);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [exportName, setExportName] = useState<string>(`Logbook_Export_${new Date().toISOString().slice(0, 10)}`);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedScans, setExpandedScans] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savingVerified, setSavingVerified] = useState<Set<string>>(new Set());
  const [permanentLogScans, setPermanentLogScans] = useState<any[]>([]);
  const [permanentLogEntries, setPermanentLogEntries] = useState<Record<string, LogbookEntry[]>>({});
  const [logbookStats, setLogbookStats] = useState<{ totalTime: number; pic: number; night: number; instrument: number; crossCountry: number; multiEngine: number }>({ totalTime: 0, pic: 0, night: 0, instrument: 0, crossCountry: 0, multiEngine: 0 });
  const [selectedScansForExport, setSelectedScansForExport] = useState<Set<string>>(new Set());
  const [selectedAircraftForExport, setSelectedAircraftForExport] = useState<Set<string>>(new Set());
  const [loadingPermanentLog, setLoadingPermanentLog] = useState(false);
  const [exportAircraftProfiles, setExportAircraftProfiles] = useState<AircraftProfile[]>([]);
  const [loadingAircraftForExport, setLoadingAircraftForExport] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [existingAircraftIds, setExistingAircraftIds] = useState<Set<string>>(new Set());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [uploadingToCloud, setUploadingToCloud] = useState(false);
  const [uploadedToCloudIds, setUploadedToCloudIds] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { pendingCount: cloudPendingCount, refetch: refetchCloudUploads } = useCloudUploads(user?.id);

  /** Convert data URL (base64) to File for cloud upload (mobile only). */
  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  /** Mobile: upload all pending scan images to cloud (spread pairs get same groupId), then show cards green and remove after delay. Spread: sequential prepare, parallel upload. */
  const handleUploadScansToCloud = async () => {
    if (!user) return;
    const toUpload = scans.filter(
      (s) => s.status !== 'verified' && (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2)
    );
    if (toUpload.length === 0) return;
    setUploadingToCloud(true);
    setUploadedToCloudIds(new Set());
    try {
      for (const scan of toUpload) {
        const groupId = scan.mode === 'spread' && scan.images.length === 2 ? crypto.randomUUID() : undefined;
        if (scan.mode === 'spread' && scan.images.length === 2) {
          const file1 = await dataUrlToFile(scan.images[0], 'page-1.jpg');
          const file2 = await dataUrlToFile(scan.images[1], 'page-2.jpg');
          const prepared1 = await prepareImageForCloud(file1);
          const prepared2 = await prepareImageForCloud(file2);
          await Promise.all([
            uploadToCloud(user.id, prepared1, groupId, { skipPrepare: true }),
            uploadToCloud(user.id, prepared2, groupId, { skipPrepare: true }),
          ]);
        } else {
          const uploads = scan.images.map((img, i) =>
            dataUrlToFile(img, `page-${i + 1}.jpg`).then((file) => uploadToCloud(user.id, file, groupId))
          );
          await Promise.all(uploads);
        }
        setUploadedToCloudIds((prev) => new Set([...prev, scan.id]));
      }
      const idsToRemove = toUpload.map((s) => s.id);
      setTimeout(() => {
        setScans((prev) => prev.filter((s) => !idsToRemove.includes(s.id)));
        setUploadedToCloudIds(new Set());
      }, 1800);
    } catch (err) {
      console.error('Cloud upload failed:', err);
    } finally {
      setUploadingToCloud(false);
    }
  };

  const handleSignIn = (tab: AppTab = 'dashboard') => {
    setView('app');
    setActiveTab(tab);
  };

  const addStagingSlot = (mode: ScanMode) => {
    const newScan: ScanDocument = {
      id: Math.random().toString(36).substr(2, 9),
      images: [],
      mode,
      status: 'pending',
      timestamp: Date.now(),
      expectedEntries: undefined
    };
    setScans(prev => [newScan, ...prev]);
    setActiveTab('dashboard'); 
  };

  const handleUpdateExpectedEntries = (scanId: string, count: number | undefined) => {
    setScans(prev => prev.map(s => s.id === scanId ? { ...s, expectedEntries: count } : s));
  };

  /** Download cloud pages to dashboard as a pending scan; user then clicks Extract. */
  const handleImportFromCloud = (
    images: string[],
    mode: 'single' | 'spread',
    cloudUploadIds: string[]
  ) => {
    const scanId = Math.random().toString(36).substr(2, 9);
    const newScan: ScanDocument = {
      id: scanId,
      images,
      mode,
      status: 'pending',
      timestamp: Date.now(),
      imageRotations: images.map(() => 0),
      sourceCloudUploadIds: cloudUploadIds,
    };
    setScans((prev) => [newScan, ...prev]);
    setActiveTab('dashboard');
    if (cloudUploadIds.length > 0) {
      markCloudUploadsProcessed(cloudUploadIds).catch((e) => console.warn('Mark cloud processed:', e));
      refetchCloudUploads();
    }
  };

  // Lightweight clarity score estimation based on image dimensions
  const estimateClarityScore = (base64: string): Promise<number> => {
    return new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Simple heuristic: larger images and landscape orientation tend to be better
        const aspectRatio = img.width / img.height;
        const totalPixels = img.width * img.height;
        
        // Base score of 70, adjusted by:
        // - Landscape images (+10, better for logbooks)
        // - High resolution (+10 for >2MP)
        let score = 70;
        if (aspectRatio > 1.2) score += 10; // Landscape
        if (totalPixels > 2000000) score += 10; // High resolution
        
        resolve(Math.min(100, Math.max(0, score)));
      };
      img.onerror = () => resolve(75); // Default on error
      img.src = base64;
    });
  };

  const handleImageUpload = async (scanId: string, imageIndex: number, file: File) => {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Extract EXIF orientation and estimate clarity score in parallel
    const [exifRotation, clarityScore] = await Promise.all([
      getExifOrientation(file),
      estimateClarityScore(base64)
    ]);
    
    setScans(prev => prev.map(s => {
      if (s.id === scanId) {
        const newImages = [...s.images];
        newImages[imageIndex] = base64;
        
        // Initialize or update rotation array
        const currentRotations = s.imageRotations || [];
        const newRotations = [...currentRotations];
        newRotations[imageIndex] = exifRotation; // Set initial rotation from EXIF
        
        return { 
          ...s, 
          images: newImages, 
          status: 'pending',
          clarityScore,
          imageRotations: newRotations
        };
      }
      return s;
    }));
  };

  // Initialize aircraft selection when aircraft profiles are loaded
  useEffect(() => {
    if (exportAircraftProfiles.length > 0 && selectedAircraftForExport.size === 0) {
      // Auto-select all aircraft profiles by default
      setSelectedAircraftForExport(new Set(exportAircraftProfiles.map(p => p.id)));
    }
  }, [exportAircraftProfiles]);

  // Save scans and entries to localStorage whenever they change
  // Note: We don't save images to localStorage to avoid quota issues
  useEffect(() => {
    try {
      // Only save non-verified scans and entries
      const unverifiedScans = scans.filter(s => s.status !== 'verified');
      const unverifiedEntries = entries.filter(e => !e.isVerified);
      
      if (unverifiedScans.length > 0 || unverifiedEntries.length > 0) {
        // Remove images from scans before saving to localStorage (they're too large)
        const scansWithoutImages = unverifiedScans.map(scan => ({
          ...scan,
          images: [] // Don't save images to localStorage
        }));
        
        const scansJson = JSON.stringify(scansWithoutImages);
        const entriesJson = JSON.stringify(unverifiedEntries);
        
        // Check size before saving (localStorage limit is ~5-10MB)
        const totalSize = scansJson.length + entriesJson.length;
        const maxSize = 4 * 1024 * 1024; // 4MB limit (conservative)
        
        if (totalSize > maxSize) {
          console.warn('Data too large for localStorage, keeping only recent data');
          // Keep only the most recent scans/entries
          const maxScans = Math.max(1, Math.floor(unverifiedScans.length * 0.5)); // Keep 50%
          const maxEntries = Math.max(10, Math.floor(unverifiedEntries.length * 0.5));
          
          const trimmedScans = scansWithoutImages.slice(0, maxScans);
          const trimmedEntries = unverifiedEntries.slice(0, maxEntries);
          
          localStorage.setItem('logextract_scans', JSON.stringify(trimmedScans));
          localStorage.setItem('logextract_entries', JSON.stringify(trimmedEntries));
        } else {
          localStorage.setItem('logextract_scans', scansJson);
          localStorage.setItem('logextract_entries', entriesJson);
        }
      } else {
        // Clear localStorage if all scans are verified
        localStorage.removeItem('logextract_scans');
        localStorage.removeItem('logextract_entries');
      }
    } catch (error: any) {
      // Handle quota exceeded error gracefully
      if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
        console.warn('localStorage quota exceeded, clearing old data');
        try {
          // Clear old data and try again with reduced data
          localStorage.removeItem('logextract_scans');
          localStorage.removeItem('logextract_entries');
          
          // Save only the most recent 5 scans
          const recentScans = scans
            .filter(s => s.status !== 'verified')
            .slice(0, 5)
            .map(scan => ({ ...scan, images: [] }));
          const recentEntries = entries
            .filter(e => !e.isVerified)
            .slice(0, 50);
          
          if (recentScans.length > 0 || recentEntries.length > 0) {
            localStorage.setItem('logextract_scans', JSON.stringify(recentScans));
            localStorage.setItem('logextract_entries', JSON.stringify(recentEntries));
          }
        } catch (retryError) {
          console.error('Failed to save even after clearing:', retryError);
        }
      } else {
        console.error('Error saving to localStorage:', error);
      }
    }
  }, [scans, entries]);

  // Check for payment success redirect and reload credits
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId && user) {
      // Payment successful, reload credits
      // Using setTimeout to ensure user state is fully loaded
      setTimeout(() => {
        loadUserCredits();
      }, 500);
      
      // Clean up URL by removing query params
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show success message (you could replace console.log with a toast notification)
      console.log('Payment successful! Credits have been added to your account.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, loadUserCredits is stable

  // Load existing aircraft IDs
  const loadExistingAircraft = async () => {
    if (!user) return;

    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await safeApiCall(
        () => fetchWithRetry(`${API_URL}/api/aircraft`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 15000, 1), // 15 second timeout, 1 retry
        null as any,
        'Error loading existing aircraft'
      );

      if (response && response.ok) {
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

  // Load user credits when user changes, and handle user switching
  useEffect(() => {
    if (user) {
      // Check if localStorage has data from a different user
      try {
        const savedUserId = localStorage.getItem('logextract_user_id');
        if (savedUserId && savedUserId !== user.id) {
          // Different user, clear old data
          localStorage.removeItem('logextract_scans');
          localStorage.removeItem('logextract_entries');
          setScans([]);
          setEntries([]);
        }
        // Store current user ID
        localStorage.setItem('logextract_user_id', user.id);
      } catch (error) {
        console.error('Error checking user ID in localStorage:', error);
      }
      
      loadUserCredits();
      loadExistingAircraft();
    } else {
      setUserCredits(0); // Show 0 credits when not logged in
      setExistingAircraftIds(new Set<string>());
      // Clear user ID from localStorage when signed out
      try {
        localStorage.removeItem('logextract_user_id');
      } catch (error) {
        console.error('Error clearing user ID from localStorage:', error);
      }
    }
  }, [user]);

  // Load logbook stats from API (single source of truth - matches permanent log exactly)
  const loadLogbookStats = async () => {
    if (!user) {
      setLogbookStats({ totalTime: 0, pic: 0, night: 0, instrument: 0, crossCountry: 0, multiEngine: 0 });
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/verified/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLogbookStats({
          totalTime: data.totalTime ?? 0,
          pic: data.pic ?? 0,
          night: data.night ?? 0,
          instrument: data.instrument ?? 0,
          crossCountry: data.crossCountry ?? 0,
          multiEngine: data.multiEngine ?? 0,
        });
      }
    } catch (err) {
      console.error('Error loading logbook stats:', err);
    }
  };

  // On mobile, Permanent Log and Aircraft Profiles are hidden; redirect to dashboard if user lands on those tabs
  useEffect(() => {
    if (isMobile && (activeTab === 'permanent-log' || activeTab === 'aircraft')) {
      setActiveTab('dashboard');
      if (user) loadLogbookStats();
    }
  }, [isMobile, activeTab, user]);

  // Refresh stats when switching to dashboard or permanent-log
  useEffect(() => {
    if (user && (activeTab === 'dashboard' || activeTab === 'permanent-log')) {
      loadLogbookStats();
      loadPermanentLogForExport(); // Still load for export modal
    }
  }, [user, activeTab]);

  const loadUserCredits = async () => {
    if (!user) {
      setUserCredits(0); // Show 0 credits for non-authenticated users
      return;
    }

    setLoadingCredits(true);
    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await safeApiCall(
        () => fetchWithRetry(`${API_URL}/api/verified/credits`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 15000, 1), // 15 second timeout, 1 retry
        null as any,
        'Error loading credits'
      );

      if (response && response.ok) {
        const data = await response.json();
        setUserCredits(data.credits || 0);
      }
    } catch (error) {
      console.error('Error loading credits:', error);
    } finally {
      setLoadingCredits(false);
    }
  };

  const processPendingScans = async () => {
    // Check if user is signed in
    if (!user) {
      // Show a more user-friendly modal instead of alert
      const shouldSignUp = window.confirm(
        'Create a free account to start extracting your logbook entries.\n\n' +
        'You\'ll get 3 free credits to get started. No credit card required.\n\n' +
        'Click OK to create your account, or Cancel to continue browsing.'
      );
      if (shouldSignUp) {
        setShowAuthModal(true);
      }
      return;
    }

    // Terms acceptance is only required during sign-up, not for each scan

    // Check if user has enough credits
    if (userCredits === null || userCredits < 1) {
      alert('No credits available. You need at least 1 credit to perform a scan.');
      return;
    }

    const readyScans = scans.filter(s => 
      s.status === 'pending' && 
      (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2)
    );
    
    if (readyScans.length === 0) return;

    // Check if we have enough credits for all scans
    if (userCredits < readyScans.length) {
      alert(`Insufficient credits. You need ${readyScans.length} credit${readyScans.length > 1 ? 's' : ''} but only have ${userCredits}.`);
      return;
    }

    setIsBatchProcessing(true);

    for (const scan of readyScans) {
      setScans(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'processing' } : s));

      try {
        const token = getAccessToken();
        if (!token) {
          setScans(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'error', error: 'Authentication required' } : s));
          continue;
        }

        // Process scan first - no credit deduction yet. Credit is deducted when user approves results.
        let result;
        if (scan.mode === 'single') {
          result = await extractLogbookEntriesSingle(scan.images[0], scan.expectedEntries);
        } else {
          result = await extractLogbookEntriesFromPair(scan.images[0], scan.images[1], scan.expectedEntries);
        }

        // Check if extraction returned any entries (no credit was charged, so no refund needed)
        if (!result.entries || result.entries.length === 0) {
          throw new Error('Extraction returned no entries. No credit was charged. Try again or use a clearer image.');
        }

        const entriesWithScanRef = result.entries.map((e: any) => {
          // Normalize date separator (e.g., "8.5" -> "8/5", "12*10" -> "12/10")
          const normalizedDate = normalizeDateSeparator(e.date || '');
          const normalizedAircraftId = normalizeAircraftId(e.aircraftId || '', false);
          return { ...e, scanId: scan.id, date: normalizedDate, aircraftId: normalizedAircraftId };
        });
        
        setEntries(prev => [...prev, ...entriesWithScanRef]);
        
        // Check for new aircraft IDs after extraction
        // Only check after existing aircraft IDs are loaded
        if (user) {
          // Load existing aircraft if not already loaded, then check for new ones
          if (existingAircraftIds.size === 0) {
            loadExistingAircraft().then(() => {
              // After loading, check again for new aircraft
              entriesWithScanRef.forEach((entry: LogbookEntry) => {
                if (entry.aircraftId && entry.aircraftId.trim()) {
                  const normalized = normalizeAircraftId(entry.aircraftId, false);
                  setExistingAircraftIds(prev => {
                    if (!prev.has(normalized)) {
                      // Track aircraft IDs but don't prompt for profile creation
                      // Users will create profiles in Aircraft Profiles tab after verification
                      return new Set(prev).add(normalized);
                    }
                    return prev;
                  });
                }
              });
            });
          } else {
            // Existing aircraft already loaded, track IDs but don't prompt for profile creation
            entriesWithScanRef.forEach((entry: LogbookEntry) => {
              if (entry.aircraftId && entry.aircraftId.trim()) {
                const normalized = normalizeAircraftId(entry.aircraftId, false);
                if (!existingAircraftIds.has(normalized)) {
                  // Track aircraft IDs but don't prompt for profile creation
                  // Users will create profiles in Aircraft Profiles tab after verification
                  setExistingAircraftIds(prev => new Set(prev).add(normalized));
                }
              }
            });
          }
        }
        
        // Assign page number - count completed scans before this one
        setScans(prev => {
          const completedScans = prev.filter(s => s.status === 'completed').length;
          const pageNumber = completedScans + 1; // Start at 1
          
          return prev.map(s => s.id === scan.id ? { 
            ...s, 
            status: 'completed', 
            resultsCount: result.entries.length,
            extractedTotals: result.pageTotals,
            pageNumber,
            isVerified: false,
            creditApproved: false // User must approve results before editing; credit deducted on approve
          } : s);
        });
      } catch (err: any) {
        console.error("Extraction error:", err);
        const errorMessage = err.message || 'Extraction failed';
        setScans(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'error', error: errorMessage } : s));
        
        // Show error to user
        if (errorMessage.includes('credit')) {
          alert(errorMessage);
        } else {
          alert(`Scan failed: ${errorMessage}`);
        }
      }
    }

    setIsBatchProcessing(false);
    // Reload credits after processing
    if (user) {
      loadUserCredits();
    }
  };

  const handleApproveScan = async (scanId: string) => {
    if (userCredits !== null && userCredits < 1) {
      alert('No credits available. You need at least 1 credit to approve and edit this scan.');
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    try {
      const deductResponse = await fetch(`${API_URL}/api/verified/deduct-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: 1,
          reason: 'Scan approval - user approved extraction results',
        }),
      });
      if (!deductResponse.ok) {
        const err = await deductResponse.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to deduct credit');
      }
      const deductData = await deductResponse.json();
      setUserCredits(deductData.newBalance);
      setScans(prev => prev.map(s => s.id === scanId ? { ...s, creditApproved: true } : s));
    } catch (err: any) {
      alert(err.message || 'Failed to approve scan');
    }
  };

  const handleVerifyScan = async (scanId: string, verified: boolean) => {
    // Mark scan as verified locally and set status to 'verified' to remove from dashboard
    setScans(prev => prev.map(s => s.id === scanId ? { ...s, isVerified: verified, status: verified ? 'verified' : s.status } : s));
    setEntries(prev => prev.map(e => e.scanId === scanId ? { ...e, isVerified: verified } : e));

    // If verified and user is authenticated, save to database
    if (verified && user) {
      const scan = scans.find(s => s.id === scanId);
      if (!scan) return;

      const scanEntries = entries.filter(e => e.scanId === scanId);
      if (scanEntries.length === 0) return;

      setSavingVerified(prev => new Set(prev).add(scanId));

      try {
        const token = getAccessToken();
        if (!token) {
          console.error('No access token available');
          setShowAuthModal(true);
          return;
        }

        const response = await fetch(`${API_URL}/api/verified/save-scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            pageNumber: scan.pageNumber || undefined,
            mode: scan.mode,
            timestamp: scan.timestamp,
            imageRotations: scan.imageRotations || [],
            expectedEntries: scan.expectedEntries || undefined,
            clarityScore: scan.clarityScore || undefined,
            entries: scanEntries
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Backend error response:', error);
          throw new Error(error.message || error.error || 'Failed to save verified scan');
        }

        const result = await response.json();
        console.log('Verified scan saved:', result);
        loadLogbookStats(); // Refresh dashboard stats (Total hrs, cards)
        if (scan.sourceCloudUploadIds?.length && user?.id) {
          try {
            await deleteStorageAndMarkProcessed(user.id, scan.sourceCloudUploadIds);
          } catch (e) {
            console.warn('Failed to delete cloud storage and mark processed:', e);
          }
        }
      } catch (error: any) {
        console.error('Error saving verified scan:', error);
        // Don't un-verify on error, just log it
        alert(`Failed to save verified entries: ${error.message}. Please try again.`);
      } finally {
        setSavingVerified(prev => {
          const newSet = new Set(prev);
          newSet.delete(scanId);
          return newSet;
        });
      }
    } else if (verified && !user) {
      // If user tries to verify but isn't logged in, show auth modal
      setShowAuthModal(true);
      // Un-verify until they log in
      setScans(prev => prev.map(s => s.id === scanId ? { ...s, isVerified: false } : s));
      setEntries(prev => prev.map(e => e.scanId === scanId ? { ...e, isVerified: false } : e));
    }
  };

  const toggleScanExpand = (scanId: string) => {
    setExpandedScans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scanId)) {
        newSet.delete(scanId);
      } else {
        newSet.add(scanId);
      }
      return newSet;
    });
  };

  const deleteScan = (id: string) => {
    setScans(prev => prev.filter(s => s.id !== id));
    setEntries(prev => prev.filter(e => e.scanId !== id));
  };

  const handleUpdateEntry = (id: string, field: keyof LogbookEntry, value: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        // Don't change isVerified status - that should only happen when user explicitly verifies the scan
        let updatedEntry: LogbookEntry = { ...e, [field]: value };
        
        if (['totalTime', 'night', 'day'].includes(field)) {
          updatedEntry = { ...updatedEntry, ...reconcileFlightTimes(updatedEntry) } as LogbookEntry;
        }

        if (['totalTime', 'instrument', 'simulatedInstrument', 'approaches', 'comments'].includes(field)) {
          updatedEntry = { ...updatedEntry, ...reconcileIFRData(updatedEntry) } as LogbookEntry;
        }
        
        return updatedEntry;
      }
      return e;
    }));
  };

  const handleUpdateApproaches = (id: string, approaches: ApproachDetail[]) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, approachDetails: approaches };
      }
      return e;
    }));
  };

  const handleAircraftIdChange = (entryId: string, newAircraftId: string, oldAircraftId?: string) => {
    // Normalize both values for comparison
    const normalized = normalizeAircraftId(newAircraftId || '', false);
    const oldNormalized = oldAircraftId ? normalizeAircraftId(oldAircraftId, false) : '';
    
    // If tail number changed and we have an old value, check if user wants to update all instances
    // Only show popup if old value exists and is different from new value
    if (oldNormalized && oldNormalized !== normalized) {
      // Find all other entries with the old tail number (excluding the current entry)
      const matchingEntries = entries.filter(e => {
        if (e.id === entryId) return false; // Exclude the entry being edited
        const eAircraftId = normalizeAircraftId(e.aircraftId || '', false);
        return eAircraftId === oldNormalized;
      });

      if (matchingEntries.length > 0) {
        const shouldUpdateAll = window.confirm(
          `Found ${matchingEntries.length} other entr${matchingEntries.length === 1 ? 'y' : 'ies'} with tail number ${oldNormalized}.\n\nWould you like to update all of them to ${normalized || '(empty)'}?`
        );

        if (shouldUpdateAll) {
          // Update all matching entries
          matchingEntries.forEach(matchingEntry => {
            setEntries(prev => prev.map(e => 
              e.id === matchingEntry.id 
                ? { ...e, aircraftId: normalized }
                : e
            ));
          });
        }
      }
    }
    // No longer creating aircraft profiles here - users will do that in Aircraft Profiles tab after verification
  };


  const handleDeleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // Load permanent log scans for export selection
  const loadPermanentLogForExport = async () => {
    if (!user) {
      setPermanentLogScans([]);
      setPermanentLogEntries({});
      return;
    }

    setLoadingPermanentLog(true);
    try {
      const token = getAccessToken();
      if (!token) return;

      const response = await safeApiCall(
        () => fetchWithRetry(`${API_URL}/api/verified/scans`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 20000, 1), // 20 second timeout, 1 retry
        null as any,
        'Error loading permanent log for export'
      );

      if (response && response.ok) {
        const data = await response.json();
        setPermanentLogScans(data.scans || []);
        
        // Load all pages for accurate stats (dashboard) and export
        const scansToLoad = data.scans || [];
        
        const entriesMap: Record<string, LogbookEntry[]> = {};
        
        // Load entries in smaller parallel batches of 2 to avoid rate limiting
        const batchSize = 2;
        for (let i = 0; i < scansToLoad.length; i += batchSize) {
          const batch = scansToLoad.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (scan) => {
              try {
                const entriesResponse = await safeApiCall(
                  () => fetchWithRetry(`${API_URL}/api/verified/entries/${scan.id}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  }, 15000, 2), // 15 second timeout, 2 retries (handles 429 errors)
                  null as any,
                  `Error loading entries for scan ${scan.id}`
                );
                if (entriesResponse && entriesResponse.ok) {
                  const entriesData = await entriesResponse.json();
                  entriesMap[scan.id] = entriesData.entries || [];
                }
              } catch (err) {
                console.error(`Error loading entries for scan ${scan.id}:`, err);
              }
            })
          );
          // Add a small delay between batches to avoid overwhelming the rate limiter
          if (i + batchSize < scansToLoad.length) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between batches
          }
        }
        setPermanentLogEntries(entriesMap);
      }
    } catch (error) {
      console.error('Error loading permanent log for export:', error);
    } finally {
      setLoadingPermanentLog(false);
    }
  };

  const loadAircraftForExport = async () => {
    if (!user) {
      setExportAircraftProfiles([]);
      return;
    }

    setLoadingAircraftForExport(true);
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
      setExportAircraftProfiles(data.aircraft || []);
    } catch (error) {
      console.error('Error loading aircraft profiles for export:', error);
    } finally {
      setLoadingAircraftForExport(false);
    }
  };

  const handleExportModalOpen = () => {
    setShowExportModal(true);
    if (user) {
      loadPermanentLogForExport();
      loadAircraftForExport();
    }
    // Initialize selection with all current exportable entries' scan IDs
    const currentScanIds = new Set(entries.filter(e => e.isVerified || scans.find(s => s.id === e.scanId)?.status === 'verified').map(e => e.scanId).filter(Boolean));
    setSelectedScansForExport(currentScanIds);
  };

  // Initialize aircraft selection when aircraft profiles are loaded
  useEffect(() => {
    if (exportAircraftProfiles.length > 0 && selectedAircraftForExport.size === 0) {
      // Auto-select all aircraft profiles by default
      setSelectedAircraftForExport(new Set(exportAircraftProfiles.map(p => p.id)));
    }
  }, [exportAircraftProfiles]);

  const handleExport = async () => {
    // Ensure all selected scans have their entries loaded
    const missingScans = Array.from(selectedScansForExport).filter(
      scanId => !permanentLogEntries[scanId]
    );
    
    if (missingScans.length > 0) {
      // Load missing entries before exporting
      const token = getAccessToken();
      if (token) {
        const entriesMap: Record<string, LogbookEntry[]> = { ...permanentLogEntries };
        const batchSize = 2;
        
        for (let i = 0; i < missingScans.length; i += batchSize) {
          const batch = missingScans.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (scanId) => {
              try {
                const entriesResponse = await safeApiCall(
                  () => fetchWithRetry(`${API_URL}/api/verified/entries/${scanId}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  }, 15000, 2),
                  null as any,
                  `Error loading entries for scan ${scanId}`
                );
                if (entriesResponse && entriesResponse.ok) {
                  const entriesData = await entriesResponse.json();
                  entriesMap[scanId] = entriesData.entries || [];
                }
              } catch (err) {
                console.error(`Error loading entries for scan ${scanId}:`, err);
              }
            })
          );
          if (i + batchSize < missingScans.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        setPermanentLogEntries(entriesMap);
      }
    }

    // Combine current verified entries with selected permanent log entries
    const currentVerifiedEntries = entries.filter(e => {
      const scanId = e.scanId;
      if (!scanId) return false;
      // Include if verified in current session OR if scan ID is selected from permanent log
      return (e.isVerified || scans.find(s => s.id === scanId)?.status === 'verified') || selectedScansForExport.has(scanId);
    });

    // Add selected permanent log entries
    const permanentLogEntriesList: LogbookEntry[] = [];
    selectedScansForExport.forEach(scanId => {
      if (permanentLogEntries[scanId]) {
        permanentLogEntriesList.push(...permanentLogEntries[scanId]);
      }
    });

    // Combine and deduplicate by entry ID
    const allEntries = [...currentVerifiedEntries, ...permanentLogEntriesList];
    const uniqueEntries = Array.from(new Map(allEntries.map(e => [e.id, e])).values());
    
    // Sort by date
    const sortedEntries = uniqueEntries.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return isNaN(dateA) || isNaN(dateB) ? 0 : dateA - dateB;
    });

    // Filter aircraft profiles to only selected ones
    const selectedAircraftProfiles = exportAircraftProfiles.filter(profile => 
      selectedAircraftForExport.has(profile.id)
    );

    const csvContent = generateForeFlightCSV(sortedEntries, selectedAircraftProfiles);
    downloadCSV(csvContent, `${exportName}.csv`);
    setShowExportModal(false);
  };

  const handleSignOut = async () => {
    // Clear localStorage on sign out (scans are tied to session)
    try {
      localStorage.removeItem('logextract_scans');
      localStorage.removeItem('logextract_entries');
      localStorage.removeItem('logextract_user_id');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    await signOut();
    setView('landing');
    // Reset state
    setScans([]);
    setEntries([]);
    // Terms acceptance is only required during sign-up, not on sign-out
  };

  // Grouping logic for the verification queue (Completed but not yet Verified)
  // Exclude verified scans - they should only appear in permanent log
  const pendingVerificationScans = useMemo(() => {
    return scans
      .filter(s => s.status === 'completed' && !s.isVerified)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [scans]);

  // All entries ready for export
  const exportableEntries = useMemo(() => {
    return entries
      .filter(e => e.isVerified || scans.find(s => s.id === e.scanId)?.status === 'verified')
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return isNaN(dateA) || isNaN(dateB) ? 0 : dateA - dateB;
      });
  }, [entries, scans]);

  const entriesByScan = useMemo(() => {
    const map: Record<string, LogbookEntry[]> = {};
    entries.forEach(e => {
      if (e.scanId) {
        if (!map[e.scanId]) map[e.scanId] = [];
        map[e.scanId].push(e);
      }
    });
    // Sort entries within each scan by date
    Object.keys(map).forEach(scanId => {
      map[scanId].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return isNaN(dateA) || isNaN(dateB) ? 0 : dateA - dateB;
      });
    });
    return map;
  }, [entries]);

  // Stats come from API (GET /api/verified/stats) - single source of truth matching permanent log
  const stats = logbookStats;
  const currentTotalTime = logbookStats.totalTime;

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#007BFF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#003366]/70 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return <LandingPage onStart={handleSignIn} />;
  }

  const NavButton = ({ tab, label, icon: Icon }: { tab: AppTab, label: string, icon: React.FC }) => (
    <motion.button 
      onClick={() => {
        setActiveTab(tab);
        if (tab === 'dashboard' && user) loadLogbookStats(); // Refresh totals every time dashboard is opened
      }}
      className={`flex items-center gap-3 px-4 py-3 sm:py-3 rounded-xl font-semibold text-sm transition-all border min-h-[44px] sm:min-h-0 ${activeTab === tab ? 'bg-[#007BFF]/10 text-[#007BFF] border-[#007BFF]/30 shadow-sm' : 'text-[#003366]/70 hover:text-[#003366] hover:bg-[#F4F7FA] border-transparent'}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon />
      {label}
    </motion.button>
  );

  return (
    <>
      <LandscapePrompt show={view === 'app' && !showSupportModal && activeTab !== 'reviews'} />
      <CloudSelectionModal
        open={showCloudModal}
        onClose={() => {
          setShowCloudModal(false);
          refetchCloudUploads();
        }}
        onImport={handleImportFromCloud}
        onRefetchCloud={refetchCloudUploads}
        userId={user?.id}
      />
      <div className="min-h-screen flex-1 min-h-0 flex flex-col overflow-hidden bg-[#F4F7FA] text-[#003366]">
      {/* Desktop Layout - Sidebar and Main Content side-by-side */}
      <div className="hidden lg:flex flex-1 min-w-0 overflow-hidden">
        {/* Desktop Sidebar - Only show on large screens (not mobile landscape) */}
        <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-[#E2E8F0] p-6 flex-col gap-8 shrink-0 shadow-sm flex">
        <motion.div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setView('landing')}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Logo size={32} />
          <span className="text-xl font-black text-[#003366] tracking-tight">LogExtract</span>
        </motion.div>

        <nav className="flex-1 flex flex-col gap-2">
          <NavButton tab="dashboard" label="Scanner Dashboard" icon={() => <Grid3x3 className="w-4 h-4" />} />
          <NavButton tab="permanent-log" label="Permanent Log" icon={() => <FileText className="w-4 h-4" />} />
          <NavButton tab="aircraft" label="Aircraft Profiles" icon={ICONS.Aircraft} />
          <div className="my-4 border-t border-[#E2E8F0]"></div>
          <NavButton tab="tutorial" label="User Guide" icon={() => <FileText className="w-4 h-4" />} />
          <NavButton tab="reviews" label="Reviews" icon={() => <MessageSquare className="w-4 h-4" />} />
          <motion.button 
            onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-3 px-4 py-3 text-[#003366]/70 hover:text-[#003366] hover:bg-[#F4F7FA] rounded-xl font-semibold text-sm transition-all border border-transparent"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Headphones className="w-4 h-4" />
            Support {user && '(My Tickets)'}
          </motion.button>
          <motion.button 
            onClick={() => setView('landing')}
            className="flex items-center gap-3 px-4 py-3 text-[#003366]/70 hover:text-[#003366] hover:bg-[#F4F7FA] rounded-xl font-semibold text-sm transition-all border border-transparent"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-4 h-4" />
            Exit to Home
          </motion.button>
        </nav>
      </aside>

      {/* Desktop Main Content Area */}
      <main className="hidden lg:flex flex-1 flex flex-col min-w-0 bg-[#F4F7FA]">
        {/* Desktop Header - Only show on large screens */}
        <header className="h-14 px-6 border-b border-[#E2E8F0] items-center justify-between bg-white/70 backdrop-blur-md sticky top-0 z-20 shrink-0 shadow-sm flex">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <h2 className="text-sm sm:text-base font-bold text-[#003366] truncate">
              {activeTab === 'dashboard' ? 'Logbook Digitizer' : 
               activeTab === 'permanent-log' ? 'Permanent Log' :
               activeTab === 'tutorial' ? 'Tutorial' : 
               activeTab === 'aircraft' ? 'Aircraft' :
               activeTab === 'reviews' ? 'Reviews' : 'Dashboard'}
            </h2>
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-[#007BFF]/10 rounded-lg border border-[#007BFF]/20 text-[#007BFF] text-[10px] font-bold">
              <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full animate-pulse"></span>
              OCR
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-lg border border-[#E2E8F0] shadow-sm">
              <span className="text-xs text-[#003366]/70 font-medium">Total:</span>
              <span className="text-sm font-mono text-[#007BFF] font-bold">{currentTotalTime.toFixed(1)}h</span>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  if (!user) {
                    setShowAuthModal(true);
                  } else if (userCredits === 0) {
                    setShowPaymentModal(true);
                  }
                }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg border transition-all text-xs sm:text-sm font-semibold min-h-[44px] sm:min-h-0 ${
                  !user || userCredits === 0
                    ? 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200 cursor-pointer' 
                    : 'bg-[#007BFF]/10 border-[#007BFF]/30 text-[#007BFF] cursor-default'
                }`}
                title={!user ? 'Create an account to get 3 free credits' : userCredits === 0 ? 'Click to buy credits' : `${userCredits} credit${userCredits !== 1 ? 's' : ''} available`}
              >
                <span>Credits</span>
                <span>{loadingCredits ? '...' : `${userCredits ?? 0}`}</span>
              </button>
              {user && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center justify-center p-1.5 sm:p-1.5 bg-[#007BFF]/10 hover:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-lg text-xs font-semibold transition-all min-h-[44px] sm:min-h-0"
                  title="Buy more credits"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
            {user ? (
              <>
                <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 bg-white/80 rounded-lg border border-[#E2E8F0] shadow-sm">
                  <span className="text-xs text-[#003366]/70 font-medium truncate max-w-[120px]">{user.email?.split('@')[0]}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 sm:px-2.5 py-2 sm:py-1.5 bg-white/80 hover:bg-[#F4F7FA] text-[#003366]/70 hover:text-[#003366] rounded-lg transition-all border border-[#E2E8F0] min-h-[44px] sm:min-h-0"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-2 sm:py-1.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-lg text-sm font-semibold transition-all border border-[#003366] min-h-[44px] sm:min-h-0"
              >
                Sign In
              </button>
            )}
            <motion.button 
              onClick={handleExportModalOpen}
              className="px-3 py-2 sm:py-1.5 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-[#003366]/20 flex items-center gap-1.5 min-h-[44px] sm:min-h-0 shiny-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
              {exportableEntries.length > 0 && (
                <span className="text-xs bg-[#007BFF] px-1.5 py-0.5 rounded font-bold">{exportableEntries.length}</span>
              )}
            </motion.button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 md:pb-8">
          {/* All tabs are now accessible without authentication */}
          {activeTab === 'reviews' ? (
            <ReviewsTab />
          ) : activeTab === 'tutorial' ? (
            <TutorialTab />
          ) : activeTab === 'permanent-log' ? (
            <PermanentLogTab onPermanentLogChange={() => { loadLogbookStats(); loadPermanentLogForExport(); }} />
          ) : activeTab === 'dashboard' ? (
            <div className="space-y-10">
              {/* Bento Grid Stats */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-6 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#003366]/70">Total Time</span>
                    <Clock className="w-5 h-5 text-[#007BFF]" />
                  </div>
                  <p className="text-3xl font-black text-[#003366]">{stats.totalTime.toFixed(1)}</p>
                  <p className="text-xs text-[#003366]/60 mt-1">hours</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-6 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#003366]/70">PIC</span>
                    <Plane className="w-5 h-5 text-[#007BFF]" />
                  </div>
                  <p className="text-3xl font-black text-[#003366]">{stats.pic.toFixed(1)}</p>
                  <p className="text-xs text-[#003366]/60 mt-1">hours</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-6 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#003366]/70">Cross Country</span>
                    <Plane className="w-5 h-5 text-[#007BFF]" />
                  </div>
                  <p className="text-3xl font-black text-[#003366]">{stats.crossCountry.toFixed(1)}</p>
                  <p className="text-xs text-[#003366]/60 mt-1">hours</p>
                </motion.div>
              </motion.section>

              <section className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-[#003366]">Staging Area</h3>
                    <p className="text-xs md:text-sm text-[#003366]/70">The software verifies row alignment and image clarity before extraction.</p>
                  </div>
                    <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex flex-wrap gap-3">
                        <motion.button 
                          onClick={() => addStagingSlot('single')}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Single
                        </motion.button>
                        <motion.button 
                          onClick={() => addStagingSlot('spread')}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Spread
                        </motion.button>
                      </div>
                    </div>
                    
                    <motion.button 
                      onClick={processPendingScans}
                      disabled={isBatchProcessing || !user || (userCredits !== null && userCredits < 1) || !scans.some(s => s.status === 'pending' && (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2))}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#003366]/20 min-h-[44px] shiny-button w-full sm:w-auto"
                      title={!user ? 'Sign in required' : (userCredits !== null && userCredits < 1) ? 'Insufficient credits' : 'Start extraction (1 credit when you approve results)'}
                      whileHover={{ scale: isBatchProcessing || !user || (userCredits !== null && userCredits < 1) ? 1 : 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isBatchProcessing ? (
                        <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Reconciling...</>
                      ) : (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Extraction</>
                      )}
                    </motion.button>
                  </div>
                </div>

                {scans.filter(s => s.status !== 'verified').length === 0 ? (
                  <div className="h-48 border-2 border-dashed border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center gap-3 text-[#003366]/60 bg-white/50 backdrop-blur-sm">
                    <div className="p-4 bg-[#F4F7FA] rounded-2xl">
                        <Upload className="w-8 h-8 text-[#007BFF]" />
                    </div>
                    <p className="text-sm font-medium">Create a scan slot and upload your logbook pages.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {scans.filter(s => s.status !== 'verified').map(scan => (
                      <motion.div
                        key={scan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative flex flex-col bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl overflow-hidden group hover:border-[#007BFF]/30 hover:shadow-lg transition-all shadow-sm"
                      >
                        <div className="p-3 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F4F7FA]/50">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'processing' ? 'bg-[#007BFF] animate-pulse' : 'bg-amber-500'}`}></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#003366]/70">
                                {scan.mode === 'single' ? 'Single' : 'Spread'}
                            </span>
                          </div>
                          
                          {scan.clarityScore !== undefined && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded-full border border-[#E2E8F0]">
                              <div className={`w-1 h-1 rounded-full ${scan.clarityScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                              <span className="text-[8px] font-bold text-[#003366]/70">CLARITY: {scan.clarityScore}%</span>
                            </div>
                          )}

                          <button onClick={() => deleteScan(scan.id)} className="p-1 text-[#003366]/60 hover:text-red-500 transition-colors ml-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 p-4 grid gap-3" style={{ gridTemplateColumns: scan.mode === 'spread' ? '1fr 1fr' : '1fr' }}>
                          {[...Array(scan.mode === 'spread' ? 2 : 1)].map((_, i) => (
                            <div key={i} className="relative aspect-[3/4] bg-[#F4F7FA] border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col items-center justify-center">
                              {scan.images[i] ? (
                                <img src={scan.images[i]} className={`w-full h-full object-cover ${scan.status === 'completed' ? 'opacity-30' : 'opacity-70'}`} />
                              ) : (
                                <>
                                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImageUpload(scan.id, i, e.target.files[0])} />
                                  <div className="text-[#007BFF] mb-2"><Plus className="w-6 h-6" /></div>
                                  <span className="text-[10px] font-bold text-[#003366]/70 uppercase">Page {i+1}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        {scan.status === 'pending' && (
                          <div className="px-4 pb-4">
                            <div className="flex items-center justify-between gap-2 bg-[#F4F7FA] p-2.5 rounded-xl border border-[#E2E8F0]">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#003366]/70 uppercase tracking-tight">Expected Rows:</span>
                                <input 
                                  type="number" 
                                  min="1"
                                  max="50"
                                  value={scan.expectedEntries || ''}
                                  placeholder="?"
                                  onChange={(e) => handleUpdateExpectedEntries(scan.id, e.target.value ? parseInt(e.target.value) : undefined)}
                                  className="w-10 bg-transparent border-0 text-xs font-mono text-[#007BFF] focus:outline-none placeholder:text-[#003366]/40"
                                />
                              </div>
                              <div className="group/hint relative cursor-help">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#003366]/60 hover:text-[#003366] transition-colors"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-white border border-[#E2E8F0] rounded-lg shadow-xl text-[10px] text-[#003366]/80 leading-tight opacity-0 group-hover/hint:opacity-100 transition-opacity pointer-events-none z-50">
                                  Providing an expected count helps the AI find faint rows that might otherwise be missed.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {scan.status === 'completed' && scan.extractedTotals && (
                            <div className="px-4 py-2 bg-[#F4F7FA] border-t border-[#E2E8F0]">
                               <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-[#003366]/70">PAGE TOTALS</span>
                                  <span className="text-[#007BFF]">{scan.extractedTotals.totalTime} HRS</span>
                               </div>
                            </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              {entries.filter(e => !e.isVerified).length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-[#003366]">Verification Queue</h3>
                      <p className="text-sm text-slate-500">
                        Results are grouped by page scan and auto-sorted by date. 
                        <span className="text-amber-400/80 font-medium"> Tip: Manually verify dates when handwriting is unclear or ambiguous.</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-12">
                    {pendingVerificationScans.map(scan => {
                      // Filter out verified entries - they should only appear in permanent log
                      const scanEntries = (entriesByScan[scan.id] || []).filter(e => !e.isVerified);
                      if (scanEntries.length === 0) return null;

                      const isExpanded = expandedScans.has(scan.id);
                      const pageNumber = scan.pageNumber || 1;
                      const isVerified = scan.isVerified || false;
                      
                      // Calculate totals from entries (same as EntryEditor does)
                      const calculatedTotals: PageTotals = {
                        totalTime: scanEntries.reduce((acc, e) => acc + (parseFloat(e.totalTime) || 0), 0).toFixed(1),
                        day: scanEntries.reduce((acc, e) => acc + (parseFloat(e.day) || 0), 0).toFixed(1),
                        night: scanEntries.reduce((acc, e) => acc + (parseFloat(e.night) || 0), 0).toFixed(1),
                        crossCountry: scanEntries.reduce((acc, e) => acc + (parseFloat(e.crossCountry) || 0), 0).toFixed(1),
                        pic: scanEntries.reduce((acc, e) => acc + (parseFloat(e.pic) || 0), 0).toFixed(1),
                        sic: scanEntries.reduce((acc, e) => acc + (parseFloat(e.sic) || 0), 0).toFixed(1),
                        dualReceived: scanEntries.reduce((acc, e) => acc + (parseFloat(e.dualReceived) || 0), 0).toFixed(1),
                        dualGiven: scanEntries.reduce((acc, e) => acc + (parseFloat(e.dualGiven) || 0), 0).toFixed(1),
                        instrument: scanEntries.reduce((acc, e) => acc + (parseFloat(e.instrument) || 0), 0).toFixed(1),
                        simulatedInstrument: scanEntries.reduce((acc, e) => acc + (parseFloat(e.simulatedInstrument) || 0), 0).toFixed(1),
                        approaches: scanEntries.reduce((acc, e) => acc + (parseInt(e.approaches) || 0), 0).toString(),
                        landingsDay: scanEntries.reduce((acc, e) => acc + (parseInt(e.landingsDay) || 0), 0).toString(),
                        landingsNight: scanEntries.reduce((acc, e) => acc + (parseInt(e.landingsNight) || 0), 0).toString()
                      };

                      return (
                        <div key={scan.id} className="space-y-4">
                          {/* Collapsed summary row */}
                          {!isExpanded && (
                            <ScanReviewRow
                              pageNumber={pageNumber}
                              totals={calculatedTotals}
                              isExpanded={isExpanded}
                              isVerified={isVerified}
                              creditApproved={scan.creditApproved ?? true}
                              onToggleExpand={() => toggleScanExpand(scan.id)}
                              onToggleVerify={(checked) => handleVerifyScan(scan.id, checked)}
                              onApprove={() => handleApproveScan(scan.id)}
                              userCredits={userCredits}
                            />
                          )}

                          {/* Expanded EntryEditor */}
                          {isExpanded && (
                            <>
                              <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-white text-sm">
                                      Page #{pageNumber}
                                      <span className="ml-2 text-slate-500 font-normal">
                                        ({scan.mode === 'single' ? 'Single Page' : 'Spread Pair'})
                                      </span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">
                                      {scanEntries.length} {scanEntries.length === 1 ? 'Entry' : 'Entries'} Extracted
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => toggleScanExpand(scan.id)}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-400 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                  >
                                    Collapse
                                  </button>
                                  <button 
                                    onClick={() => deleteScan(scan.id)}
                                    className="text-[10px] font-bold text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                  >
                                    <ICONS.Trash /> Remove Page
                                  </button>
                                </div>
                              </div>

                              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-1">
                                <EntryEditor 
                                  entries={scanEntries}
                                  images={scan.images}
                                  rotations={scan.imageRotations}
                                  readOnly={!(scan.creditApproved ?? true)}
                                  onUpdate={handleUpdateEntry}
                                  onAircraftIdChange={handleAircraftIdChange}
                                  forceTableOnMobile={true}
                                  onRotationChange={(imageIndex, newRotation) => {
                                    setScans(prev => prev.map(s => {
                                      if (s.id === scan.id) {
                                        const newRotations = [...(s.imageRotations || [0, 0])];
                                        newRotations[imageIndex] = newRotation;
                                        return { ...s, imageRotations: newRotations };
                                      }
                                      return s;
                                    }));
                                  }} 
                                  onDelete={(id) => {
                                      setEntries(prev => prev.filter(e => e.id !== id));
                                  }}
                                  onAdd={() => {
                                    const newEntry: LogbookEntry = {
                                      id: `manual-${Date.now()}`,
                                      scanId: scan.id,
                                      date: scanEntries.length > 0 ? scanEntries[scanEntries.length - 1].date : new Date().toISOString().slice(0, 10),
                                      aircraftId: "",
                                      aircraftType: "",
                                      from: "",
                                      to: "",
                                      route: "",
                                      totalTime: "0.0",
                                      day: "0.0",
                                      night: "0.0",
                                      crossCountry: "",
                                      pic: "",
                                      solo: "",
                                      sic: "",
                                      dualReceived: "",
                                      dualGiven: "",
                                      instrument: "",
                                      simulatedInstrument: "",
                                      approaches: "",
                                      landingsDay: "",
                                      landingsNight: "",
                                      groundReceived: "",
                                      groundGiven: "",
                                      comments: "",
                                      isVerified: false
                                    };
                                    setEntries(prev => [...prev, newEntry]);
                                  }}
                                  onUpdateApproaches={handleUpdateApproaches}
                                />
                                <div className="p-4 bg-slate-950/50 flex justify-between items-center">
                                    {(scan.creditApproved ?? true) ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isVerified}
                                      onChange={(e) => handleVerifyScan(scan.id, e.target.checked)}
                                      disabled={savingVerified.has(scan.id)}
                                      className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50"
                                    />
                                    <span className="text-sm font-bold text-slate-400">
                                      {savingVerified.has(scan.id) ? 'Saving...' : 'Mark as Verified'}
                                    </span>
                                  </label>
                                    ) : (
                                  <button
                                    onClick={() => handleApproveScan(scan.id)}
                                    disabled={userCredits !== null && userCredits < 1}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                      userCredits !== null && userCredits >= 1
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                        : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {userCredits !== null && userCredits < 1 ? 'Need 1 credit to edit' : 'Approve & start editing (1 credit)'}
                                  </button>
                                    )}
                                  <button 
                                    onClick={() => toggleScanExpand(scan.id)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                                  >
                                    Collapse Review
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : activeTab === 'aircraft' ? (
            <AircraftProfilesTab />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
               <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-600">
                  <ICONS.Plane />
               </div>
               <h2 className="text-2xl font-black text-white capitalize">{(activeTab as string).replace('-', ' ')}</h2>
               <p className="text-slate-500 max-w-sm">This module is currently being optimized for high-volume data visualization. Check back soon for your personalized pilot analytics.</p>
               <button onClick={() => { setActiveTab('dashboard'); if (user) loadLogbookStats(); }} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all">Back to Dashboard</button>
            </div>
          )}
        </div>
      </main>
      </div>
      {/* End Desktop Layout */}

      {/* Mobile Top Bar - Single row, logo | tabs | spacer | actions; taller buttons (lg:hidden only) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm min-h-[56px] flex items-center">
        <div className="px-2 sm:px-3 py-2 flex items-center gap-1 sm:gap-2 min-w-0 w-full">
          <button
            type="button"
            onClick={() => setView('landing')}
            className="flex items-center gap-1.5 shrink-0 min-h-[48px] min-w-[44px] pl-1 pr-1 rounded-lg active:bg-[#F4F7FA] transition-colors"
            aria-label="Back to home"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Logo size={24} />
            </div>
            <span className="text-sm font-black text-[#003366] truncate max-w-[100px] sm:max-w-[120px]">LogExtract</span>
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex items-center gap-1 min-h-[48px] px-3 py-2 rounded-lg border border-[#007BFF]/30 bg-[#007BFF]/10 text-[#007BFF] text-xs font-semibold whitespace-nowrap"
              aria-expanded={mobileMenuOpen}
              aria-haspopup="listbox"
            >
              {activeTab === 'dashboard' ? 'Scanner' : activeTab === 'tutorial' ? 'Help' : 'Reviews'}
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white rounded-xl border border-[#E2E8F0] shadow-lg" role="listbox">
                  <button
                    type="button"
                    role="option"
                    onClick={() => { setActiveTab('dashboard'); if (user) loadLogbookStats(); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold ${activeTab === 'dashboard' ? 'bg-[#007BFF]/10 text-[#007BFF]' : 'text-[#003366]'}`}
                  >
                    Scanner
                  </button>
                  <button
                    type="button"
                    role="option"
                    onClick={() => { setActiveTab('tutorial'); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold ${activeTab === 'tutorial' ? 'bg-[#007BFF]/10 text-[#007BFF]' : 'text-[#003366]'}`}
                  >
                    Help
                  </button>
                  <button
                    type="button"
                    role="option"
                    onClick={() => { setActiveTab('reviews'); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold ${activeTab === 'reviews' ? 'bg-[#007BFF]/10 text-[#007BFF]' : 'text-[#003366]'}`}
                  >
                    Reviews
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0 shrink min-h-0" aria-hidden="true" />
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={() => { if (!user) setShowAuthModal(true); else if (userCredits === 0) setShowPaymentModal(true); }}
              className={`flex items-center gap-1 min-h-[48px] px-2 py-2 rounded-lg border transition-all text-xs font-semibold shrink-0 ${!user || userCredits === 0 ? 'bg-red-100 border-red-300 text-red-600' : 'bg-[#007BFF]/10 border-[#007BFF]/30 text-[#007BFF]'}`}
              title={!user ? 'Create an account to get 3 free credits' : userCredits === 0 ? 'Buy credits' : `${userCredits} credit${userCredits !== 1 ? 's' : ''} available`}
            >
              <span className="text-[10px]">C:</span>
              <span>{loadingCredits ? '...' : `${userCredits ?? 0}`}</span>
            </button>
            {user && (
              <button onClick={() => setShowPaymentModal(true)} className="flex items-center justify-center min-h-[48px] min-w-[44px] p-2 bg-[#007BFF]/10 active:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-lg transition-all shrink-0" title="Buy more credits">
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setShowSupportModal(true)} className="flex items-center justify-center min-h-[48px] min-w-[44px] p-2 bg-[#007BFF]/10 active:bg-[#007BFF]/20 border border-[#007BFF]/30 text-[#007BFF] rounded-lg transition-all shrink-0" title={user ? "Support & My Tickets" : "Support"}>
              <Headphones className="w-5 h-5" />
            </button>
            {user ? (
              <button onClick={handleSignOut} className="flex items-center justify-center min-h-[48px] min-w-[44px] p-2 bg-[#F4F7FA] active:bg-[#E2E8F0] text-[#003366]/70 rounded-lg shrink-0" title="Sign Out">
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="min-h-[48px] px-2.5 py-2 bg-[#003366] active:bg-[#003366]/90 text-white rounded-lg text-xs font-semibold shrink-0">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Main Content - Permanent Log and Aircraft tabs hidden on mobile; show dashboard for those */}
      <main className="lg:hidden flex-1 min-h-0 flex flex-col min-w-0 bg-[#F4F7FA] overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-4 overscroll-contain touch-pan-y">
          {(() => {
            const mobileTab = isMobile && (activeTab === 'permanent-log' || activeTab === 'aircraft') ? 'dashboard' : activeTab;
            return mobileTab === 'reviews' ? (
              <ReviewsTab />
            ) : mobileTab === 'tutorial' ? (
              <TutorialTab />
            ) : mobileTab === 'permanent-log' ? (
              <PermanentLogTab onPermanentLogChange={() => { loadLogbookStats(); loadPermanentLogForExport(); }} />
            ) : mobileTab === 'dashboard' ? (
            isMobile ? (
              <div className="space-y-4">
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-3 gap-2">
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">Total</span><Clock className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.totalTime.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">PIC</span><Plane className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.pic.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">XC</span><Plane className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.crossCountry.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                </motion.section>
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#003366]">Staging Area</h3>
                    <p className="text-[10px] text-[#003366]/70">Add photos to the cards below, then upload to the cloud. Open on desktop to extract.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button onClick={() => addStagingSlot('single')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-lg text-[10px] font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Plus className="w-3.5 h-3.5" /> Single</motion.button>
                      <motion.button onClick={() => addStagingSlot('spread')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-lg text-[10px] font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Plus className="w-3.5 h-3.5" /> Spread</motion.button>
                    </div>
                    <motion.button
                      onClick={handleUploadScansToCloud}
                      disabled={uploadingToCloud || !user || !scans.some((s) => s.status !== 'verified' && (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2))}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#007BFF] hover:bg-[#007BFF]/90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-bold transition-all shadow-lg shadow-[#007BFF]/20 min-h-[44px] w-full"
                      whileHover={{ scale: uploadingToCloud || !user ? 1 : 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {uploadingToCloud ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Uploading…</>
                      ) : (
                        <><Cloud className="w-4 h-4" /> Upload to cloud</>
                      )}
                    </motion.button>
                  </div>
                </section>
                {scans.filter(s => s.status !== 'verified').length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center gap-2 text-[#003366]/60 bg-white/50 backdrop-blur-sm">
                    <div className="p-3 bg-[#F4F7FA] rounded-xl"><Upload className="w-6 h-6 text-[#007BFF]" /></div>
                    <p className="text-[11px] font-medium">Create a scan slot and add your logbook photos. Then upload to the cloud.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {scans.filter(s => s.status !== 'verified').map(scan => {
                      const justUploaded = uploadedToCloudIds.has(scan.id);
                      return (
                      <motion.div key={scan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`relative flex flex-col backdrop-blur-sm rounded-xl overflow-hidden group transition-all shadow-sm ${justUploaded ? 'bg-emerald-50 border-2 border-emerald-500 shadow-emerald-200' : 'bg-white/80 border border-[#E2E8F0] hover:border-[#007BFF]/30 hover:shadow-lg'}`}>
                        <div className={`p-2 border-b flex items-center justify-between ${justUploaded ? 'border-emerald-300 bg-emerald-100/50' : 'border-[#E2E8F0] bg-[#F4F7FA]/50'}`}>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${justUploaded ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-[#003366]/70">{justUploaded ? 'Uploaded' : (scan.mode === 'single' ? 'Single' : 'Spread')}</span>
                          </div>
                          {!justUploaded && (
                            <button onClick={() => deleteScan(scan.id)} className="p-0.5 text-[#003366]/60 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </div>
                        <div className="flex-1 p-2 grid gap-2" style={{ gridTemplateColumns: scan.mode === 'spread' ? '1fr 1fr' : '1fr' }}>
                          {[...Array(scan.mode === 'spread' ? 2 : 1)].map((_, i) => (
                            <div key={i} className="relative aspect-[3/4] bg-[#F4F7FA] border border-[#E2E8F0] rounded-lg overflow-hidden flex flex-col items-center justify-center">
                              {scan.images[i] ? (
                                <img src={scan.images[i]} className="w-full h-full object-cover opacity-90" alt="" />
                              ) : (
                                <>
                                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImageUpload(scan.id, i, e.target.files[0])} />
                                  <div className="text-[#007BFF] mb-1"><Plus className="w-4 h-4" /></div>
                                  <span className="text-[8px] font-bold text-[#003366]/70 uppercase">Page {i + 1}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );})}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[#003366]/60 text-xs">
                  <Cloud className="w-4 h-4 shrink-0" />
                  <span>Photos upload to the cloud. Open LogExtract on desktop → Import from Cloud, then click Extract on the dashboard.</span>
                </div>
                {!user && (
                  <div className="text-center p-3 bg-white/80 rounded-xl border border-[#E2E8F0]">
                    <p className="text-[11px] text-[#003366]/70">Sign in to upload photos to the cloud.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-3 gap-2">
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">Total</span><Clock className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.totalTime.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">PIC</span><Plane className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.pic.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                  <motion.div className="p-3 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-semibold text-[#003366]/70">XC</span><Plane className="w-3 h-3 text-[#007BFF]" /></div>
                    <p className="text-lg font-black text-[#003366]">{stats.crossCountry.toFixed(1)}</p>
                    <p className="text-[8px] text-[#003366]/60">hrs</p>
                  </motion.div>
                </motion.section>
                <section className="space-y-3">
                  <div><h3 className="text-sm font-bold text-[#003366]">Staging Area</h3><p className="text-[10px] text-[#003366]/70">The software verifies row alignment and image clarity before extraction.</p></div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button onClick={() => addStagingSlot('single')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-lg text-[10px] font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Plus className="w-3.5 h-3.5" /> Single</motion.button>
                      <motion.button onClick={() => addStagingSlot('spread')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-[#E2E8F0] text-[#003366] rounded-lg text-[10px] font-semibold transition-all shadow-sm hover:shadow-md min-h-[44px]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Plus className="w-3.5 h-3.5" /> Spread</motion.button>
                    </div>
                    <motion.button onClick={processPendingScans} disabled={isBatchProcessing || !user || (userCredits !== null && userCredits < 1) || !scans.some(s => s.status === 'pending' && (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2))} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003366] hover:bg-[#003366]/90 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-bold transition-all shadow-lg shadow-[#003366]/20 min-h-[44px] shiny-button w-full" title={!user ? 'Sign in required' : (userCredits !== null && userCredits < 1) ? 'Insufficient credits' : 'Start extraction (1 credit when you approve results)'} whileHover={{ scale: isBatchProcessing || !user || (userCredits !== null && userCredits < 1) ? 1 : 1.05 }} whileTap={{ scale: 0.95 }}>
                      {isBatchProcessing ? (<><span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Reconciling...</>) : (<><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Extraction</>)}
                    </motion.button>
                  </div>
                </section>
                {scans.filter(s => s.status !== 'verified').length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center gap-2 text-[#003366]/60 bg-white/50 backdrop-blur-sm">
                    <div className="p-3 bg-[#F4F7FA] rounded-xl"><Upload className="w-6 h-6 text-[#007BFF]" /></div>
                    <p className="text-[11px] font-medium">Create a scan slot and upload your logbook pages.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {scans.filter(s => s.status !== 'verified').map(scan => {
                      const justUploaded = uploadedToCloudIds.has(scan.id);
                      return (
                      <motion.div key={scan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`relative flex flex-col backdrop-blur-sm rounded-xl overflow-hidden group transition-all shadow-sm ${justUploaded ? 'bg-emerald-50 border-2 border-emerald-500 shadow-emerald-200' : 'bg-white/80 border border-[#E2E8F0] hover:border-[#007BFF]/30 hover:shadow-lg'}`}>
                        <div className={`p-2 border-b flex items-center justify-between ${justUploaded ? 'border-emerald-300 bg-emerald-100/50' : 'border-[#E2E8F0] bg-[#F4F7FA]/50'}`}>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${justUploaded ? 'bg-emerald-500' : scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'processing' ? 'bg-[#007BFF] animate-pulse' : 'bg-amber-500'}`}></div>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-[#003366]/70">{justUploaded ? 'Uploaded' : (scan.mode === 'single' ? 'Single' : 'Spread')}</span>
                          </div>
                          {!justUploaded && (
                            <button onClick={() => deleteScan(scan.id)} className="p-0.5 text-[#003366]/60 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </div>
                        <div className="flex-1 p-2 grid gap-2" style={{ gridTemplateColumns: scan.mode === 'spread' ? '1fr 1fr' : '1fr' }}>
                          {[...Array(scan.mode === 'spread' ? 2 : 1)].map((_, i) => (
                            <div key={i} className="relative aspect-[3/4] bg-[#F4F7FA] border border-[#E2E8F0] rounded-lg overflow-hidden flex flex-col items-center justify-center">
                              {scan.images[i] ? (<img src={scan.images[i]} className={`w-full h-full object-cover ${scan.status === 'completed' ? 'opacity-30' : 'opacity-70'}`} />) : (<><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImageUpload(scan.id, i, e.target.files[0])} /><div className="text-[#007BFF] mb-1"><Plus className="w-4 h-4" /></div><span className="text-[8px] font-bold text-[#003366]/70 uppercase">Page {i+1}</span></>)}
                            </div>
                          ))}
                        </div>
                        {scan.status === 'pending' && (
                          <div className="px-2 pb-2">
                            <div className="flex items-center justify-between gap-1.5 bg-[#F4F7FA] p-1.5 rounded-lg border border-[#E2E8F0]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-bold text-[#003366]/70 uppercase tracking-tight">Rows:</span>
                                <input type="number" min="1" max="50" value={scan.expectedEntries || ''} placeholder="?" onChange={(e) => handleUpdateExpectedEntries(scan.id, e.target.value ? parseInt(e.target.value) : undefined)} className="w-8 bg-transparent border-0 text-[10px] font-mono text-[#007BFF] focus:outline-none placeholder:text-[#003366]/40" />
                              </div>
                            </div>
                          </div>
                        )}
                        {scan.status === 'completed' && scan.extractedTotals && (
                          <div className="px-2 py-1.5 bg-[#F4F7FA] border-t border-[#E2E8F0]">
                            <div className="flex justify-between items-center text-[8px] font-bold"><span className="text-[#003366]/70">TOTALS</span><span className="text-[#007BFF]">{scan.extractedTotals.totalTime} HRS</span></div>
                          </div>
                        )}
                      </motion.div>
                    );})}
                  </div>
                )}
                {entries.filter(e => !e.isVerified).length > 0 && (
                  <section className="space-y-4">
                    <div><h3 className="text-sm font-bold text-[#003366]">Verification Queue</h3><p className="text-[10px] text-slate-500">Results are grouped by page scan and auto-sorted by date.</p></div>
                    <div className="space-y-6">
                      {pendingVerificationScans.map(scan => {
                        const scanEntries = (entriesByScan[scan.id] || []).filter(e => !e.isVerified);
                        if (scanEntries.length === 0) return null;
                        const isExpanded = expandedScans.has(scan.id);
                        const pageNumber = scan.pageNumber || 1;
                        const isVerified = scan.isVerified || false;
                        const calculatedTotals: PageTotals = { totalTime: scanEntries.reduce((acc, e) => acc + (parseFloat(e.totalTime) || 0), 0).toFixed(1), day: scanEntries.reduce((acc, e) => acc + (parseFloat(e.day) || 0), 0).toFixed(1), night: scanEntries.reduce((acc, e) => acc + (parseFloat(e.night) || 0), 0).toFixed(1), crossCountry: scanEntries.reduce((acc, e) => acc + (parseFloat(e.crossCountry) || 0), 0).toFixed(1), pic: scanEntries.reduce((acc, e) => acc + (parseFloat(e.pic) || 0), 0).toFixed(1), sic: scanEntries.reduce((acc, e) => acc + (parseFloat(e.sic) || 0), 0).toFixed(1), dualReceived: scanEntries.reduce((acc, e) => acc + (parseFloat(e.dualReceived) || 0), 0).toFixed(1), dualGiven: scanEntries.reduce((acc, e) => acc + (parseFloat(e.dualGiven) || 0), 0).toFixed(1), instrument: scanEntries.reduce((acc, e) => acc + (parseFloat(e.instrument) || 0), 0).toFixed(1), simulatedInstrument: scanEntries.reduce((acc, e) => acc + (parseFloat(e.simulatedInstrument) || 0), 0).toFixed(1), approaches: scanEntries.reduce((acc, e) => acc + (parseInt(e.approaches) || 0), 0).toString(), landingsDay: scanEntries.reduce((acc, e) => acc + (parseInt(e.landingsDay) || 0), 0).toString(), landingsNight: scanEntries.reduce((acc, e) => acc + (parseInt(e.landingsNight) || 0), 0).toString() };
                        return (
                          <div key={scan.id} className="space-y-3">
                            {!isExpanded && (
                              <ScanReviewRow pageNumber={pageNumber} totals={calculatedTotals} isExpanded={isExpanded} isVerified={isVerified} creditApproved={scan.creditApproved ?? true} onToggleExpand={() => toggleScanExpand(scan.id)} onToggleVerify={(checked) => handleVerifyScan(scan.id, checked)} onApprove={() => handleApproveScan(scan.id)} userCredits={userCredits} />
                            )}
                            {isExpanded && (
                              <>
                                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-1">
                                  <EntryEditor entries={scanEntries} readOnly={!(scan.creditApproved ?? true)} images={scan.images} rotations={scan.imageRotations} onUpdate={handleUpdateEntry} onAircraftIdChange={handleAircraftIdChange} forceTableOnMobile={true} onRotationChange={(imageIndex, newRotation) => { setScans(prev => prev.map(s => { if (s.id === scan.id) { const newRotations = [...(s.imageRotations || [0, 0])]; newRotations[imageIndex] = newRotation; return { ...s, imageRotations: newRotations }; } return s; })); }} onDelete={(id) => { setEntries(prev => prev.filter(e => e.id !== id)); }} onAdd={() => { const newEntry: LogbookEntry = { id: `manual-${Date.now()}`, scanId: scan.id, date: scanEntries.length > 0 ? scanEntries[scanEntries.length - 1].date : new Date().toISOString().slice(0, 10), aircraftId: "", aircraftType: "", from: "", to: "", route: "", totalTime: "0.0", day: "0.0", night: "0.0", crossCountry: "", pic: "", solo: "", sic: "", dualReceived: "", dualGiven: "", instrument: "", simulatedInstrument: "", approaches: "", landingsDay: "", landingsNight: "", groundReceived: "", groundGiven: "", comments: "", isVerified: false }; setEntries(prev => [...prev, newEntry]); }} onUpdateApproaches={handleUpdateApproaches} />
                                  <div className="p-2 bg-slate-950/50 flex justify-between items-center">
                                    {(scan.creditApproved ?? true) ? (
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={isVerified} onChange={(e) => handleVerifyScan(scan.id, e.target.checked)} disabled={savingVerified.has(scan.id)} className="w-4 h-4 rounded border-2 border-slate-600 bg-slate-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50" />
                                        <span className="text-[10px] font-bold text-slate-400">{savingVerified.has(scan.id) ? 'Saving...' : 'Mark as Verified'}</span>
                                      </label>
                                    ) : (
                                      <button onClick={() => handleApproveScan(scan.id)} disabled={userCredits !== null && userCredits < 1} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${userCredits !== null && userCredits >= 1 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}>{userCredits !== null && userCredits < 1 ? 'Need 1 credit to edit' : 'Approve & start editing (1 credit)'}</button>
                                    )}
                                    <button onClick={() => toggleScanExpand(scan.id)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold transition-all">Collapse</button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {!user && (
                  <div className="text-center p-3 bg-white/80 rounded-xl border border-[#E2E8F0]">
                    <p className="text-[11px] text-[#003366]/70">Create a free account to start digitizing your logbook</p>
                  </div>
                )}
              </div>
            )
          ) : mobileTab === 'aircraft' ? (
            <AircraftProfilesTab />
          ) : null;
          })()}
        </div>
      </main>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowExportModal(false)}></div>
          <div className="relative bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2 text-[#003366]">Export to Logbook CSV</h3>
            
            {/* Current verified entries count */}
            {exportableEntries.length > 0 && (
              <p className="text-[#003366]/70 text-sm mb-4">
                {exportableEntries.length} verified {exportableEntries.length === 1 ? 'entry' : 'entries'} from current session will be included.
              </p>
            )}

            {/* Permanent log selection */}
            {user && permanentLogScans.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-[#003366]">Select from Permanent Log:</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // Select all pages
                        setSelectedScansForExport(new Set(permanentLogScans.map(scan => scan.id)));
                      }}
                      className="text-xs text-[#007BFF] hover:text-[#007BFF]/80 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-[#003366]/30">|</span>
                    <button
                      onClick={() => {
                        // Deselect all
                        setSelectedScansForExport(new Set());
                      }}
                      className="text-xs text-[#007BFF] hover:text-[#007BFF]/80 font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                {loadingPermanentLog ? (
                  <div className="text-[#003366]/70 text-sm py-4">Loading saved entries...</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-[#E2E8F0] rounded-2xl p-4 bg-[#F4F7FA]">
                    {permanentLogScans.map(scan => {
                      const scanEntries = permanentLogEntries[scan.id] || [];
                      const isSelected = selectedScansForExport.has(scan.id);
                      return (
                        <label
                          key={scan.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#007BFF] cursor-pointer transition-all bg-white/80 backdrop-blur-sm"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedScansForExport);
                              if (e.target.checked) {
                                newSet.add(scan.id);
                              } else {
                                newSet.delete(scan.id);
                              }
                              setSelectedScansForExport(newSet);
                            }}
                            className="w-5 h-5 text-[#007BFF] bg-white border-[#E2E8F0] rounded focus:ring-[#007BFF] focus:ring-2"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[#003366]">
                              Page #{scan.page_number || 'N/A'} ({scan.mode === 'single' ? 'Single' : 'Spread'})
                            </div>
                            <div className="text-xs text-[#003366]/70 mt-0.5">
                              {scanEntries.length} {scanEntries.length === 1 ? 'entry' : 'entries'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedScansForExport.size > 0 && (
                  <p className="text-emerald-600 text-xs mt-3 font-medium">
                    {Array.from(selectedScansForExport).reduce((total, scanId) => total + (permanentLogEntries[scanId]?.length || 0), 0)} entries selected from permanent log
                  </p>
                )}
              </div>
            )}

            {/* Aircraft profiles selection */}
            {user && exportAircraftProfiles.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-[#003366] mb-3">Select Aircraft Profiles:</h4>
                {loadingAircraftForExport ? (
                  <div className="text-[#003366]/70 text-sm py-4">Loading aircraft profiles...</div>
                ) : (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Select all aircraft profiles
                          setSelectedAircraftForExport(new Set(exportAircraftProfiles.map(p => p.id)));
                        }}
                        className="text-xs text-[#007BFF] hover:text-[#007BFF]/80 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-[#003366]/30">|</span>
                      <button
                        onClick={() => {
                          // Deselect all
                          setSelectedAircraftForExport(new Set());
                        }}
                        className="text-xs text-[#007BFF] hover:text-[#007BFF]/80 font-medium"
                      >
                        Deselect All
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-[#E2E8F0] rounded-2xl p-4 bg-[#F4F7FA]">
                      {exportAircraftProfiles.map(profile => {
                        const isSelected = selectedAircraftForExport.has(profile.id);
                        return (
                          <label
                            key={profile.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#007BFF] cursor-pointer transition-all bg-white/80 backdrop-blur-sm"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSet = new Set(selectedAircraftForExport);
                                if (e.target.checked) {
                                  newSet.add(profile.id);
                                } else {
                                  newSet.delete(profile.id);
                                }
                                setSelectedAircraftForExport(newSet);
                              }}
                              className="w-5 h-5 text-[#007BFF] bg-white border-[#E2E8F0] rounded focus:ring-[#007BFF] focus:ring-2"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-bold text-[#003366]">
                                {profile.aircraftId}
                                {profile.typeCode && <span className="text-[#003366]/70 ml-2">({profile.typeCode})</span>}
                              </div>
                              <div className="text-xs text-[#003366]/70 mt-0.5">
                                {profile.make && profile.model ? `${profile.make} ${profile.model}` : profile.equipmentType || 'No details'}
                                {profile.year && ` • ${profile.year}`}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {selectedAircraftForExport.size > 0 && (
                      <p className="text-emerald-600 text-xs mt-3 font-medium">
                        {selectedAircraftForExport.size} {selectedAircraftForExport.size === 1 ? 'aircraft profile' : 'aircraft profiles'} selected
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Total count */}
            {(() => {
              const currentCount = exportableEntries.length;
              const permanentCount = Array.from(selectedScansForExport).reduce((total, scanId) => total + (permanentLogEntries[scanId]?.length || 0), 0);
              const totalCount = currentCount + permanentCount;
              return (
                <p className="text-[#007BFF] text-sm mb-6 font-bold">
                  Total: {totalCount} {totalCount === 1 ? 'entry' : 'entries'} will be exported
                </p>
              );
            })()}

            <div className="relative mb-6">
                <label className="text-xs text-[#003366]/70 mb-2 block">Export filename:</label>
                <input 
                    type="text" 
                    value={exportName}
                    onChange={(e) => setExportName(e.target.value)}
                    className="w-full bg-white border border-[#E2E8F0] p-4 rounded-2xl outline-none focus:border-[#007BFF] transition-all font-mono text-sm text-[#003366]"
                />
            </div>
            <button 
              onClick={handleExport}
              className="w-full py-4 bg-[#003366] hover:bg-[#003366]/90 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-[#003366]/20"
            >
              Download Logbook CSV
            </button>
            <button onClick={() => setShowExportModal(false)} className="w-full mt-4 py-2 text-[#003366]/70 hover:text-[#003366] font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          // Reload credits after successful payment
          if (user) {
            loadUserCredits();
          }
        }}
      />

      {/* Support Modal - access from sidebar/mobile */}
      <SupportRequestModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setShowTermsModal(false)}
        >
          <div 
            className="bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-[#003366]">Terms of Service</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-[#003366]/60 hover:text-[#003366] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-[#003366]">
              <p className="text-sm text-[#003366]/70 mb-4"><strong>Last Updated: January 23, 2026</strong></p>
              
              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">1. Acceptance of Terms</h3>
              <p className="text-[#003366]/70 mb-6">
                By uploading a logbook, you agree to these terms. You must be at least 18 years old and hold a valid pilot certificate or be a student pilot.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">2. The "PIC" Responsibility (Crucial)</h3>
              <p className="text-[#003366]/70 mb-3">
                LogExtract provides an AI-powered conversion tool. The Pilot in Command (PIC) remains the sole authority for the accuracy of their logbook under 14 CFR § 61.51.
              </p>
              <p className="text-[#003366]/70 mb-3">
                <strong>Our service is a digitization aid, not a certified record-keeping system.</strong>
              </p>
              <p className="text-[#003366]/70 mb-6">
                You must verify every entry generated by our AI against your original paper records before signing or submitting them for official FAA use (checkrides, insurance, etc.).
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">3. Limitation of Liability</h3>
              <p className="text-[#003366]/70 mb-3">We are not liable for:</p>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li>Fines, license suspensions, or "709 rides" resulting from inaccurate digital entries.</li>
                <li>Denied insurance claims or job applications due to logbook discrepancies.</li>
                <li>Loss of data due to technical failure. Always keep your original paper logs.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">4. Billing & Credits</h3>
              <ul className="list-disc list-inside space-y-2 text-[#003366]/70 mb-6">
                <li><strong>Credit System</strong>: Conversions are charged per page or per entry as specified at the time of purchase.</li>
                <li><strong>Refunds</strong>: Credits are deducted only when you approve extraction results. If results are poor, discard and try again—no credit charged.</li>
              </ul>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">5. Termination</h3>
              <p className="text-[#003366]/70 mb-6">
                We reserve the right to suspend accounts that attempt to "stress test" or reverse-engineer our AI extraction prompts or infrastructure.
              </p>

              <h3 className="text-lg font-bold text-[#003366] mt-6 mb-3">Contact Us</h3>
              <p className="text-[#003366]/70">
                If you have questions about these Terms of Service, please contact us through our support channels.
              </p>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
    </>
  );
};

export default App;

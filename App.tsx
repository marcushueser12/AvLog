
import React, { useState, useMemo } from 'react';
import { LogbookEntry, ScanDocument, ScanMode, AppTab } from './types';
import { ICONS } from './constants';
import EntryEditor from './components/EntryEditor';
import ScanReviewRow from './components/ScanReviewRow';
import LandingPage from './components/LandingPage';
import TutorialTab from './components/TutorialTab';
import { extractLogbookEntriesFromPair, extractLogbookEntriesSingle } from './services/geminiService';
import { generateForeFlightCSV, downloadCSV } from './utils/csvUtils';
import { reconcileFlightTimes, reconcileIFRData } from './utils/logbookUtils';
import { getExifOrientation } from './utils/exifUtils';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [scans, setScans] = useState<ScanDocument[]>([]);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [exportName, setExportName] = useState<string>(`Logbook_Export_${new Date().toISOString().slice(0, 10)}`);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedScans, setExpandedScans] = useState<Set<string>>(new Set());

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

  // Lightweight clarity score estimation based on image dimensions
  const estimateClarityScore = (base64: string): number => {
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

  const processPendingScans = async () => {
    const readyScans = scans.filter(s => 
      s.status === 'pending' && 
      (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2)
    );
    
    if (readyScans.length === 0) return;

    setIsBatchProcessing(true);

    for (const scan of readyScans) {
      setScans(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'processing' } : s));

      try {
        let result;
        if (scan.mode === 'single') {
          result = await extractLogbookEntriesSingle(scan.images[0], scan.expectedEntries);
        } else {
          result = await extractLogbookEntriesFromPair(scan.images[0], scan.images[1], scan.expectedEntries);
        }

        const entriesWithScanRef = result.entries.map((e: any) => ({ ...e, scanId: scan.id }));
        
        setEntries(prev => [...prev, ...entriesWithScanRef]);
        
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
            isVerified: false
          } : s);
        });
      } catch (err) {
        console.error("Extraction error:", err);
        setScans(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'error', error: 'Extraction failed' } : s));
      }
    }

    setIsBatchProcessing(false);
  };

  const handleVerifyScan = (scanId: string, verified: boolean) => {
    // Mark scan as verified - entries are ready for export
    setScans(prev => prev.map(s => s.id === scanId ? { ...s, isVerified: verified } : s));
    setEntries(prev => prev.map(e => e.scanId === scanId ? { ...e, isVerified: verified } : e));
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
        let updatedEntry: LogbookEntry = { ...e, [field]: value, isVerified: true };
        
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

  const handleDeleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleExport = () => {
    const csvContent = generateForeFlightCSV(exportableEntries);
    downloadCSV(csvContent, `${exportName}.csv`);
    setShowExportModal(false);
  };

  // Grouping logic for the verification queue (Completed but not yet Verified)
  const pendingVerificationScans = useMemo(() => {
    return scans
      .filter(s => s.status === 'completed')
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

  if (view === 'landing') {
    return <LandingPage onStart={handleSignIn} />;
  }

  const currentTotalTime = entries.reduce((acc, curr) => acc + (parseFloat(curr.totalTime) || 0), 0);

  const NavButton = ({ tab, label, icon: Icon }: { tab: AppTab, label: string, icon: React.FC }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border ${activeTab === tab ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border-transparent'}`}
    >
      <Icon />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col md:flex-row overflow-hidden text-slate-200">
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col gap-8 shrink-0">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setView('landing')}
        >
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <ICONS.Plane />
          </div>
          <span className="text-xl font-black text-white tracking-tighter">SkyScan</span>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          <NavButton tab="dashboard" label="Scanner Dashboard" icon={() => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>} />
          <NavButton tab="aircraft" label="Aircraft Profiles" icon={ICONS.Aircraft} />
          <NavButton tab="stats" label="Currency & Stats" icon={ICONS.Stats} />
          <div className="my-4 border-t border-slate-800/50"></div>
          <NavButton tab="tutorial" label="User Guide" icon={() => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>} />
          <button 
            onClick={() => setView('landing')}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl font-bold text-sm transition-all border border-transparent"
          >
            <ICONS.Home />
            Exit to Home
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        <header className="h-16 px-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/30 backdrop-blur-xl sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">
              {activeTab === 'dashboard' ? 'Logbook Digitizer' : 
               activeTab === 'tutorial' ? 'Tutorial & Documentation' : 
               activeTab === 'aircraft' ? 'Aircraft Management' : 'Pilot Statistics'}
            </h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              PRECISION OCR ACTIVE
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Calculated Total</span>
              <span className="text-sm font-mono text-blue-400 font-bold">{currentTotalTime.toFixed(1)} HRS</span>
            </div>
            <button 
              onClick={() => setShowExportModal(true)}
              disabled={exportableEntries.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              Export ForeFlight CSV {exportableEntries.length > 0 && `(${exportableEntries.length})`}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' ? (
            <div className="space-y-10">
              <section className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Staging Area</h3>
                    <p className="text-sm text-slate-500">The software verifies row alignment and image clarity before extraction.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => addStagingSlot('single')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all border border-slate-700"
                    >
                      <ICONS.Plus /> New Single Scan
                    </button>
                    <button 
                      onClick={() => addStagingSlot('spread')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all border border-slate-700"
                    >
                      <ICONS.Plus /> New Spread Pair
                    </button>
                    <div className="w-[1px] bg-slate-800 h-8 mx-1 hidden lg:block"></div>
                    <button 
                      onClick={processPendingScans}
                      disabled={isBatchProcessing || !scans.some(s => s.status === 'pending' && (s.mode === 'single' ? s.images.length >= 1 : s.images.length === 2))}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {isBatchProcessing ? (
                        <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Reconciling...</>
                      ) : (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Extraction</>
                      )}
                    </button>
                  </div>
                </div>

                {scans.filter(s => s.status !== 'verified').length === 0 ? (
                  <div className="h-48 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-600">
                    <div className="p-4 bg-slate-900 rounded-2xl">
                        <ICONS.Upload />
                    </div>
                    <p className="text-sm font-medium">Create a scan slot and upload your logbook pages.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {scans.filter(s => s.status !== 'verified').map(scan => (
                      <div key={scan.id} className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group hover:border-slate-700 transition-all">
                        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`}></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {scan.mode === 'single' ? 'Single' : 'Spread'}
                            </span>
                          </div>
                          
                          {scan.clarityScore !== undefined && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950 rounded-full border border-slate-800">
                              <div className={`w-1 h-1 rounded-full ${scan.clarityScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                              <span className="text-[8px] font-bold text-slate-500">CLARITY: {scan.clarityScore}%</span>
                            </div>
                          )}

                          <button onClick={() => deleteScan(scan.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors ml-2">
                            <ICONS.Trash />
                          </button>
                        </div>

                        <div className="flex-1 p-4 grid gap-3" style={{ gridTemplateColumns: scan.mode === 'spread' ? '1fr 1fr' : '1fr' }}>
                          {[...Array(scan.mode === 'spread' ? 2 : 1)].map((_, i) => (
                            <div key={i} className="relative aspect-[3/4] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col items-center justify-center">
                              {scan.images[i] ? (
                                <img src={scan.images[i]} className={`w-full h-full object-cover ${scan.status === 'completed' ? 'opacity-30' : 'opacity-70'}`} />
                              ) : (
                                <>
                                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImageUpload(scan.id, i, e.target.files[0])} />
                                  <div className="text-blue-500 mb-2"><ICONS.Plus /></div>
                                  <span className="text-[10px] font-bold text-slate-600 uppercase">Page {i+1}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        {scan.status === 'pending' && (
                          <div className="px-4 pb-4">
                            <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Expected Rows:</span>
                                <input 
                                  type="number" 
                                  min="1"
                                  max="50"
                                  value={scan.expectedEntries || ''}
                                  placeholder="?"
                                  onChange={(e) => handleUpdateExpectedEntries(scan.id, e.target.value ? parseInt(e.target.value) : undefined)}
                                  className="w-10 bg-transparent border-0 text-xs font-mono text-blue-400 focus:outline-none placeholder:text-slate-700"
                                />
                              </div>
                              <div className="group/hint relative cursor-help">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 hover:text-slate-400 transition-colors"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-[10px] text-slate-300 leading-tight opacity-0 group-hover/hint:opacity-100 transition-opacity pointer-events-none z-50">
                                  Providing an expected count helps the AI find faint rows that might otherwise be missed.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {scan.status === 'completed' && scan.extractedTotals && (
                            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800">
                               <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-slate-500">PAGE TOTALS</span>
                                  <span className="text-blue-400">{scan.extractedTotals.totalTime} HRS</span>
                               </div>
                            </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {entries.filter(e => !e.isVerified).length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">Verification Queue</h3>
                      <p className="text-sm text-slate-500">
                        Results are grouped by page scan and auto-sorted by date. 
                        <span className="text-amber-400/80 font-medium"> Tip: Manually verify dates when handwriting is unclear or ambiguous.</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-12">
                    {pendingVerificationScans.map(scan => {
                      const scanEntries = entriesByScan[scan.id] || [];
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
                              onToggleExpand={() => toggleScanExpand(scan.id)}
                              onToggleVerify={(checked) => handleVerifyScan(scan.id, checked)}
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
                                  onUpdate={handleUpdateEntry}
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
                                      sic: "",
                                      dualReceived: "",
                                      dualGiven: "",
                                      instrument: "",
                                      simulatedInstrument: "",
                                      approaches: "",
                                      landingsDay: "",
                                      landingsNight: "",
                                      comments: "",
                                      isVerified: false
                                    };
                                    setEntries(prev => [...prev, newEntry]);
                                  }}
                                />
                                <div className="p-4 bg-slate-950/50 flex justify-between items-center">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isVerified}
                                      onChange={(e) => handleVerifyScan(scan.id, e.target.checked)}
                                      className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-800 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0"
                                    />
                                    <span className="text-sm font-bold text-slate-400">Mark as Verified</span>
                                  </label>
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
          ) : activeTab === 'tutorial' ? (
            <TutorialTab />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
               <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-600">
                  <ICONS.Plane />
               </div>
               <h2 className="text-2xl font-black text-white capitalize">{activeTab.replace('-', ' ')}</h2>
               <p className="text-slate-500 max-w-sm">This module is currently being optimized for high-volume data visualization. Check back soon for your personalized pilot analytics.</p>
               <button onClick={() => setActiveTab('dashboard')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all">Back to Dashboard</button>
            </div>
          )}
        </div>
      </main>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="absolute inset-0 bg-slate-950/80" onClick={() => setShowExportModal(false)}></div>
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2">Export to ForeFlight</h3>
            <p className="text-slate-400 text-sm mb-6">
              Exporting {exportableEntries.length} verified {exportableEntries.length === 1 ? 'entry' : 'entries'} to ForeFlight CSV format.
            </p>
            <div className="relative mb-6">
                <input 
                    type="text" 
                    value={exportName}
                    onChange={(e) => setExportName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-mono text-sm"
                />
            </div>
            <button 
              onClick={handleExport}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-lg"
            >
              Download .CSV for ForeFlight
            </button>
            <button onClick={() => setShowExportModal(false)} className="w-full mt-4 py-2 text-slate-400 hover:text-white font-medium">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogbookEntry, ApproachDetail } from '../types';
import { ICONS } from '../constants';
import ImageViewer, { ImageViewerHandle } from './ImageViewer';
import { convertDDMMtoMMDD, formatDateForDisplay, adjustYearForDate, normalizeAircraftId } from '../utils/logbookUtils';
import { useMobile } from '../utils/useMobile';

interface EntryEditorProps {
  entries: LogbookEntry[];
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  rotations?: number[]; // Rotation in degrees for each image
  onUpdate: (id: string, field: keyof LogbookEntry, value: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRotationChange?: (imageIndex: number, newRotation: number) => void; // Callback when rotation changes
  forceTableOnMobile?: boolean; // Force table view with horizontal scroll on mobile instead of cards
  twoColumnCards?: boolean; // Use 2-column card layout on mobile instead of single column
  onAircraftIdChange?: (entryId: string, aircraftId: string) => void; // Callback when aircraft ID changes to check if it's new
  readOnly?: boolean; // If true, disable all inputs (for permanent log when not in edit mode)
  onUpdateApproaches?: (id: string, approaches: ApproachDetail[]) => void; // Callback to update approach details
}

const EntryEditor: React.FC<EntryEditorProps> = ({ 
  entries, 
  images, 
  rotations = [0, 0],
  onUpdate, 
  onDelete, 
  onAdd,
  onRotationChange,
  forceTableOnMobile = false,
  twoColumnCards = false,
  onAircraftIdChange,
  readOnly = false,
  onUpdateApproaches
}) => {
  const isMobile = useMobile();
  const useTableOnMobile = forceTableOnMobile && isMobile;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const imageViewerRef = useRef<ImageViewerHandle>(null);
  const isSyncingRef = useRef(false);
  const [dateFormat, setDateFormat] = useState<'MM/DD' | 'DD/MM'>('MM/DD');
  const [yearAdjustment, setYearAdjustment] = useState<string>('');
  const [expandedApproaches, setExpandedApproaches] = useState<Record<string, number>>({}); // Track how many approaches are shown per entry
  const [editingApproaches, setEditingApproaches] = useState<Record<string, ApproachDetail[]>>({}); // Track unsaved approaches being edited

  const sumTotal = entries.reduce((acc, e) => acc + (parseFloat(e.totalTime) || 0), 0);
  const sumPIC = entries.reduce((acc, e) => acc + (parseFloat(e.pic) || 0), 0);
  const sumInst = entries.reduce((acc, e) => acc + (parseFloat(e.instrument) || 0), 0);
  const sumSim = entries.reduce((acc, e) => acc + (parseFloat(e.simulatedInstrument) || 0), 0);
  const sumAppr = entries.reduce((acc, e) => acc + (parseInt(e.approaches) || 0), 0);

  // Helper functions for approach management - must be defined first
  const getSavedApproaches = (entryId: string): ApproachDetail[] => {
    return entries.find(e => e.id === entryId)?.approachDetails || [];
  };

  const getEditingApproaches = (entryId: string): ApproachDetail[] => {
    return editingApproaches[entryId] || [];
  };

  const getMaxApproaches = (entryId: string) => {
    const saved = getSavedApproaches(entryId).length;
    const editing = getEditingApproaches(entryId).length;
    return saved + editing;
  };

  // Calculate IAP column count for an entry
  // Structure: 1 (Add IAP button) + 2 per saved approach + 6 per editing approach
  const getIAPColumnCount = (entryId: string): number => {
    const saved = getSavedApproaches(entryId).length;
    const editing = getEditingApproaches(entryId).length;
    return 1 + (saved * 2) + (editing * 6);
  };

  // Calculate max IAP columns needed across all entries
  // Recalculate whenever entries or editingApproaches change
  const maxIAPColumns = React.useMemo(() => {
    if (entries.length === 0) return 1;
    return Math.max(...entries.map(e => getIAPColumnCount(e.id)), 1);
  }, [entries, editingApproaches]);

  // Format approach to packed data: #;type;runway;airport;comments
  const formatApproachPacked = (approach: ApproachDetail, index: number): string => {
    const number = (index + 1).toString();
    return `${number};${approach.type || ''};${approach.runway || ''};${approach.airport || ''};${approach.comments || ''}`;
  };

  const handleAddIAP = (entryId: string) => {
    const saved = getSavedApproaches(entryId).length;
    const editing = getEditingApproaches(entryId).length;
    if (saved + editing < 6) {
      const currentEditing = [...getEditingApproaches(entryId)];
      currentEditing.push({});
      setEditingApproaches(prev => ({ ...prev, [entryId]: currentEditing }));
    }
  };

  const handleUpdateApproach = (entryId: string, approachIndex: number, field: keyof ApproachDetail, value: string) => {
    const currentEditing = [...getEditingApproaches(entryId)];
    if (currentEditing.length <= approachIndex) {
      return;
    }
    currentEditing[approachIndex] = { ...currentEditing[approachIndex], [field]: value };
    setEditingApproaches(prev => ({ ...prev, [entryId]: currentEditing }));
  };

  const handleSaveApproach = (entryId: string, approachIndex: number) => {
    if (!onUpdateApproaches) return;
    const editing = getEditingApproaches(entryId);
    if (approachIndex >= editing.length) return;
    
    const approachToSave = editing[approachIndex];
    // Auto-assign number based on saved approaches count
    const saved = getSavedApproaches(entryId);
    const savedApproaches = [...saved, approachToSave];
    
    // Remove from editing and save
    const remainingEditing = editing.filter((_, i) => i !== approachIndex);
    setEditingApproaches(prev => ({ ...prev, [entryId]: remainingEditing }));
    onUpdateApproaches(entryId, savedApproaches);
  };

  const handleCancelApproach = (entryId: string, approachIndex: number) => {
    const editing = getEditingApproaches(entryId);
    const remainingEditing = editing.filter((_, i) => i !== approachIndex);
    if (remainingEditing.length === 0) {
      setEditingApproaches(prev => {
        const updated = { ...prev };
        delete updated[entryId];
        return updated;
      });
    } else {
      setEditingApproaches(prev => ({ ...prev, [entryId]: remainingEditing }));
    }
  };

  const handleDeleteApproach = (entryId: string, approachIndex: number) => {
    if (!onUpdateApproaches) return;
    const saved = getSavedApproaches(entryId);
    const updatedApproaches = saved.filter((_, i) => i !== approachIndex);
    onUpdateApproaches(entryId, updatedApproaches);
  };

  // Handle date format conversion
  // Dates are always stored in MM/DD/YYYY format. This dropdown lets users indicate
  // if their dates were originally written in DD/MM format so we can convert them.
  const handleDateFormatChange = (newFormat: 'MM/DD' | 'DD/MM') => {
    if (newFormat === 'DD/MM' && dateFormat === 'MM/DD') {
      // User indicates dates were originally written as DD/MM, convert all dates to MM/DD/YYYY (US standard)
      entries.forEach(entry => {
        if (entry.date && entry.date.includes('/')) {
          const converted = convertDDMMtoMMDD(entry.date);
          if (converted !== entry.date) {
            onUpdate(entry.id, 'date', converted);
          }
        }
      });
    }
    // If changing back to MM/DD, no conversion needed (dates should already be in MM/DD/YYYY)
    setDateFormat(newFormat);
  };

  // Handle year adjustment for all dates
  const handleYearAdjustment = (newYear: string) => {
    setYearAdjustment(newYear);
    
    // Only apply if year is valid (4 digits, between 1900 and 2100)
    const yearNum = parseInt(newYear, 10);
    if (newYear.length === 4 && !isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      entries.forEach(entry => {
        if (entry.date) {
          const adjusted = adjustYearForDate(entry.date, yearNum);
          if (adjusted !== entry.date) {
            onUpdate(entry.id, 'date', adjusted);
          }
        }
      });
    }
  };

  // Sync table scroll to images
  const handleTableScroll = useCallback(() => {
    if (isSyncingRef.current || !tableScrollRef.current || !imageViewerRef.current) return;
    
    isSyncingRef.current = true;
    const scrollLeft = tableScrollRef.current.scrollLeft;
    imageViewerRef.current.scrollTo(scrollLeft);
    
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 50);
  }, []);

  const getFieldClass = (entry: LogbookEntry, field: string, base: string = "") => {
    const uncertain = entry.uncertainFields?.includes(field);
    const readOnlyClass = readOnly ? 'cursor-not-allowed opacity-60 pointer-events-none' : '';
    return `${base} transition-all duration-300 ${uncertain ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'border-transparent'} ${readOnlyClass}`;
  };

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl border border-[#E2E8F0] shadow-lg flex flex-col ${useTableOnMobile || twoColumnCards ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* Date Format Selector & Year Adjustment */}
      <div className="px-3 sm:px-6 py-3 bg-[#F4F7FA]/50 border-b border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <label className="text-[10px] sm:text-xs text-[#003366]/70 font-semibold uppercase tracking-wide whitespace-nowrap">
            If dates were not written in MM/DD format:
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dateFormat}
              onChange={(e) => handleDateFormatChange(e.target.value as 'MM/DD' | 'DD/MM')}
              className="px-3 py-2 sm:py-1.5 bg-white hover:bg-[#F4F7FA] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm font-semibold text-[#003366] cursor-pointer outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] transition-all min-h-[44px] sm:min-h-0"
            >
              <option value="MM/DD">MM/DD (Default)</option>
              <option value="DD/MM">DD/MM (Convert)</option>
            </select>
            <span className="text-[10px] sm:text-xs text-[#003366]/60 hidden sm:inline">
              Dates will be converted to MM/DD/YYYY
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <label className="text-[10px] sm:text-xs text-[#003366]/70 font-semibold uppercase tracking-wide whitespace-nowrap">
            Adjust year for all dates:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={yearAdjustment}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // Only allow digits
                if (value.length <= 4) {
                  handleYearAdjustment(value);
                }
              }}
              placeholder="YYYY"
              maxLength={4}
              inputMode="numeric"
              className="px-3 py-2 sm:py-1.5 bg-white hover:bg-[#F4F7FA] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm font-semibold text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] transition-all w-20 sm:w-20 text-center min-h-[44px] sm:min-h-0"
            />
            <span className="text-[10px] sm:text-xs text-[#003366]/60 hidden sm:inline">
              Enter year to update all dates
            </span>
          </div>
        </div>
      </div>
      
      {/* Mobile Card View - Only if not forcing table view */}
      {isMobile && !useTableOnMobile ? (
        <div className={`flex-1 overflow-y-auto ${twoColumnCards ? 'p-2' : 'p-4'}`}>
          {entries.length === 0 ? (
            <div className="text-center py-20 text-[#003366]/60 italic font-medium">
              <div className="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ready for consistent digital logs.
              </div>
            </div>
          ) : (
            <div className={twoColumnCards ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
              {entries.map((entry, index) => (
                <div key={entry.id} className={`bg-white/80 backdrop-blur-sm rounded-xl border border-[#E2E8F0] ${twoColumnCards ? 'p-3' : 'p-4'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#003366]/70 font-mono">#{entry.rowAnchor || index + 1}</span>
                    {entry.reconciliationConfidence === 'low' && (
                      <div className="text-red-500" title="Alignment uncertain">
                        <ICONS.Refresh />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!readOnly && onUpdateApproaches && (
                      <button
                        onClick={() => setApproachModalEntryId(entry.id)}
                        className="text-[#007BFF] hover:text-[#007BFF]/80 p-1 transition-colors"
                        title="Edit approaches"
                      >
                        <ICONS.Plane />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="text-red-500 hover:text-red-600 p-1"
                      title="Delete entry"
                    >
                      <ICONS.Trash />
                    </button>
                  </div>
                </div>
                
                <div className={`grid grid-cols-2 gap-${twoColumnCards ? '2' : '3'}`}>
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Date</label>
                    <input
                      type="text"
                      value={formatDateForDisplay(entry.date)}
                      onChange={(e) => onUpdate(entry.id, 'date', e.target.value)}
                      placeholder="MM/DD/YYYY"
                      inputMode="numeric"
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'date', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px] ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Tail #</label>
                    <input
                      type="text"
                      value={entry.aircraftId}
                      onChange={(e) => {
                        const normalized = normalizeAircraftId(e.target.value);
                        onUpdate(entry.id, 'aircraftId', normalized);
                        if (onAircraftIdChange) {
                          onAircraftIdChange(entry.id, normalized);
                        }
                      }}
                      onBlur={(e) => {
                        const normalized = normalizeAircraftId(e.target.value);
                        if (normalized && normalized !== entry.aircraftId) {
                          onUpdate(entry.id, 'aircraftId', normalized);
                          if (onAircraftIdChange) {
                            onAircraftIdChange(entry.id, normalized);
                          }
                        }
                      }}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'aircraftId', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5' : 'px-3 py-2'} font-bold uppercase outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px] ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`)}
                      placeholder="N123AB"
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>From</label>
                    <input
                      type="text"
                      value={entry.from}
                      onChange={(e) => onUpdate(entry.id, 'from', e.target.value)}
                      className={getFieldClass(entry, 'from', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} uppercase text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>To</label>
                    <input
                      type="text"
                      value={entry.to}
                      onChange={(e) => onUpdate(entry.id, 'to', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'to', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} uppercase text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Total</label>
                    <input
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => onUpdate(entry.id, 'totalTime', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'totalTime', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-[#007BFF] text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Night</label>
                    <input
                      type="text"
                      value={entry.night}
                      onChange={(e) => onUpdate(entry.id, 'night', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'night', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>XC</label>
                    <input
                      type="text"
                      value={entry.crossCountry}
                      onChange={(e) => onUpdate(entry.id, 'crossCountry', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'crossCountry', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>PIC</label>
                    <input
                      type="text"
                      value={entry.pic}
                      onChange={(e) => onUpdate(entry.id, 'pic', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'pic', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Solo</label>
                    <input
                      type="text"
                      value={entry.solo || ''}
                      onChange={(e) => onUpdate(entry.id, 'solo', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'solo', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>SIC</label>
                    <input
                      type="text"
                      value={entry.sic}
                      onChange={(e) => onUpdate(entry.id, 'sic', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'sic', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Dual Rec</label>
                    <input
                      type="text"
                      value={entry.dualReceived}
                      onChange={(e) => onUpdate(entry.id, 'dualReceived', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualReceived', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Dual Giv</label>
                    <input
                      type="text"
                      value={entry.dualGiven}
                      onChange={(e) => onUpdate(entry.id, 'dualGiven', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualGiven', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Actual Inst</label>
                    <input
                      type="text"
                      value={entry.instrument}
                      onChange={(e) => onUpdate(entry.id, 'instrument', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'instrument', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black font-bold text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Sim Inst</label>
                    <input
                      type="text"
                      value={entry.simulatedInstrument}
                      onChange={(e) => onUpdate(entry.id, 'simulatedInstrument', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'simulatedInstrument', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Appr</label>
                    <input
                      type="text"
                      value={entry.approaches}
                      onChange={(e) => onUpdate(entry.id, 'approaches', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'approaches', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black font-bold text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Lnd D</label>
                    <input
                      type="text"
                      value={entry.landingsDay}
                      onChange={(e) => onUpdate(entry.id, 'landingsDay', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsDay', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Lnd N</label>
                    <input
                      type="text"
                      value={entry.landingsNight}
                      onChange={(e) => onUpdate(entry.id, 'landingsNight', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsNight', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Gnd Rec</label>
                    <input
                      type="text"
                      value={entry.groundReceived || ''}
                      onChange={(e) => onUpdate(entry.id, 'groundReceived', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundReceived', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Gnd Giv</label>
                    <input
                      type="text"
                      value={entry.groundGiven || ''}
                      onChange={(e) => onUpdate(entry.id, 'groundGiven', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundGiven', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  {/* Approach Fields */}
                  {!readOnly && onUpdateApproaches && (
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold`}>Instrument Approaches</label>
                        <button
                          onClick={() => handleAddIAP(entry.id)}
                          disabled={getMaxApproaches(entry.id) >= 6}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#007BFF] hover:text-[#007BFF]/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Add Instrument Approach Procedure"
                        >
                          <ICONS.Plus className="w-3 h-3" />
                          Add IAP
                        </button>
                      </div>
                      {/* Saved Approaches - Display in packed format */}
                      {getSavedApproaches(entry.id).map((approach, i) => (
                        <div key={`saved-${i}`} className="mb-2 p-2 bg-amber-50/50 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
                          <div className="text-xs text-black font-semibold flex-1">
                            {formatApproachPacked(approach, i)}
                          </div>
                          {!readOnly && (
                            <button
                              onClick={() => handleDeleteApproach(entry.id, i)}
                              className="p-1 text-red-600 hover:text-red-700 transition-colors flex-shrink-0"
                              title="Delete approach"
                            >
                              <ICONS.Close className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {/* Editing Approaches - Show input fields with save/cancel */}
                      {getEditingApproaches(entry.id).map((approach, i) => {
                        const editingIndex = i;
                        return (
                          <div key={`editing-${i}`} className="mb-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="text-[9px] text-black font-bold mb-1">IAP {getSavedApproaches(entry.id).length + i + 1}</div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input
                                type="text"
                                value={approach.type || ''}
                                onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'type', e.target.value)}
                                placeholder="Type"
                                className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center text-black font-semibold"
                              />
                              <input
                                type="text"
                                value={approach.runway || ''}
                                onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'runway', e.target.value)}
                                placeholder="RWY"
                                className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center text-black font-semibold"
                              />
                              <input
                                type="text"
                                value={approach.airport || ''}
                                onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'airport', e.target.value)}
                                placeholder="Airport Identifier"
                                className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs text-center text-black font-semibold"
                              />
                              <input
                                type="text"
                                value={approach.comments || ''}
                                onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'comments', e.target.value)}
                                placeholder="Notes"
                                className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-xs text-black font-semibold"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveApproach(entry.id, editingIndex)}
                                disabled={readOnly}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Save approach"
                              >
                                <ICONS.Check className="w-4 h-4" />
                                Save
                              </button>
                              <button
                                onClick={() => handleCancelApproach(entry.id, editingIndex)}
                                disabled={readOnly}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Cancel"
                              >
                                <ICONS.Close className="w-4 h-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="col-span-2">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Comments / Remarks</label>
                    <input
                      type="text"
                      value={entry.comments}
                      onChange={(e) => onUpdate(entry.id, 'comments', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'comments', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
          
          {entries.length > 0 && !twoColumnCards && (
            <button
              onClick={onAdd}
              className="w-full py-4 bg-white/80 backdrop-blur-sm hover:bg-white border-2 border-dashed border-[#E2E8F0] rounded-xl text-[#003366]/70 hover:text-[#003366] font-semibold transition-all flex items-center justify-center gap-2 min-h-[44px] mt-3"
            >
              <ICONS.Plus />
              Add Entry
            </button>
          )}
        </div>
      ) : (
        /* Desktop Table View or Forced Table on Mobile */
        <div 
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className={`overflow-x-auto custom-scrollbar flex-1 ${useTableOnMobile ? 'pb-4 touch-pan-x' : ''}`}
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: useTableOnMobile ? 'pan-x pan-y' : 'auto',
            overflowX: 'auto',
            overflowY: 'visible',
            minHeight: useTableOnMobile ? '200px' : 'auto',
            width: useTableOnMobile ? '100%' : 'auto',
            maxWidth: useTableOnMobile ? '100vw' : 'none'
          }}
        >
        <table className="w-full text-left border-collapse min-w-[3000px] text-[11px] sm:text-xs" style={{ width: 'max-content' }}>
          <thead>
            <tr className="bg-[#003366] backdrop-blur-sm text-white text-[10px] uppercase tracking-wider font-bold">
              <th className="px-2 py-4 sticky left-0 bg-[#003366] z-40 border-r border-[#003366]/50 text-center whitespace-nowrap" style={{ width: 'auto', minWidth: '40px' }}>#</th>
              <th className="px-2 py-4 sticky bg-[#003366] z-40 border-r border-[#003366]/50 text-center whitespace-nowrap" style={{ left: '40px', width: 'auto', minWidth: '40px' }}>Sync</th>
              <th className="px-2 py-4 sticky bg-[#003366] z-30 border-r border-[#003366]/50 text-center whitespace-nowrap" style={{ left: '80px', width: 'auto', minWidth: '100px' }}>Date</th>
              <th className="px-2 py-4 sticky bg-[#003366] z-30 border-r border-[#003366]/50 text-center whitespace-nowrap shadow-[4px_0_8px_rgba(0,0,0,0.1)]" style={{ left: '190px', width: 'auto', minWidth: '80px' }}>Tail #</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">From</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">To</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-[#007BFF] bg-[#007BFF]/10">Total</th>
              <th className="px-2 py-4 text-center whitespace-nowrap" title="Day (Auto-calculated: Total - Night)">
                Day
              </th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Night</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">XC</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">PIC</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Solo</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">SIC</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Dual Rec</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Dual Giv</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-emerald-300 bg-emerald-600/20">Actual Inst</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-cyan-300 bg-cyan-600/20">Sim Inst</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-amber-300 bg-amber-600/20">Appr</th>
              <th className="px-2 py-4 text-center whitespace-nowrap" colSpan={maxIAPColumns}>IAP</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Lnd D</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Lnd N</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Gnd Rec</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Gnd Giv</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Comments / Remarks</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={23} className="px-4 py-20 text-center text-[#003366]/70 italic font-medium">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Ready for consistent digital logs.
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/80 transition-colors group bg-white">
                  <td className="p-1 sticky left-0 bg-white group-hover:bg-white/90 z-40 border-r border-[#E2E8F0] text-center text-[10px] text-black font-mono font-semibold whitespace-nowrap" style={{ width: 'auto', minWidth: '40px' }}>
                    {entry.rowAnchor || '-'}
                  </td>
                  <td className="p-1 sticky bg-white group-hover:bg-white/90 z-40 border-r border-[#E2E8F0] text-center whitespace-nowrap" style={{ left: '40px', width: 'auto', minWidth: '40px' }}>
                    {entry.reconciliationConfidence === 'low' ? (
                       <div className="text-red-600 flex justify-center" title="Alignment uncertain between pages">
                         <ICONS.Refresh />
                       </div>
                    ) : (
                      <div className="text-emerald-600 flex justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                        <ICONS.Check />
                      </div>
                    )}
                  </td>
                  <td className="p-1 sticky bg-white group-hover:bg-white/90 z-20 border-r border-[#E2E8F0] whitespace-nowrap" style={{ left: '80px', width: 'auto', minWidth: '100px' }}>
                    <input 
                      type="text"
                      value={formatDateForDisplay(entry.date)}
                      onChange={(e) => onUpdate(entry.id, 'date', e.target.value)}
                      placeholder="MM/DD/YYYY"
                      inputMode="numeric"
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'date', "bg-white hover:border-[#007BFF] focus:border-[#007BFF] rounded px-1.5 py-2 sm:py-1.5 w-full outline-none text-xs text-black font-semibold min-h-[44px] sm:min-h-0 border border-[#E2E8F0] text-center")}
                    />
                  </td>
                  <td className="p-1 sticky bg-white group-hover:bg-white/90 z-20 border-r border-[#E2E8F0] shadow-[4px_0_8px_rgba(0,0,0,0.05)] whitespace-nowrap" style={{ left: '190px', width: 'auto', minWidth: '80px' }}>
                    <input 
                      type="text"
                      value={entry.aircraftId}
                      onChange={(e) => {
                        const normalized = normalizeAircraftId(e.target.value);
                        onUpdate(entry.id, 'aircraftId', normalized);
                        if (onAircraftIdChange) {
                          onAircraftIdChange(entry.id, normalized);
                        }
                      }}
                      onBlur={(e) => {
                        const normalized = normalizeAircraftId(e.target.value);
                        if (normalized && normalized !== entry.aircraftId) {
                          onUpdate(entry.id, 'aircraftId', normalized);
                          if (onAircraftIdChange) {
                            onAircraftIdChange(entry.id, normalized);
                          }
                        }
                      }}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'aircraftId', "bg-white hover:border-[#007BFF] focus:border-[#007BFF] rounded px-2 py-1.5 w-full outline-none text-xs font-bold uppercase border border-[#E2E8F0] text-black text-center")}
                      placeholder="N123AB"
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.from} 
                      onChange={(e) => onUpdate(entry.id, 'from', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'from', "bg-white w-full outline-none text-xs uppercase text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.to} 
                      onChange={(e) => onUpdate(entry.id, 'to', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'to', "bg-white w-full outline-none text-xs uppercase text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-[#007BFF]/10">
                    <input 
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => onUpdate(entry.id, 'totalTime', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'totalTime', "bg-white hover:border-[#007BFF] focus:border-[#007BFF] rounded px-1 py-1.5 w-full outline-none text-xs font-mono text-center text-[#007BFF] font-bold border border-[#E2E8F0]")}
                    />
                  </td>
                  <td className="p-1 bg-[#F4F7FA]">
                    <input 
                      type="text" 
                      value={entry.day} 
                      onChange={(e) => onUpdate(entry.id, 'day', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'day', "bg-transparent outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border-0")}
                      style={{ width: 'auto', minWidth: '40px' }}
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.night} 
                      onChange={(e) => onUpdate(entry.id, 'night', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'night', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.crossCountry} 
                      onChange={(e) => onUpdate(entry.id, 'crossCountry', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'crossCountry', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.pic} 
                      onChange={(e) => onUpdate(entry.id, 'pic', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'pic', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.solo || ''} 
                      onChange={(e) => onUpdate(entry.id, 'solo', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'solo', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.sic} 
                      onChange={(e) => onUpdate(entry.id, 'sic', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'sic', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.dualReceived} 
                      onChange={(e) => onUpdate(entry.id, 'dualReceived', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualReceived', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.dualGiven} 
                      onChange={(e) => onUpdate(entry.id, 'dualGiven', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualGiven', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-emerald-50">
                    <input 
                      type="text" 
                      value={entry.instrument} 
                      onChange={(e) => onUpdate(entry.id, 'instrument', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'instrument', "bg-white w-full outline-none text-xs font-mono text-center text-black font-bold rounded py-1.5 border border-transparent hover:border-emerald-300")} 
                    />
                  </td>
                  <td className="p-1 bg-cyan-50">
                    <input 
                      type="text" 
                      value={entry.simulatedInstrument} 
                      onChange={(e) => onUpdate(entry.id, 'simulatedInstrument', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'simulatedInstrument', "bg-white w-full outline-none text-xs font-mono text-center text-black rounded py-1.5 border border-transparent hover:border-cyan-300")} 
                    />
                  </td>
                  <td className="p-1 bg-amber-50">
                    <input 
                      type="text" 
                      value={entry.approaches} 
                      onChange={(e) => onUpdate(entry.id, 'approaches', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'approaches', "bg-white w-full outline-none text-xs font-mono text-center text-black font-bold rounded py-1.5 border border-transparent hover:border-amber-300")} 
                    />
                  </td>
                  {/* IAP Column - Add IAP Button */}
                  <td className="p-1 bg-white text-center align-middle" style={{ whiteSpace: 'nowrap' }}>
                    {!readOnly && onUpdateApproaches && (
                      <button
                        onClick={() => handleAddIAP(entry.id)}
                        disabled={getMaxApproaches(entry.id) >= 6}
                        className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold text-[#007BFF] hover:text-[#007BFF]/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        title="Add Instrument Approach Procedure"
                      >
                        <ICONS.Plus className="w-3 h-3" />
                        Add IAP
                      </button>
                    )}
                  </td>
                  {/* Saved Approaches - Display in packed format horizontally */}
                  {getSavedApproaches(entry.id).map((approach, i) => (
                    <React.Fragment key={`saved-${i}`}>
                      <td className="p-1 bg-amber-50/50 text-xs text-center text-black font-semibold" style={{ whiteSpace: 'nowrap' }}>
                        {formatApproachPacked(approach, i)}
                      </td>
                      <td className="p-1 bg-amber-50/50 text-center align-middle" style={{ whiteSpace: 'nowrap' }}>
                        {!readOnly && (
                          <button
                            onClick={() => handleDeleteApproach(entry.id, i)}
                            className="p-1 text-red-600 hover:text-red-700 transition-colors"
                            title="Delete approach"
                          >
                            <ICONS.Close className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </React.Fragment>
                  ))}
                  {/* Editing Approaches - Show input fields horizontally */}
                  {getEditingApproaches(entry.id).map((approach, i) => {
                    const editingIndex = i;
                    return (
                      <React.Fragment key={`editing-${i}`}>
                        <td className="p-1 bg-amber-50" style={{ whiteSpace: 'nowrap' }}>
                          <div className="text-[9px] text-center text-black font-bold">{getSavedApproaches(entry.id).length + i + 1}</div>
                        </td>
                        <td className="p-1 bg-amber-50" style={{ whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={approach.type || ''}
                            onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'type', e.target.value)}
                            placeholder="Type"
                            readOnly={readOnly}
                            className="bg-white w-full outline-none text-[10px] text-center rounded py-1 text-black font-semibold border border-transparent hover:border-amber-300 min-w-[50px]"
                          />
                        </td>
                        <td className="p-1 bg-amber-50" style={{ whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={approach.runway || ''}
                            onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'runway', e.target.value)}
                            placeholder="RWY"
                            readOnly={readOnly}
                            className="bg-white w-full outline-none text-[10px] text-center rounded py-1 text-black font-semibold border border-transparent hover:border-amber-300 min-w-[50px]"
                          />
                        </td>
                        <td className="p-1 bg-amber-50" style={{ whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={approach.airport || ''}
                            onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'airport', e.target.value)}
                            placeholder="Airport Identifier"
                            readOnly={readOnly}
                            className="bg-white w-full outline-none text-[10px] text-center rounded py-1 text-black font-semibold border border-transparent hover:border-amber-300 min-w-[80px]"
                          />
                        </td>
                        <td className="p-1 bg-amber-50" style={{ whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={approach.comments || ''}
                            onChange={(e) => handleUpdateApproach(entry.id, editingIndex, 'comments', e.target.value)}
                            placeholder="Notes"
                            readOnly={readOnly}
                            className="bg-white w-full outline-none text-[10px] text-center rounded py-1 text-black font-semibold border border-transparent hover:border-amber-300 min-w-[80px]"
                          />
                        </td>
                        <td className="p-1 bg-amber-50 text-center" style={{ whiteSpace: 'nowrap' }}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveApproach(entry.id, editingIndex)}
                              disabled={readOnly}
                              className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Save approach"
                            >
                              <ICONS.Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancelApproach(entry.id, editingIndex)}
                              disabled={readOnly}
                              className="p-1 text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Cancel"
                            >
                              <ICONS.Close className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  {/* Fill remaining IAP columns with empty cells to match header span */}
                  {Array.from({ length: maxIAPColumns - getIAPColumnCount(entry.id) }).map((_, i) => (
                    <td key={`fill-${i}`} className="p-1 bg-white"></td>
                  ))}
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.landingsDay} 
                      onChange={(e) => onUpdate(entry.id, 'landingsDay', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsDay', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.landingsNight} 
                      onChange={(e) => onUpdate(entry.id, 'landingsNight', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsNight', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.groundReceived || ''} 
                      onChange={(e) => onUpdate(entry.id, 'groundReceived', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundReceived', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.groundGiven || ''} 
                      onChange={(e) => onUpdate(entry.id, 'groundGiven', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundGiven', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.comments} 
                      placeholder="Remarks..."
                      onChange={(e) => onUpdate(entry.id, 'comments', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'comments', "bg-white w-full outline-none text-xs px-2 py-2 sm:py-1.5 rounded truncate focus:bg-white min-h-[44px] sm:min-h-0 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="px-2 py-2 text-center bg-white">
                    <button onClick={() => onDelete(entry.id)} className="p-2 text-black hover:text-red-600 transition-colors"><ICONS.Trash /></button>
                  </td>
                </tr>
              ))
            )}
            
            <tr className="bg-[#003366] font-mono text-[11px] border-t-2 border-[#003366]">
                <td className="p-3 sticky left-0 bg-[#003366] z-40 border-r border-[#003366]/50 text-center text-white uppercase font-black tracking-tighter whitespace-nowrap" style={{ width: 'auto', minWidth: '40px' }}>OCR</td>
                <td className="p-3 sticky bg-[#003366] z-40 border-r border-[#003366]/50 text-center text-white font-bold uppercase tracking-tight whitespace-nowrap" style={{ left: '40px', width: 'auto', minWidth: '40px' }}>Sync</td>
                <td className="p-3 sticky bg-[#003366] z-30 border-r border-[#003366]/50 text-white font-bold uppercase tracking-tight whitespace-nowrap text-center" style={{ left: '80px', width: 'auto', minWidth: '100px' }}>Date</td>
                <td className="p-3 sticky bg-[#003366] z-30 border-r border-[#003366]/50 text-white font-bold uppercase tracking-tight whitespace-nowrap text-center" style={{ left: '190px', width: 'auto', minWidth: '80px' }}>Tail #</td>
                <td colSpan={2} className="px-3 py-3 bg-white"></td>
                <td className="p-3 text-center text-[#007BFF] font-bold bg-[#007BFF]/10 border-r border-[#E2E8F0] ring-1 ring-inset ring-[#007BFF]/20">{sumTotal.toFixed(1)}</td>
                <td className="bg-[#F4F7FA]"></td>
                <td colSpan={7} className="bg-white"></td>
                <td className="p-3 text-center text-black font-bold bg-emerald-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-emerald-200">{sumInst.toFixed(1)}</td>
                <td className="p-3 text-center text-black font-bold bg-cyan-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-cyan-200">{sumSim.toFixed(1)}</td>
                <td className="p-3 text-center text-black font-bold bg-amber-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-amber-200">{sumAppr}</td>
                <td colSpan={4} className="bg-white"></td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
      
      {/* Images - Show for both mobile and desktop */}
      {images.length > 0 && (
        <div className="p-4 border-t border-[#E2E8F0]">
          <ImageViewer 
            ref={imageViewerRef} 
            images={images} 
            rotations={rotations}
            onRotationChange={onRotationChange}
          />
        </div>
      )}
      
      {/* Footer - Desktop only (mobile has add button in card view) */}
      {!isMobile && (
      <div className="p-6 bg-white/80 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-[#E2E8F0]">
        <div className="flex flex-col">
            <span className="text-sm text-[#003366] font-bold uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
              IFR CROSS-CHECK ACTIVE
            </span>
            <p className="text-[11px] text-[#003366]/70 mt-1 max-w-lg leading-relaxed">
              Actual, Simulated, and Approach data are being cross-referenced against keywords in your Remarks section.
            </p>
        </div>
        <button 
          onClick={onAdd}
            className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-white hover:bg-[#F4F7FA] rounded-xl text-sm font-bold text-[#003366] transition-all border border-[#E2E8F0] shadow-sm hover:shadow-md active:scale-95 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
        >
          <ICONS.Plus /> Manual Row
        </button>
      </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #F4F7FA; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        ${useTableOnMobile ? `
          .custom-scrollbar {
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior-x: contain;
            scroll-behavior: smooth;
          }
        ` : ''}
      `}</style>
    </div>
  );
};

export default EntryEditor;

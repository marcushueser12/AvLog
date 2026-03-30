import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogbookEntry, ApproachDetail } from '../types';
import { ICONS } from '../constants';
import ImageViewer, { ImageViewerHandle } from './ImageViewer';
import ApproachModal from './ApproachModal';
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
  onAircraftIdChange?: (entryId: string, aircraftId: string, oldAircraftId?: string) => void; // Callback when aircraft ID changes to check if it's new
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
  const [approachModalEntryId, setApproachModalEntryId] = useState<string | null>(null);
  const [editingDateEntryId, setEditingDateEntryId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>('');
  const [cellMovementMode, setCellMovementMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ entryId: string; field: keyof LogbookEntry } | null>(null);
  const [internationalMode, setInternationalMode] = useState(false); // Toggle for international aircraft registrations
  // Store original aircraft ID when user starts editing (for tail number change confirmation)
  const aircraftIdBeforeEdit = useRef<Record<string, string>>({});

  // Initialize editing date value when starting to edit
  const handleDateFocus = (entryId: string, currentDate: string) => {
    setEditingDateEntryId(entryId);
    setEditingDateValue(formatDateForDisplay(currentDate));
  };

  const sumTotal = entries.reduce((acc, e) => acc + (parseFloat(e.totalTime) || 0), 0);
  const sumPIC = entries.reduce((acc, e) => acc + (parseFloat(e.pic) || 0), 0);
  const sumInst = entries.reduce((acc, e) => acc + (parseFloat(e.instrument) || 0), 0);
  const sumSim = entries.reduce((acc, e) => acc + (parseFloat(e.simulatedInstrument) || 0), 0);
  const sumAppr = entries.reduce((acc, e) => acc + (parseInt(e.approaches) || 0), 0);

  // Approach management functions
  const handleOpenApproachModal = (entryId: string) => {
    setApproachModalEntryId(entryId);
  };

  const handleSaveApproaches = (entryId: string, approaches: ApproachDetail[]) => {
    if (onUpdateApproaches) {
      onUpdateApproaches(entryId, approaches);
    }
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
    const isSelected = cellMovementMode && selectedCell?.entryId === entry.id && selectedCell?.field === field;
    const isMovable = cellMovementMode && !readOnly && field !== 'day' && field !== 'id' && field !== 'rowAnchor' && field !== 'isVerified' && field !== 'aiConfidence' && field !== 'reconciliationConfidence' && field !== 'uncertainFields' && field !== 'validationError' && field !== 'fieldBoundingBoxes' && field !== 'approachDetails' && field !== 'scanId';
    // Add touch-manipulation for better mobile touch handling
    const touchClass = useTableOnMobile ? ' touch-manipulation' : '';
    return `${base}${touchClass} transition-all duration-300 ${uncertain ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'border-transparent'} ${readOnlyClass} ${isSelected ? 'ring-2 ring-[#007BFF] bg-[#007BFF]/10' : ''} ${isMovable && !isSelected ? 'hover:ring-1 hover:ring-[#007BFF]/50 cursor-pointer' : ''}`;
  };

  // Handle cell movement mode
  const handleCellClick = (entryId: string, field: keyof LogbookEntry) => {
    if (!cellMovementMode || readOnly) return;
    
    // Skip non-movable fields
    if (field === 'day' || field === 'id' || field === 'rowAnchor' || field === 'isVerified' || field === 'aiConfidence' || field === 'reconciliationConfidence' || field === 'uncertainFields' || field === 'validationError' || field === 'fieldBoundingBoxes' || field === 'approachDetails' || field === 'scanId') {
      return;
    }

    if (selectedCell === null) {
      // First click: select the cell
      setSelectedCell({ entryId, field });
    } else if (selectedCell.entryId === entryId && selectedCell.field === field) {
      // Clicking the same cell: deselect
      setSelectedCell(null);
    } else {
      // Second click on different cell: move the value
      const sourceEntry = entries.find(e => e.id === selectedCell.entryId);
      const targetEntry = entries.find(e => e.id === entryId);
      
      if (sourceEntry && targetEntry) {
        const sourceValue = String(sourceEntry[selectedCell.field] || '');
        const targetValue = String(targetEntry[field] || '');
        
        // Swap values
        onUpdate(selectedCell.entryId, selectedCell.field, targetValue);
        onUpdate(entryId, field, sourceValue);
        
        // Clear selection
        setSelectedCell(null);
      }
    }
  };

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl border border-[#E2E8F0] shadow-lg flex flex-col ${useTableOnMobile || twoColumnCards ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* Date Format Selector & Year Adjustment & Cell Movement Mode */}
      {isMobile && !useTableOnMobile ? (
        /* Mobile: single compact row – date, year, not USA, cell move */
        <div className="px-2 py-1.5 bg-[#F4F7FA]/50 border-b border-[#E2E8F0] flex flex-nowrap items-center gap-1.5 overflow-x-auto min-h-[40px]">
          <select
            value={dateFormat}
            onChange={(e) => handleDateFormatChange(e.target.value as 'MM/DD' | 'DD/MM')}
            className="px-1.5 py-1 bg-white border border-[#E2E8F0] rounded-md text-[10px] font-semibold text-[#003366] cursor-pointer outline-none focus:ring-2 focus:ring-[#007BFF] shrink-0"
          >
            <option value="MM/DD">MM/DD</option>
            <option value="DD/MM">DD/MM</option>
          </select>
          <input
            type="text"
            value={yearAdjustment}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= 4) handleYearAdjustment(value);
            }}
            placeholder="Yr"
            maxLength={4}
            inputMode="numeric"
            className="px-1.5 py-1 w-10 bg-white border border-[#E2E8F0] rounded-md text-[10px] font-semibold text-[#003366] text-center outline-none focus:ring-2 focus:ring-[#007BFF] shrink-0"
          />
          {!readOnly && (
            <button
              onClick={() => setInternationalMode(!internationalMode)}
              className={`px-1.5 py-1 rounded-md text-[10px] font-semibold border shrink-0 ${
                internationalMode ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-[#E2E8F0] text-[#003366]'
              }`}
              title="Not USA registration"
            >
              {internationalMode ? 'Intl' : 'USA'}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => { setCellMovementMode(!cellMovementMode); setSelectedCell(null); }}
              className={`px-1.5 py-1 rounded-md text-[10px] font-semibold border shrink-0 flex items-center gap-0.5 ${
                cellMovementMode ? 'bg-[#007BFF]/10 border-[#007BFF]/30 text-[#007BFF]' : 'bg-white border-[#E2E8F0] text-[#003366]'
              }`}
              title="Tap a cell to select, then another to swap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              {cellMovementMode ? 'Move' : 'Move'}
            </button>
          )}
          {cellMovementMode && selectedCell && (
            <span className="text-[9px] text-[#007BFF] font-medium truncate shrink-0 max-w-[72px]">→ {String(selectedCell.field)}</span>
          )}
        </div>
      ) : (
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
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 4) handleYearAdjustment(value);
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
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInternationalMode(!internationalMode)}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] sm:min-h-0 border ${
                  internationalMode ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white hover:bg-[#F4F7FA] border-[#E2E8F0] text-[#003366]'
                }`}
                title="Enable international mode to allow non-USA aircraft registrations (removes N-number requirement)"
              >
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                  {internationalMode ? 'International: ON' : 'Mark if not USA'}
                </span>
              </button>
            </div>
          )}
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCellMovementMode(!cellMovementMode); setSelectedCell(null); }}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[44px] sm:min-h-0 border ${
                  cellMovementMode ? 'bg-[#007BFF]/10 border-[#007BFF]/30 text-[#007BFF]' : 'bg-white hover:bg-[#F4F7FA] border-[#E2E8F0] text-[#003366]'
                }`}
                title="Enable cell movement mode: Click a cell to select, then click another to swap values"
              >
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                  {cellMovementMode ? 'Cell Move: ON' : 'Cell Move'}
                </span>
              </button>
              {cellMovementMode && selectedCell && (
                <span className="text-[10px] sm:text-xs text-[#007BFF] font-medium">Selected: {selectedCell.field}</span>
              )}
            </div>
          )}
        </div>
      )}
      
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
                
                <div className={`grid grid-cols-2 ${twoColumnCards ? 'gap-2' : 'gap-3'}`}>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Date</label>
                    <input
                      type="text"
                      value={editingDateEntryId === entry.id ? editingDateValue : formatDateForDisplay(entry.date)}
                      onFocus={() => !cellMovementMode && handleDateFocus(entry.id, entry.date || '')}
                      onChange={(e) => {
                        if (cellMovementMode) return;
                        setEditingDateEntryId(entry.id);
                        setEditingDateValue(e.target.value);
                      }}
                      onBlur={() => {
                        if (editingDateEntryId === entry.id && editingDateValue !== formatDateForDisplay(entry.date)) {
                          onUpdate(entry.id, 'date', editingDateValue);
                        }
                        setEditingDateEntryId(null);
                        setEditingDateValue('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingDateEntryId === entry.id) {
                          if (editingDateValue !== formatDateForDisplay(entry.date)) onUpdate(entry.id, 'date', editingDateValue);
                          setEditingDateEntryId(null);
                          setEditingDateValue('');
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'date'); } }}
                      placeholder="MM/DD/YYYY"
                      inputMode="numeric"
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'date', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px] ${readOnly || cellMovementMode ? 'cursor-not-allowed opacity-60' : ''}`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Tail #</label>
                    <input
                      type="text"
                      value={entry.aircraftId}
                      onFocus={(e) => { if (!cellMovementMode) aircraftIdBeforeEdit.current[entry.id] = entry.aircraftId || ''; }}
                      onChange={(e) => {
                        if (cellMovementMode) return;
                        onUpdate(entry.id, 'aircraftId', normalizeAircraftId(e.target.value, internationalMode));
                      }}
                      onBlur={(e) => {
                        const oldAircraftId = aircraftIdBeforeEdit.current[entry.id] || entry.aircraftId || '';
                        const normalized = normalizeAircraftId(e.target.value, internationalMode);
                        delete aircraftIdBeforeEdit.current[entry.id];
                        if (normalized !== oldAircraftId) {
                          onUpdate(entry.id, 'aircraftId', normalized);
                          if (onAircraftIdChange) onAircraftIdChange(entry.id, normalized, oldAircraftId);
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'aircraftId'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'aircraftId', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5' : 'px-3 py-2'} font-bold uppercase outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px] ${readOnly || cellMovementMode ? 'cursor-not-allowed opacity-60' : ''}`)}
                      placeholder={internationalMode ? "G-ABCD" : "N123AB"}
                    />
                  </div>
                  
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>From</label>
                    <input
                      type="text"
                      value={entry.from}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'from', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'from'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'from', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} uppercase text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>To</label>
                    <input
                      type="text"
                      value={entry.to}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'to', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'to'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'to', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} uppercase text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Total</label>
                    <input
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'totalTime', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'totalTime'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'totalTime', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-[#007BFF] text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Night</label>
                    <input
                      type="text"
                      value={entry.night}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'night', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'night'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'night', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>XC</label>
                    <input
                      type="text"
                      value={entry.crossCountry}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'crossCountry', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'crossCountry'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'crossCountry', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>PIC</label>
                    <input
                      type="text"
                      value={entry.pic}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'pic', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'pic'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'pic', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Solo</label>
                    <input
                      type="text"
                      value={entry.solo || ''}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'solo', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'solo'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'solo', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>SIC</label>
                    <input
                      type="text"
                      value={entry.sic}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'sic', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'sic'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'sic', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>MEL</label>
                    <input
                      type="text"
                      value={entry.mel || ''}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'mel', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'mel'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'mel', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Dual Rec</label>
                    <input
                      type="text"
                      value={entry.dualReceived}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'dualReceived', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'dualReceived'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'dualReceived', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Dual Giv</label>
                    <input
                      type="text"
                      value={entry.dualGiven}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'dualGiven', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'dualGiven'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'dualGiven', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Actual Inst</label>
                    <input
                      type="text"
                      value={entry.instrument}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'instrument', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'instrument'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'instrument', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black font-bold text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Sim Inst</label>
                    <input
                      type="text"
                      value={entry.simulatedInstrument}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'simulatedInstrument', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'simulatedInstrument'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'simulatedInstrument', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Appr</label>
                    <input
                      type="text"
                      value={entry.approaches}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'approaches', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'approaches'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'approaches', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-black font-bold text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Lnd D</label>
                    <input
                      type="text"
                      value={entry.landingsDay}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'landingsDay', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'landingsDay'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'landingsDay', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Lnd N</label>
                    <input
                      type="text"
                      value={entry.landingsNight}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'landingsNight', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'landingsNight'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'landingsNight', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Gnd Rec</label>
                    <input
                      type="text"
                      value={entry.groundReceived || ''}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'groundReceived', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'groundReceived'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'groundReceived', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Gnd Giv</label>
                    <input
                      type="text"
                      value={entry.groundGiven || ''}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'groundGiven', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'groundGiven'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'groundGiven', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
                    />
                  </div>
                  
                  {/* Approach Fields */}
                  {!readOnly && onUpdateApproaches && (
                    <div className="col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold`}>Instrument Approaches</label>
                        <button
                          onClick={() => handleOpenApproachModal(entry.id)}
                          disabled={(entry.approachDetails?.length || 0) >= 6}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#007BFF] hover:text-[#007BFF]/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                          title="Add Instrument Approach Procedure"
                        >
                          <ICONS.Plus className="w-3 h-3" />
                          Add IAP
                        </button>
                      </div>
                      {/* Display saved approaches */}
                      {entry.approachDetails && entry.approachDetails.length > 0 && (
                        <div className="space-y-1">
                          {entry.approachDetails.map((approach, i) => (
                            <div key={`approach-${i}`} className="text-xs text-black font-semibold p-2 bg-amber-50/50 rounded border border-amber-200">
                              {approach.type && approach.runway && approach.airport ? (
                                <span>{i + 1}. {approach.type}; {approach.runway}; {approach.airport}{approach.comments ? `; ${approach.comments}` : ''}</span>
                              ) : (
                                <span>IAP {i + 1}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="col-span-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1.5">
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-0.5`}>Comments / Remarks</label>
                    <input
                      type="text"
                      value={entry.comments}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'comments', e.target.value)}
                      onClick={(e) => { if (cellMovementMode) { e.preventDefault(); (e.target as HTMLInputElement).blur(); handleCellClick(entry.id, 'comments'); } }}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'comments', `w-full bg-white border border-[#E2E8F0] rounded-md ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[40px]`)}
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
            touchAction: useTableOnMobile ? 'pan-x pan-y pinch-zoom' : 'auto',
            overflowX: 'auto',
            overflowY: 'visible',
            minHeight: useTableOnMobile ? '200px' : 'auto',
            width: useTableOnMobile ? '100%' : 'auto',
            maxWidth: useTableOnMobile ? '100vw' : 'none',
            // Ensure touch interactions work properly
            WebkitTapHighlightColor: 'transparent'
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
              <th className="px-2 py-4 text-center whitespace-nowrap">MEL</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Dual Rec</th>
              <th className="px-2 py-4 text-center whitespace-nowrap">Dual Giv</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-emerald-300 bg-emerald-600/20">Actual Inst</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-cyan-300 bg-cyan-600/20">Sim Inst</th>
              <th className="px-2 py-4 text-center whitespace-nowrap text-amber-300 bg-amber-600/20">Appr</th>
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
                      value={editingDateEntryId === entry.id ? editingDateValue : formatDateForDisplay(entry.date)}
                      onFocus={() => handleDateFocus(entry.id, entry.date || '')}
                      onChange={(e) => {
                        setEditingDateEntryId(entry.id);
                        setEditingDateValue(e.target.value);
                      }}
                      onBlur={() => {
                        if (editingDateEntryId === entry.id && editingDateValue !== formatDateForDisplay(entry.date)) {
                          onUpdate(entry.id, 'date', editingDateValue);
                        }
                        setEditingDateEntryId(null);
                        setEditingDateValue('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingDateEntryId === entry.id) {
                          if (editingDateValue !== formatDateForDisplay(entry.date)) {
                            onUpdate(entry.id, 'date', editingDateValue);
                          }
                          setEditingDateEntryId(null);
                          setEditingDateValue('');
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
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
                      onFocus={(e) => {
                        // Capture the original value when user starts editing
                        aircraftIdBeforeEdit.current[entry.id] = entry.aircraftId || '';
                      }}
                      onChange={(e) => {
                        const normalized = normalizeAircraftId(e.target.value, internationalMode);
                        onUpdate(entry.id, 'aircraftId', normalized);
                        // Don't trigger aircraft profile pop-up on onChange, only on blur
                      }}
                      onBlur={(e) => {
                        // Get the original value from before editing started
                        const oldAircraftId = aircraftIdBeforeEdit.current[entry.id] || entry.aircraftId || '';
                        const normalized = normalizeAircraftId(e.target.value, internationalMode);
                        // Clean up the stored value
                        delete aircraftIdBeforeEdit.current[entry.id];
                        
                        // Always update if value changed, then check for other instances
                        if (normalized !== oldAircraftId) {
                          onUpdate(entry.id, 'aircraftId', normalized);
                          // Trigger handler to check for other instances with the old tail number
                          if (onAircraftIdChange) {
                            onAircraftIdChange(entry.id, normalized, oldAircraftId);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle Enter key to trigger blur behavior
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'aircraftId', "bg-white hover:border-[#007BFF] focus:border-[#007BFF] rounded px-2 py-1.5 w-full outline-none text-xs font-bold uppercase border border-[#E2E8F0] text-black text-center")}
                      placeholder={internationalMode ? "G-ABCD" : "N123AB"}
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.from} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'from', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'from')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'from', "bg-white w-full outline-none text-xs uppercase text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.to} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'to', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'to')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'to', "bg-white w-full outline-none text-xs uppercase text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-[#007BFF]/10">
                    <input 
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'totalTime', e.target.value)}
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'totalTime')}
                      readOnly={readOnly || cellMovementMode}
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
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'night', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'night')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'night', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.crossCountry} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'crossCountry', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'crossCountry')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'crossCountry', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.pic} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'pic', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'pic')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'pic', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.solo || ''} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'solo', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'solo')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'solo', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.sic} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'sic', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'sic')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'sic', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.mel || ''} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'mel', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'mel')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'mel', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.dualReceived} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'dualReceived', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'dualReceived')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'dualReceived', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.dualGiven} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'dualGiven', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'dualGiven')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'dualGiven', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-emerald-50">
                    <input 
                      type="text" 
                      value={entry.instrument} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'instrument', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'instrument')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'instrument', "bg-white w-full outline-none text-xs font-mono text-center text-black font-bold rounded py-1.5 border border-transparent hover:border-emerald-300")} 
                    />
                  </td>
                  <td className="p-1 bg-cyan-50">
                    <input 
                      type="text" 
                      value={entry.simulatedInstrument} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'simulatedInstrument', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'simulatedInstrument')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'simulatedInstrument', "bg-white w-full outline-none text-xs font-mono text-center text-black rounded py-1.5 border border-transparent hover:border-cyan-300")} 
                    />
                  </td>
                  <td className="p-1 bg-amber-50">
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={entry.approaches} 
                        onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'approaches', e.target.value)} 
                        onClick={() => cellMovementMode && handleCellClick(entry.id, 'approaches')}
                        readOnly={readOnly || cellMovementMode}
                        className={getFieldClass(entry, 'approaches', "bg-white flex-1 outline-none text-xs font-mono text-center text-black font-bold rounded py-1.5 border border-transparent hover:border-amber-300")} 
                      />
                      {!readOnly && onUpdateApproaches && (
                        <button
                          onClick={() => handleOpenApproachModal(entry.id)}
                          className="flex items-center justify-center p-1 text-[#007BFF] hover:text-[#007BFF]/80 transition-colors flex-shrink-0"
                          title="Manage Instrument Approaches"
                        >
                          <ICONS.Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.landingsDay} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'landingsDay', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'landingsDay')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'landingsDay', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.landingsNight} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'landingsNight', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'landingsNight')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'landingsNight', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.groundReceived || ''} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'groundReceived', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'groundReceived')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'groundReceived', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.groundGiven || ''} 
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'groundGiven', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'groundGiven')}
                      readOnly={readOnly || cellMovementMode}
                      className={getFieldClass(entry, 'groundGiven', "bg-white w-full outline-none text-xs font-mono text-center rounded py-1.5 text-black font-semibold border border-transparent hover:border-[#E2E8F0]")} 
                    />
                  </td>
                  <td className="p-1 bg-white">
                    <input 
                      type="text" 
                      value={entry.comments} 
                      placeholder="Remarks..."
                      onChange={(e) => !cellMovementMode && onUpdate(entry.id, 'comments', e.target.value)} 
                      onClick={() => cellMovementMode && handleCellClick(entry.id, 'comments')}
                      readOnly={readOnly || cellMovementMode}
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
                <td colSpan={8} className="bg-white"></td>
                <td className="p-3 text-center text-black font-bold bg-emerald-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-emerald-200">{sumInst.toFixed(1)}</td>
                <td className="p-3 text-center text-black font-bold bg-cyan-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-cyan-200">{sumSim.toFixed(1)}</td>
                <td className="p-3 text-center text-black font-bold bg-amber-50 border-r border-[#E2E8F0] ring-1 ring-inset ring-amber-200">{sumAppr}</td>
                <td colSpan={3} className="bg-white"></td>
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

      {/* Approach Modal */}
      {approachModalEntryId && onUpdateApproaches && (
        <ApproachModal
          isOpen={!!approachModalEntryId}
          entryId={approachModalEntryId}
          approaches={entries.find(e => e.id === approachModalEntryId)?.approachDetails || []}
          onClose={() => setApproachModalEntryId(null)}
          onSave={(approaches) => {
            handleSaveApproaches(approachModalEntryId, approaches);
            setApproachModalEntryId(null);
          }}
        />
      )}
    </div>
  );
};

export default EntryEditor;

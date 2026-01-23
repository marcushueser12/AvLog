import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogbookEntry } from '../types';
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
  readOnly = false
}) => {
  const isMobile = useMobile();
  const useTableOnMobile = forceTableOnMobile && isMobile;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const imageViewerRef = useRef<ImageViewerHandle>(null);
  const isSyncingRef = useRef(false);
  const [dateFormat, setDateFormat] = useState<'MM/DD' | 'DD/MM'>('MM/DD');
  const [yearAdjustment, setYearAdjustment] = useState<string>('');

  const sumTotal = entries.reduce((acc, e) => acc + (parseFloat(e.totalTime) || 0), 0);
  const sumPIC = entries.reduce((acc, e) => acc + (parseFloat(e.pic) || 0), 0);
  const sumInst = entries.reduce((acc, e) => acc + (parseFloat(e.instrument) || 0), 0);
  const sumSim = entries.reduce((acc, e) => acc + (parseFloat(e.simulatedInstrument) || 0), 0);
  const sumAppr = entries.reduce((acc, e) => acc + (parseInt(e.approaches) || 0), 0);

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
    return `${base} transition-all duration-300 ${uncertain ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30' : 'border-transparent'} ${readOnlyClass}`;
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
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-red-500 hover:text-red-600 p-1"
                    title="Delete entry"
                  >
                    <ICONS.Trash />
                  </button>
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
                      className={getFieldClass(entry, 'instrument', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-emerald-400 text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Sim Inst</label>
                    <input
                      type="text"
                      value={entry.simulatedInstrument}
                      onChange={(e) => onUpdate(entry.id, 'simulatedInstrument', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'simulatedInstrument', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-cyan-400 text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
                    />
                  </div>
                  
                  <div>
                    <label className={`${twoColumnCards ? 'text-[9px]' : 'text-[10px]'} text-[#003366]/70 uppercase tracking-wide font-semibold block mb-1`}>Appr</label>
                    <input
                      type="text"
                      value={entry.approaches}
                      onChange={(e) => onUpdate(entry.id, 'approaches', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'approaches', `w-full bg-white border border-[#E2E8F0] rounded-lg ${twoColumnCards ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-amber-400 text-center outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF] min-h-[44px]`)}
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
        <table className="w-full text-left border-collapse min-w-[2050px] text-[11px] sm:text-xs" style={{ width: 'max-content' }}>
          <thead>
            <tr className="bg-white/80 backdrop-blur-sm text-[#003366]/70 text-[10px] uppercase tracking-wider font-bold">
              <th className="px-3 py-4 w-12 sticky left-0 bg-white/80 backdrop-blur-sm z-40 border-r border-[#E2E8F0]">#</th>
              <th className="px-3 py-4 w-12 sticky left-12 bg-white/80 backdrop-blur-sm z-40 border-r border-[#E2E8F0] text-center">Sync</th>
              <th className="px-3 py-4 w-32 sticky left-24 bg-white/80 backdrop-blur-sm z-30 border-r border-[#E2E8F0]">Date</th>
              <th className="px-3 py-4 w-32 sticky left-56 bg-white/80 backdrop-blur-sm z-30 border-r border-[#E2E8F0] shadow-[4px_0_8px_rgba(0,0,0,0.3)]">Tail #</th>
              <th className="px-3 py-4 w-24">From</th>
              <th className="px-3 py-4 w-24">To</th>
              <th className="px-3 py-4 w-24 text-[#007BFF]">Total</th>
              <th className="px-1 py-4 w-10 text-center" title="Day (Auto-calculated: Total - Night)">
                Day
              </th>
              <th className="px-3 py-4 w-20">Night</th>
              <th className="px-3 py-4 w-20">XC</th>
              <th className="px-3 py-4 w-20">PIC</th>
              <th className="px-3 py-4 w-20">Solo</th>
              <th className="px-3 py-4 w-20">SIC</th>
              <th className="px-3 py-4 w-20">Dual Rec</th>
              <th className="px-3 py-4 w-20">Dual Giv</th>
              <th className="px-3 py-4 w-28 text-emerald-400 bg-emerald-400/5">Actual Inst</th>
              <th className="px-3 py-4 w-28 text-cyan-400 bg-cyan-400/5">Sim Inst</th>
              <th className="px-3 py-4 w-20 text-amber-400 bg-amber-400/5">Appr</th>
              <th className="px-3 py-4 w-20">Lnd D</th>
              <th className="px-3 py-4 w-20">Lnd N</th>
              <th className="px-3 py-4 w-20">Gnd Rec</th>
              <th className="px-3 py-4 w-20">Gnd Giv</th>
              <th className="px-3 py-4 w-32">Comments / Remarks</th>
              <th className="px-3 py-4 w-16 text-center sticky right-0 bg-white/80 backdrop-blur-sm z-30 border-l border-[#E2E8F0] shadow-[-4px_0_8px_rgba(0,0,0,0.3)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={21} className="px-4 py-20 text-center text-[#003366]/70 italic font-medium">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Ready for consistent digital logs.
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/80 backdrop-blur-sm/50 transition-colors group">
                  <td className="p-1 sticky left-0 bg-slate-900 group-hover:bg-white/80 backdrop-blur-sm z-40 border-r border-[#E2E8F0] text-center text-[10px] text-[#003366]/70 font-mono">
                    {entry.rowAnchor || '-'}
                  </td>
                  <td className="p-1 sticky left-12 bg-slate-900 group-hover:bg-white/80 backdrop-blur-sm z-40 border-r border-[#E2E8F0] text-center">
                    {entry.reconciliationConfidence === 'low' ? (
                       <div className="text-red-400 flex justify-center" title="Alignment uncertain between pages">
                         <ICONS.Refresh />
                       </div>
                    ) : (
                      <div className="text-emerald-500 flex justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                        <ICONS.Check />
                      </div>
                    )}
                  </td>
                  <td className="p-1 sticky left-24 bg-slate-900 group-hover:bg-white/80 backdrop-blur-sm z-20 border-r border-[#E2E8F0]">
                    <input 
                      type="text"
                      value={formatDateForDisplay(entry.date)}
                      onChange={(e) => onUpdate(entry.id, 'date', e.target.value)}
                      placeholder="MM/DD/YYYY"
                      inputMode="numeric"
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'date', "bg-transparent hover:border-[#E2E8F0] focus:border-[#007BFF] rounded px-2 py-2 sm:py-1.5 w-full outline-none text-xs min-h-[44px] sm:min-h-0")}
                    />
                  </td>
                  <td className="p-1 sticky left-56 bg-slate-900 group-hover:bg-white/80 backdrop-blur-sm z-20 border-r border-[#E2E8F0] shadow-[4px_0_8_rgba(0,0,0,0.3)]">
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
                      className={getFieldClass(entry, 'aircraftId', "bg-transparent hover:border-[#E2E8F0] focus:border-[#007BFF] rounded px-2 py-1.5 w-full outline-none text-xs font-bold uppercase border border-transparent")}
                      placeholder="N123AB"
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.from} 
                      onChange={(e) => onUpdate(entry.id, 'from', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'from', "bg-transparent w-full outline-none text-xs uppercase text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.to} 
                      onChange={(e) => onUpdate(entry.id, 'to', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'to', "bg-transparent w-full outline-none text-xs uppercase text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-blue-500/[0.03]">
                    <input 
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => onUpdate(entry.id, 'totalTime', e.target.value)}
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'totalTime', "bg-transparent hover:border-[#E2E8F0] focus:border-[#007BFF] rounded px-1 py-1.5 w-full outline-none text-xs font-mono text-center text-[#007BFF]")}
                    />
                  </td>
                  <td className="p-0.5 w-10">
                    <input 
                      type="text" 
                      value={entry.day} 
                      onChange={(e) => onUpdate(entry.id, 'day', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'day', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5 text-[#003366]/70 bg-slate-400/5 border-0")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.night} 
                      onChange={(e) => onUpdate(entry.id, 'night', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'night', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.crossCountry} 
                      onChange={(e) => onUpdate(entry.id, 'crossCountry', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'crossCountry', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.pic} 
                      onChange={(e) => onUpdate(entry.id, 'pic', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'pic', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.solo || ''} 
                      onChange={(e) => onUpdate(entry.id, 'solo', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'solo', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.sic} 
                      onChange={(e) => onUpdate(entry.id, 'sic', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'sic', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.dualReceived} 
                      onChange={(e) => onUpdate(entry.id, 'dualReceived', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualReceived', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.dualGiven} 
                      onChange={(e) => onUpdate(entry.id, 'dualGiven', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'dualGiven', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-emerald-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.instrument} 
                      onChange={(e) => onUpdate(entry.id, 'instrument', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'instrument', "bg-transparent w-full outline-none text-xs font-mono text-center text-emerald-400 font-bold rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-cyan-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.simulatedInstrument} 
                      onChange={(e) => onUpdate(entry.id, 'simulatedInstrument', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'simulatedInstrument', "bg-transparent w-full outline-none text-xs font-mono text-center text-cyan-400 rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-amber-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.approaches} 
                      onChange={(e) => onUpdate(entry.id, 'approaches', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'approaches', "bg-transparent w-full outline-none text-xs font-mono text-center text-amber-500 font-bold rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.landingsDay} 
                      onChange={(e) => onUpdate(entry.id, 'landingsDay', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsDay', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.landingsNight} 
                      onChange={(e) => onUpdate(entry.id, 'landingsNight', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'landingsNight', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.groundReceived || ''} 
                      onChange={(e) => onUpdate(entry.id, 'groundReceived', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundReceived', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.groundGiven || ''} 
                      onChange={(e) => onUpdate(entry.id, 'groundGiven', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'groundGiven', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.comments} 
                      placeholder="Remarks..."
                      onChange={(e) => onUpdate(entry.id, 'comments', e.target.value)} 
                      readOnly={readOnly}
                      className={getFieldClass(entry, 'comments', "bg-transparent w-full outline-none text-xs px-2 py-2 sm:py-1.5 rounded truncate focus:bg-white/80 backdrop-blur-sm min-h-[44px] sm:min-h-0")} 
                    />
                  </td>
                  <td className="px-2 py-2 text-center sticky right-0 bg-slate-900 group-hover:bg-white/80 backdrop-blur-sm z-20 border-l border-[#E2E8F0] shadow-[-4px_0_8px_rgba(0,0,0,0.3)]">
                    <button onClick={() => onDelete(entry.id)} className="p-2 text-[#003366]/70 hover:text-red-400 transition-colors"><ICONS.Trash /></button>
                  </td>
                </tr>
              ))
            )}
            
            <tr className="bg-slate-950/90 font-mono text-[11px] border-t-2 border-[#E2E8F0] shadow-inner">
                <td className="p-3 sticky left-0 bg-slate-950 z-40 border-r border-[#E2E8F0] text-center text-[#003366]/70 uppercase font-black tracking-tighter">OCR</td>
                <td className="p-3 sticky left-12 bg-slate-950 z-40 border-r border-[#E2E8F0] text-center text-[#003366]/70 font-bold uppercase tracking-tight">Sync</td>
                <td className="p-3 sticky left-24 bg-slate-950 z-30 border-r border-[#E2E8F0] text-[#003366]/70 font-bold uppercase tracking-tight">Date</td>
                <td className="p-3 sticky left-56 bg-slate-950 z-30 border-r border-[#E2E8F0] text-[#003366]/70 font-bold uppercase tracking-tight">Tail #</td>
                <td colSpan={2} className="px-3 py-3"></td>
                <td className="p-3 text-center text-[#007BFF] font-bold bg-blue-500/10 border-r border-slate-800 ring-1 ring-inset ring-blue-500/20">{sumTotal.toFixed(1)}</td>
                <td className="w-10"></td>
                <td colSpan={7}></td>
                <td className="p-3 text-center text-emerald-400 font-bold bg-emerald-500/10 border-r border-slate-800 ring-1 ring-inset ring-emerald-500/20">{sumInst.toFixed(1)}</td>
                <td className="p-3 text-center text-cyan-400 font-bold bg-cyan-500/10 border-r border-slate-800 ring-1 ring-inset ring-cyan-500/20">{sumSim.toFixed(1)}</td>
                <td className="p-3 text-center text-amber-500 font-bold bg-amber-500/10 border-r border-slate-800 ring-1 ring-inset ring-amber-500/20">{sumAppr}</td>
                <td colSpan={6}></td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
      
      {/* Images - Show for both mobile and desktop */}
      {images.length > 0 && (
        <div className="p-4 border-t border-slate-800">
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
      <div className="p-6 bg-white/80 backdrop-blur-sm/40 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-800">
        <div className="flex flex-col">
            <span className="text-sm text-[#003366] font-bold uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              IFR CROSS-CHECK ACTIVE
            </span>
            <p className="text-[11px] text-[#003366]/70 mt-1 max-w-lg leading-relaxed">
              Actual, Simulated, and Approach data are being cross-referenced against keywords in your Remarks section.
            </p>
        </div>
        <button 
          onClick={onAdd}
            className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-white hover:bg-slate-600 rounded-xl text-sm font-bold text-[#003366] transition-all border border-[#E2E8F0] shadow-lg active:scale-95 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
        >
          <ICONS.Plus /> Manual Row
        </button>
      </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
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

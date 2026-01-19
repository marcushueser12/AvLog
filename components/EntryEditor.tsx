import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LogbookEntry } from '../types';
import { ICONS } from '../constants';
import ImageViewer, { ImageViewerHandle } from './ImageViewer';
import { convertDDMMtoMMDD, formatDateForDisplay, adjustYearForDate } from '../utils/logbookUtils';

interface EntryEditorProps {
  entries: LogbookEntry[];
  images: string[]; // Array of base64 images (1 for single mode, 2 for pair mode)
  rotations?: number[]; // Rotation in degrees for each image
  onUpdate: (id: string, field: keyof LogbookEntry, value: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRotationChange?: (imageIndex: number, newRotation: number) => void; // Callback when rotation changes
}

const EntryEditor: React.FC<EntryEditorProps> = ({ 
  entries, 
  images, 
  rotations = [0, 0],
  onUpdate, 
  onDelete, 
  onAdd,
  onRotationChange 
}) => {
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
    return `${base} transition-all duration-300 ${uncertain ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30' : 'border-transparent'}`;
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Date Format Selector & Year Adjustment */}
      <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
            If dates were not written in MM/DD format:
          </label>
          <select
            value={dateFormat}
            onChange={(e) => handleDateFormatChange(e.target.value as 'MM/DD' | 'DD/MM')}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-semibold text-white cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          >
            <option value="MM/DD">MM/DD (Default - No conversion needed)</option>
            <option value="DD/MM">DD/MM (Convert to MM/DD)</option>
          </select>
          <span className="text-xs text-slate-500">
            Dates will be converted to MM/DD/YYYY (US standard) format
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
            Adjust year for all dates:
          </label>
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
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-20 text-center"
          />
          <span className="text-xs text-slate-500">
            Enter year (e.g., 2024) to update all dates
          </span>
        </div>
      </div>
      
      {/* Table */}
      <div 
        ref={tableScrollRef}
        onScroll={handleTableScroll}
        className="overflow-x-auto custom-scrollbar flex-1"
      >
        <table className="w-full text-left border-collapse min-w-[1850px]">
          <thead>
            <tr className="bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
              <th className="px-3 py-4 w-12 sticky left-0 bg-slate-800 z-40 border-r border-slate-700">#</th>
              <th className="px-3 py-4 w-12 sticky left-12 bg-slate-800 z-40 border-r border-slate-700 text-center">Sync</th>
              <th className="px-3 py-4 w-32 sticky left-24 bg-slate-800 z-30 border-r border-slate-700">Date</th>
              <th className="px-3 py-4 w-32 sticky left-56 bg-slate-800 z-30 border-r border-slate-700 shadow-[4px_0_8px_rgba(0,0,0,0.3)]">Tail #</th>
              <th className="px-3 py-4 w-24">From</th>
              <th className="px-3 py-4 w-24">To</th>
              <th className="px-3 py-4 w-24 text-blue-400">Total</th>
              <th className="px-1 py-4 w-10 text-center" title="Day (Auto-calculated: Total - Night)">
                Day
              </th>
              <th className="px-3 py-4 w-20">Night</th>
              <th className="px-3 py-4 w-20">XC</th>
              <th className="px-3 py-4 w-20">PIC</th>
              <th className="px-3 py-4 w-20">SIC</th>
              <th className="px-3 py-4 w-20">Dual Rec</th>
              <th className="px-3 py-4 w-20">Dual Giv</th>
              <th className="px-3 py-4 w-28 text-emerald-400 bg-emerald-400/5">Actual Inst</th>
              <th className="px-3 py-4 w-28 text-cyan-400 bg-cyan-400/5">Sim Inst</th>
              <th className="px-3 py-4 w-20 text-amber-400 bg-amber-400/5">Appr</th>
              <th className="px-3 py-4 w-20">Lnd D</th>
              <th className="px-3 py-4 w-20">Lnd N</th>
              <th className="px-3 py-4 w-32">Comments / Remarks</th>
              <th className="px-3 py-4 w-16 text-center sticky right-0 bg-slate-800 z-30 border-l border-slate-700 shadow-[-4px_0_8px_rgba(0,0,0,0.3)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={21} className="px-4 py-20 text-center text-slate-500 italic font-medium">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Ready for consistent digital logs.
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="p-1 sticky left-0 bg-slate-900 group-hover:bg-slate-800 z-40 border-r border-slate-700 text-center text-[10px] text-slate-500 font-mono">
                    {entry.rowAnchor || '-'}
                  </td>
                  <td className="p-1 sticky left-12 bg-slate-900 group-hover:bg-slate-800 z-40 border-r border-slate-700 text-center">
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
                  <td className="p-1 sticky left-24 bg-slate-900 group-hover:bg-slate-800 z-20 border-r border-slate-700">
                    <input 
                      type="text"
                      value={formatDateForDisplay(entry.date)}
                      onChange={(e) => onUpdate(entry.id, 'date', e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className={getFieldClass(entry, 'date', "bg-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2 py-1.5 w-full outline-none text-xs")}
                    />
                  </td>
                  <td className="p-1 sticky left-56 bg-slate-900 group-hover:bg-slate-800 z-20 border-r border-slate-700 shadow-[4px_0_8_rgba(0,0,0,0.3)]">
                    <input 
                      type="text"
                      value={entry.aircraftId}
                      onChange={(e) => onUpdate(entry.id, 'aircraftId', e.target.value)}
                      className={getFieldClass(entry, 'aircraftId', "bg-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2 py-1.5 w-full outline-none text-xs font-bold uppercase")}
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.from} 
                      onChange={(e) => onUpdate(entry.id, 'from', e.target.value)} 
                      className={getFieldClass(entry, 'from', "bg-transparent w-full outline-none text-xs uppercase text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.to} 
                      onChange={(e) => onUpdate(entry.id, 'to', e.target.value)} 
                      className={getFieldClass(entry, 'to', "bg-transparent w-full outline-none text-xs uppercase text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-blue-500/[0.03]">
                    <input 
                      type="text"
                      value={entry.totalTime}
                      onChange={(e) => onUpdate(entry.id, 'totalTime', e.target.value)}
                      className={getFieldClass(entry, 'totalTime', "bg-transparent hover:border-slate-700 focus:border-blue-500 rounded px-1 py-1.5 w-full outline-none text-xs font-mono text-center text-blue-400")}
                    />
                  </td>
                  <td className="p-0.5 w-10">
                    <input 
                      type="text" 
                      value={entry.day} 
                      onChange={(e) => onUpdate(entry.id, 'day', e.target.value)} 
                      className={getFieldClass(entry, 'day', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5 text-slate-400 bg-slate-400/5 border-0")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.night} 
                      onChange={(e) => onUpdate(entry.id, 'night', e.target.value)} 
                      className={getFieldClass(entry, 'night', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.crossCountry} 
                      onChange={(e) => onUpdate(entry.id, 'crossCountry', e.target.value)} 
                      className={getFieldClass(entry, 'crossCountry', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.pic} 
                      onChange={(e) => onUpdate(entry.id, 'pic', e.target.value)} 
                      className={getFieldClass(entry, 'pic', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.sic} 
                      onChange={(e) => onUpdate(entry.id, 'sic', e.target.value)} 
                      className={getFieldClass(entry, 'sic', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.dualReceived} 
                      onChange={(e) => onUpdate(entry.id, 'dualReceived', e.target.value)} 
                      className={getFieldClass(entry, 'dualReceived', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.dualGiven} 
                      onChange={(e) => onUpdate(entry.id, 'dualGiven', e.target.value)} 
                      className={getFieldClass(entry, 'dualGiven', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-emerald-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.instrument} 
                      onChange={(e) => onUpdate(entry.id, 'instrument', e.target.value)} 
                      className={getFieldClass(entry, 'instrument', "bg-transparent w-full outline-none text-xs font-mono text-center text-emerald-400 font-bold rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-cyan-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.simulatedInstrument} 
                      onChange={(e) => onUpdate(entry.id, 'simulatedInstrument', e.target.value)} 
                      className={getFieldClass(entry, 'simulatedInstrument', "bg-transparent w-full outline-none text-xs font-mono text-center text-cyan-400 rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1 bg-amber-400/[0.05]">
                    <input 
                      type="text" 
                      value={entry.approaches} 
                      onChange={(e) => onUpdate(entry.id, 'approaches', e.target.value)} 
                      className={getFieldClass(entry, 'approaches', "bg-transparent w-full outline-none text-xs font-mono text-center text-amber-500 font-bold rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.landingsDay} 
                      onChange={(e) => onUpdate(entry.id, 'landingsDay', e.target.value)} 
                      className={getFieldClass(entry, 'landingsDay', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.landingsNight} 
                      onChange={(e) => onUpdate(entry.id, 'landingsNight', e.target.value)} 
                      className={getFieldClass(entry, 'landingsNight', "bg-transparent w-full outline-none text-xs font-mono text-center rounded py-1.5")} 
                    />
                  </td>
                  <td className="p-1">
                    <input 
                      type="text" 
                      value={entry.comments} 
                      placeholder="Remarks..."
                      onChange={(e) => onUpdate(entry.id, 'comments', e.target.value)} 
                      className={getFieldClass(entry, 'comments', "bg-transparent w-full outline-none text-xs px-2 py-1.5 rounded truncate focus:bg-slate-800")} 
                    />
                  </td>
                  <td className="px-2 py-2 text-center sticky right-0 bg-slate-900 group-hover:bg-slate-800 z-20 border-l border-slate-700 shadow-[-4px_0_8px_rgba(0,0,0,0.3)]">
                    <button onClick={() => onDelete(entry.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><ICONS.Trash /></button>
                  </td>
                </tr>
              ))
            )}
            
            <tr className="bg-slate-950/90 font-mono text-[11px] border-t-2 border-slate-700 shadow-inner">
                <td colSpan={2} className="p-3 sticky left-0 bg-slate-950 z-40 border-r border-slate-700 text-center text-slate-500 uppercase font-black tracking-tighter">OCR</td>
                <td colSpan={2} className="p-3 sticky left-24 bg-slate-950 z-30 border-r border-slate-700 text-slate-400 font-bold uppercase tracking-tight">Digital Sync Checks</td>
                <td colSpan={2} className="px-3 py-3"></td>
                <td className="p-3 text-center text-blue-400 font-bold bg-blue-500/10 border-r border-slate-800 ring-1 ring-inset ring-blue-500/20">{sumTotal.toFixed(1)}</td>
                <td className="w-10"></td>
                <td colSpan={6}></td>
                <td className="p-3 text-center text-emerald-400 font-bold bg-emerald-500/10 border-r border-slate-800 ring-1 ring-inset ring-emerald-500/20">{sumInst.toFixed(1)}</td>
                <td className="p-3 text-center text-cyan-400 font-bold bg-cyan-500/10 border-r border-slate-800 ring-1 ring-inset ring-cyan-500/20">{sumSim.toFixed(1)}</td>
                <td className="p-3 text-center text-amber-500 font-bold bg-amber-500/10 border-r border-slate-800 ring-1 ring-inset ring-amber-500/20">{sumAppr}</td>
                <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Images below table */}
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
      
      <div className="p-6 bg-slate-800/40 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-800">
        <div className="flex flex-col">
            <span className="text-sm text-slate-300 font-bold uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              IFR CROSS-CHECK ACTIVE
            </span>
            <p className="text-[11px] text-slate-500 mt-1 max-w-lg leading-relaxed">
              Actual, Simulated, and Approach data are being cross-referenced against keywords in your Remarks section.
            </p>
        </div>
        <button 
          onClick={onAdd}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold text-white transition-all border border-slate-600 shadow-lg active:scale-95"
        >
          <ICONS.Plus /> Manual Row
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default EntryEditor;

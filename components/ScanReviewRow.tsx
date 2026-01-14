import React from 'react';
import { PageTotals } from '../types';
import { ICONS } from '../constants';

interface ScanReviewRowProps {
  pageNumber: number;
  totals: PageTotals;
  isExpanded: boolean;
  isVerified: boolean;
  onToggleExpand: () => void;
  onToggleVerify: (checked: boolean) => void;
}

const ScanReviewRow: React.FC<ScanReviewRowProps> = ({
  pageNumber,
  totals,
  isExpanded,
  isVerified,
  onToggleExpand,
  onToggleVerify
}) => {
  if (isExpanded) {
    return null; // When expanded, EntryEditor will show
  }

  return (
    <div 
      onClick={onToggleExpand}
      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-slate-700 transition-all"
    >
      <div className="flex items-center border-b border-slate-800">
        {/* Verify checkbox and page number */}
        <div className="flex items-center gap-3 px-4 py-3 border-r border-slate-800 bg-slate-950/50">
          <input
            type="checkbox"
            checked={isVerified}
            onChange={(e) => {
              e.stopPropagation();
              onToggleVerify(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-sm font-bold text-slate-400 min-w-[2rem]">#{pageNumber}</span>
        </div>

        {/* Totals row - styled similar to table rows */}
        <div className="flex-1 flex items-center gap-4 px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Time</span>
              <span className="text-sm font-bold text-blue-400">{totals.totalTime || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">PIC</span>
              <span className="text-sm font-bold text-slate-300">{totals.pic || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Instrument</span>
              <span className="text-sm font-bold text-slate-300">{totals.instrument || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Sim Inst</span>
              <span className="text-sm font-bold text-slate-300">{totals.simulatedInstrument || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Approaches</span>
              <span className="text-sm font-bold text-slate-300">{totals.approaches || '0'}</span>
            </div>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="px-4 text-slate-500">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transform transition-transform"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ScanReviewRow;

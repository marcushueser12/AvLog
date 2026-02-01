import React from 'react';
import { PageTotals } from '../types';
import { ChevronDown } from 'lucide-react';

interface ScanReviewRowProps {
  pageNumber: number;
  totals: PageTotals;
  isExpanded: boolean;
  isVerified: boolean;
  creditApproved?: boolean;
  onToggleExpand: () => void;
  onToggleVerify: (checked: boolean) => void;
  onApprove?: () => void;
  userCredits?: number | null;
}

const ScanReviewRow: React.FC<ScanReviewRowProps> = ({
  pageNumber,
  totals,
  isExpanded,
  isVerified,
  creditApproved = true,
  onToggleExpand,
  onToggleVerify,
  onApprove,
  userCredits
}) => {
  if (isExpanded) {
    return null; // When expanded, EntryEditor will show
  }

  const canApprove = creditApproved === false && onApprove && (userCredits === null || userCredits >= 1);

  return (
    <div 
      onClick={onToggleExpand}
      className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer hover:border-[#007BFF]/30 hover:shadow-md transition-all shadow-sm"
    >
      <div className="flex items-center border-b border-[#E2E8F0]">
        {/* Approve button (when not yet approved) or Verify checkbox (when approved) */}
        <div className="flex items-center gap-3 px-4 py-3 border-r border-[#E2E8F0] bg-[#F4F7FA]/50">
          {!creditApproved ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canApprove) onApprove?.();
              }}
              disabled={!canApprove}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all shrink-0 ${
                canApprove
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {userCredits !== null && userCredits < 1 ? 'Need 1 credit' : 'Approve (1 credit)'}
            </button>
          ) : (
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => {
                e.stopPropagation();
                onToggleVerify(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded border-2 border-[#E2E8F0] bg-white text-[#007BFF] focus:ring-2 focus:ring-[#007BFF] focus:ring-offset-0 cursor-pointer accent-[#007BFF]"
            />
          )}
          <span className="text-sm font-bold text-[#003366]/70 min-w-[2rem]">#{pageNumber}</span>
        </div>

        {/* Totals row - styled similar to table rows */}
        <div className="flex-1 flex items-center gap-4 px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Total</span>
              <span className="text-sm font-bold text-[#007BFF]">{totals.totalTime || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Day</span>
              <span className="text-sm font-bold text-[#003366]">{totals.day || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Night</span>
              <span className="text-sm font-bold text-[#003366]">{totals.night || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">XC</span>
              <span className="text-sm font-bold text-[#003366]">{totals.crossCountry || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">PIC</span>
              <span className="text-sm font-bold text-[#003366]">{totals.pic || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">SIC</span>
              <span className="text-sm font-bold text-[#003366]">{totals.sic || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Dual Rec</span>
              <span className="text-sm font-bold text-[#003366]">{totals.dualReceived || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Dual Giv</span>
              <span className="text-sm font-bold text-[#003366]">{totals.dualGiven || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Inst</span>
              <span className="text-sm font-bold text-emerald-600">{totals.instrument || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Sim Inst</span>
              <span className="text-sm font-bold text-cyan-600">{totals.simulatedInstrument || '0.0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Appr</span>
              <span className="text-sm font-bold text-amber-600">{totals.approaches || '0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Lnd D</span>
              <span className="text-sm font-bold text-[#003366]">{totals.landingsDay || '0'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">Lnd N</span>
              <span className="text-sm font-bold text-[#003366]">{totals.landingsNight || '0'}</span>
            </div>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="px-4 text-[#003366]/60">
          <ChevronDown className="w-4 h-4 transform transition-transform" />
        </div>
      </div>
    </div>
  );
};

export default ScanReviewRow;

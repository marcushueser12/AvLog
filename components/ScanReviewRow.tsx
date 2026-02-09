import React from 'react';
import { PageTotals } from '../types';
import { ChevronDown } from 'lucide-react';
import { useMobile } from '../utils/useMobile';

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

const TOTALS_ITEMS: { key: keyof PageTotals; label: string; highlight?: 'primary' | 'emerald' | 'cyan' | 'amber' }[] = [
  { key: 'totalTime', label: 'Total', highlight: 'primary' },
  { key: 'day', label: 'Day' },
  { key: 'night', label: 'Night' },
  { key: 'crossCountry', label: 'XC' },
  { key: 'pic', label: 'PIC' },
  { key: 'sic', label: 'SIC' },
  { key: 'dualReceived', label: 'Dual Rec' },
  { key: 'dualGiven', label: 'Dual Giv' },
  { key: 'instrument', label: 'Inst', highlight: 'emerald' },
  { key: 'simulatedInstrument', label: 'Sim Inst', highlight: 'cyan' },
  { key: 'approaches', label: 'Appr', highlight: 'amber' },
  { key: 'landingsDay', label: 'Lnd D' },
  { key: 'landingsNight', label: 'Lnd N' },
];

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
  const isMobile = useMobile();

  if (isExpanded) {
    return null; // When expanded, EntryEditor will show
  }

  const canApprove = creditApproved === false && onApprove && (userCredits === null || userCredits >= 1);

  const valueClass = (highlight?: string) => {
    if (highlight === 'primary') return 'text-[#007BFF]';
    if (highlight === 'emerald') return 'text-emerald-600';
    if (highlight === 'cyan') return 'text-cyan-600';
    if (highlight === 'amber') return 'text-amber-600';
    return 'text-[#003366]';
  };

  if (isMobile) {
    return (
      <div
        onClick={onToggleExpand}
        className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer active:border-[#007BFF]/30 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#E2E8F0] bg-[#F4F7FA]/50">
          <div className="flex items-center gap-2">
            {!creditApproved ? (
              <button
                onClick={(e) => { e.stopPropagation(); if (canApprove) onApprove?.(); }}
                disabled={!canApprove}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${canApprove ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
              >
                {userCredits !== null && userCredits < 1 ? '1 credit' : 'Approve'}
              </button>
            ) : (
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => { e.stopPropagation(); onToggleVerify(e.target.checked); }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-2 border-[#E2E8F0] bg-white text-[#007BFF] accent-[#007BFF]"
              />
            )}
            <span className="text-xs font-bold text-[#003366]/70">#{pageNumber}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-[#003366]/60 shrink-0" />
        </div>
        <div className="grid grid-cols-5 gap-x-2 gap-y-1 px-3 py-2">
          {TOTALS_ITEMS.map(({ key, label, highlight }) => (
            <div key={key} className="flex flex-col min-w-0">
              <span className="text-[8px] text-[#003366]/60 uppercase tracking-wide font-bold truncate">{label}</span>
              <span className={`text-[11px] font-bold truncate ${valueClass(highlight)}`}>{totals[key] ?? '0'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onToggleExpand}
      className="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer hover:border-[#007BFF]/30 hover:shadow-md transition-all shadow-sm"
    >
      <div className="flex items-center border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3 px-4 py-3 border-r border-[#E2E8F0] bg-[#F4F7FA]/50">
          {!creditApproved ? (
            <button
              onClick={(e) => { e.stopPropagation(); if (canApprove) onApprove?.(); }}
              disabled={!canApprove}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all shrink-0 ${canApprove ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
            >
              {userCredits !== null && userCredits < 1 ? 'Need 1 credit' : 'Approve (1 credit)'}
            </button>
          ) : (
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => { e.stopPropagation(); onToggleVerify(e.target.checked); }}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded border-2 border-[#E2E8F0] bg-white text-[#007BFF] focus:ring-2 focus:ring-[#007BFF] focus:ring-offset-0 cursor-pointer accent-[#007BFF]"
            />
          )}
          <span className="text-sm font-bold text-[#003366]/70 min-w-[2rem]">#{pageNumber}</span>
        </div>
        <div className="flex-1 flex items-center gap-4 px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            {TOTALS_ITEMS.map(({ key, label, highlight }) => (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] text-[#003366]/60 uppercase tracking-wider font-bold">{label}</span>
                <span className={`text-sm font-bold ${valueClass(highlight)}`}>{totals[key] ?? '0'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 text-[#003366]/60">
          <ChevronDown className="w-4 h-4 transform transition-transform" />
        </div>
      </div>
    </div>
  );
};

export default ScanReviewRow;

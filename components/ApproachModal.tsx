import React, { useState, useEffect } from 'react';
import { ApproachDetail } from '../types';
import { ICONS } from '../constants';

interface ApproachModalProps {
  isOpen: boolean;
  entryId: string;
  approaches: ApproachDetail[];
  onClose: () => void;
  onSave: (approaches: ApproachDetail[]) => void;
}

const ApproachModal: React.FC<ApproachModalProps> = ({
  isOpen,
  entryId,
  approaches,
  onClose,
  onSave
}) => {
  const [localApproaches, setLocalApproaches] = useState<ApproachDetail[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing approaches or empty array
      setLocalApproaches(approaches.length > 0 ? [...approaches] : []);
    }
  }, [isOpen, approaches]);

  const handleAddApproach = () => {
    if (localApproaches.length < 6) {
      setLocalApproaches([...localApproaches, {}]);
    }
  };

  const handleUpdateApproach = (index: number, field: keyof ApproachDetail, value: string) => {
    const updated = [...localApproaches];
    updated[index] = { ...updated[index], [field]: value };
    setLocalApproaches(updated);
  };

  const handleDeleteApproach = (index: number) => {
    setLocalApproaches(localApproaches.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localApproaches);
    onClose();
  };

  const formatApproachPacked = (approach: ApproachDetail, index: number): string => {
    const number = (index + 1).toString();
    return `${number};${approach.type || ''};${approach.runway || ''};${approach.airport || ''};${approach.comments || ''}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#003366]">Instrument Approaches</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#E2E8F0] rounded-full transition-colors"
            title="Close"
          >
            <ICONS.Close className="w-5 h-5 text-[#003366]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {localApproaches.length === 0 ? (
            <div className="text-center py-12 text-[#003366]/70">
              <p className="mb-4">No approaches added yet.</p>
              <p className="text-sm">Click "Add Approach" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localApproaches.map((approach, index) => (
                <div key={index} className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#003366]">Approach {index + 1}</h3>
                    <button
                      onClick={() => handleDeleteApproach(index)}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      title="Delete approach"
                    >
                      <ICONS.Close className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 uppercase tracking-wide mb-1">
                        Type
                      </label>
                      <input
                        type="text"
                        value={approach.type || ''}
                        onChange={(e) => handleUpdateApproach(index, 'type', e.target.value)}
                        placeholder="ILS, VOR, GPS, etc."
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 uppercase tracking-wide mb-1">
                        Runway
                      </label>
                      <input
                        type="text"
                        value={approach.runway || ''}
                        onChange={(e) => handleUpdateApproach(index, 'runway', e.target.value)}
                        placeholder="18, 23, etc."
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 uppercase tracking-wide mb-1">
                        Airport Identifier
                      </label>
                      <input
                        type="text"
                        value={approach.airport || ''}
                        onChange={(e) => handleUpdateApproach(index, 'airport', e.target.value)}
                        placeholder="KORD, KLAX, etc."
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#003366]/70 uppercase tracking-wide mb-1">
                        Notes/Comments
                      </label>
                      <input
                        type="text"
                        value={approach.comments || ''}
                        onChange={(e) => handleUpdateApproach(index, 'comments', e.target.value)}
                        placeholder="Optional notes"
                        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#003366] outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                      />
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-white rounded border border-amber-200">
                    <p className="text-xs text-[#003366]/70 font-mono">
                      Packed format: {formatApproachPacked(approach, index)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <button
            onClick={handleAddApproach}
            disabled={localApproaches.length >= 6}
            className="flex items-center gap-2 px-4 py-2 bg-[#007BFF] text-white rounded-lg font-semibold hover:bg-[#007BFF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Add Instrument Approach Procedure"
          >
            <ICONS.Plus className="w-4 h-4" />
            Add Approach {localApproaches.length > 0 && `(${localApproaches.length}/6)`}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#003366] rounded-lg font-semibold hover:bg-[#E2E8F0] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Save Approaches
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApproachModal;

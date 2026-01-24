import React, { useState, useEffect } from 'react';
import { ApproachDetail } from '../types';
import { ICONS } from '../constants';

interface ApproachModalProps {
  isOpen: boolean;
  onClose: () => void;
  approaches: ApproachDetail[];
  onSave: (approaches: ApproachDetail[]) => void;
  maxApproaches?: number;
}

const ApproachModal: React.FC<ApproachModalProps> = ({
  isOpen,
  onClose,
  approaches,
  onSave,
  maxApproaches = 6
}) => {
  const [localApproaches, setLocalApproaches] = useState<ApproachDetail[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing approaches or empty array
      setLocalApproaches(approaches.length > 0 ? [...approaches] : []);
    }
  }, [isOpen, approaches]);

  if (!isOpen) return null;

  const handleAddApproach = () => {
    if (localApproaches.length < maxApproaches) {
      setLocalApproaches([...localApproaches, {}]);
    }
  };

  const handleRemoveApproach = (index: number) => {
    setLocalApproaches(localApproaches.filter((_, i) => i !== index));
  };

  const handleUpdateApproach = (index: number, field: keyof ApproachDetail, value: string) => {
    const updated = [...localApproaches];
    updated[index] = { ...updated[index], [field]: value };
    setLocalApproaches(updated);
  };

  const handleSave = () => {
    // Filter out completely empty approaches
    const validApproaches = localApproaches.filter(ap => 
      ap.number || ap.type || ap.runway || ap.airport || ap.comments
    );
    onSave(validApproaches);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[#003366]">Edit Approaches</h2>
          <button
            onClick={onClose}
            className="text-[#003366]/60 hover:text-[#003366] transition-colors"
          >
            <ICONS.Close />
          </button>
        </div>

        <div className="mb-4 p-3 bg-[#F4F7FA] rounded-xl border border-[#E2E8F0]">
          <p className="text-sm text-[#003366]/70">
            Format: <span className="font-mono font-semibold">#;type;runway;airport;comments</span>
          </p>
          <p className="text-xs text-[#003366]/60 mt-1">
            Maximum {maxApproaches} approaches per entry. Empty approaches will be removed when saved.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {localApproaches.length === 0 ? (
            <div className="text-center py-8 text-[#003366]/60">
              <p className="text-sm">No approaches added yet. Click "Add Approach" to get started.</p>
            </div>
          ) : (
            localApproaches.map((approach, index) => (
              <div
                key={index}
                className="p-4 bg-white border-2 border-[#E2E8F0] rounded-xl hover:border-[#007BFF]/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#003366]">Approach {index + 1}</h3>
                  <button
                    onClick={() => handleRemoveApproach(index)}
                    className="text-red-500 hover:text-red-600 p-1 transition-colors"
                    title="Remove approach"
                  >
                    <ICONS.Trash />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#003366]/70 mb-1">
                      # (Approach Number)
                    </label>
                    <input
                      type="text"
                      value={approach.number || ''}
                      onChange={(e) => handleUpdateApproach(index, 'number', e.target.value)}
                      placeholder="#"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#003366]/70 mb-1">
                      Type (ILS, RNAV, VOR, etc.)
                    </label>
                    <input
                      type="text"
                      value={approach.type || ''}
                      onChange={(e) => handleUpdateApproach(index, 'type', e.target.value)}
                      placeholder="Type"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#003366]/70 mb-1">
                      Runway
                    </label>
                    <input
                      type="text"
                      value={approach.runway || ''}
                      onChange={(e) => handleUpdateApproach(index, 'runway', e.target.value)}
                      placeholder="Runway"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#003366]/70 mb-1">
                      Airport
                    </label>
                    <input
                      type="text"
                      value={approach.airport || ''}
                      onChange={(e) => handleUpdateApproach(index, 'airport', e.target.value)}
                      placeholder="Airport"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#003366]/70 mb-1">
                      Comments
                    </label>
                    <input
                      type="text"
                      value={approach.comments || ''}
                      onChange={(e) => handleUpdateApproach(index, 'comments', e.target.value)}
                      placeholder="Comments"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-black font-semibold outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleAddApproach}
            disabled={localApproaches.length >= maxApproaches}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F4F7FA] rounded-xl text-sm font-bold text-[#003366] transition-all border border-[#E2E8F0] shadow-sm hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ICONS.Plus />
            Add Approach {localApproaches.length > 0 && `(${localApproaches.length}/${maxApproaches})`}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white hover:bg-[#F4F7FA] rounded-xl text-sm font-bold text-[#003366] transition-all border border-[#E2E8F0] shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-[#003366] hover:bg-[#003366]/90 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-[#003366]/20"
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

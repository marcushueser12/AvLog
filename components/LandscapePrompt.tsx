import React from 'react';
import { Monitor } from 'lucide-react';
import { useMobile } from '../utils/useMobile';

interface LandscapePromptProps {
  show: boolean;
}

const LandscapePrompt: React.FC<LandscapePromptProps> = ({ show }) => {
  const isMobile = useMobile();

  if (!show || !isMobile) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#003366]/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl">
        <Monitor className="w-16 h-16 mx-auto mb-4 text-[#007BFF]" />
        <h2 className="text-2xl font-black text-[#003366] mb-3">Please Use Desktop or Tablet</h2>
        <p className="text-[#003366]/70">
          LogExtract works best on desktop or tablet for the full experience.
        </p>
        <div className="text-4xl mt-6">💻</div>
      </div>
    </div>
  );
};

export default LandscapePrompt;

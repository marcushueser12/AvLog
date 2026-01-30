import React, { useState, useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { useMobile } from '../utils/useMobile';

interface LandscapePromptProps {
  show: boolean;
}

const LandscapePrompt: React.FC<LandscapePromptProps> = ({ show }) => {
  const isMobile = useMobile();
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!show || !isMobile || isLandscape) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#003366]/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl">
        <RotateCw className="w-16 h-16 mx-auto mb-4 text-[#007BFF]" />
        <h2 className="text-2xl font-black text-[#003366] mb-3">Rotate Your Device</h2>
        <p className="text-[#003366]/70 mb-6">
          Please rotate your phone to landscape mode for the best experience.
        </p>
        <div className="text-4xl">📱 ➡️ 📱</div>
      </div>
    </div>
  );
};

export default LandscapePrompt;

import React from 'react';
import { Plane } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 40 }) => {
  return (
    <div 
      className={`bg-[#003366] rounded-xl flex items-center justify-center ${className}`}
      style={{ width: size, height: size, padding: size * 0.15 }}
      aria-label="LogExtract Logo"
    >
      <Plane className="text-white" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
};

export default Logo;

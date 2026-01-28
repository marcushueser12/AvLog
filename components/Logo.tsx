import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 40 }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="LogExtract Logo"
    >
      {/* Dark blue rounded square */}
      <rect x="20" y="20" width="60" height="60" rx="8" fill="#003366"/>
      
      {/* Book (bottom) */}
      {/* Book spine (left side) */}
      <rect x="28" y="68" width="4" height="8" fill="white"/>
      {/* Book pages (right side) */}
      <rect x="32" y="68" width="20" height="8" fill="white"/>
      {/* Book pages lines */}
      <line x1="35" y1="70" x2="50" y2="70" stroke="#003366" stroke-width="0.5"/>
      <line x1="35" y1="73" x2="50" y2="73" stroke="#003366" stroke-width="0.5"/>
      {/* Bookmark */}
      <path d="M 50 68 L 52 68 L 52 76 L 50 74 Z" fill="white"/>
      
      {/* Airplane (centered above book) */}
      {/* Fuselage */}
      <rect x="48" y="38" width="4" height="20" fill="white"/>
      {/* Wings */}
      <rect x="40" y="45" width="20" height="3" fill="white"/>
      {/* Tail fin */}
      <path d="M 50 38 L 50 35 L 52 38 Z" fill="white"/>
      {/* Horizontal stabilizers */}
      <rect x="46" y="55" width="8" height="2" fill="white"/>
      <rect x="47" y="57" width="6" height="1.5" fill="white"/>
    </svg>
  );
};

export default Logo;

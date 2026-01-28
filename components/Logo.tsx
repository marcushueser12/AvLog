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
      {/* Dark blue rounded square - this IS the logo */}
      <rect x="0" y="0" width="100" height="100" rx="12" fill="#003366"/>
      
      {/* Book at the bottom - white */}
      {/* Book spine (left side) */}
      <rect x="25" y="70" width="5" height="18" fill="white"/>
      {/* Book pages (right side) */}
      <rect x="30" y="70" width="30" height="18" fill="white"/>
      {/* Book pages detail lines */}
      <line x1="33" y1="75" x2="57" y2="75" stroke="#003366" stroke-width="0.8"/>
      <line x1="33" y1="80" x2="57" y2="80" stroke="#003366" stroke-width="0.8"/>
      {/* Bookmark hanging from bottom right */}
      <path d="M 60 88 L 63 88 L 63 95 L 60 92 Z" fill="white"/>
      
      {/* Airplane above book - white, top-down view */}
      {/* Fuselage (vertical) */}
      <rect x="48" y="25" width="4" height="25" fill="white"/>
      {/* Main wings (horizontal) */}
      <rect x="35" y="32" width="30" height="4" fill="white"/>
      {/* Tail fin (vertical at back) */}
      <rect x="49" y="20" width="2" height="8" fill="white"/>
      {/* Horizontal stabilizers (at back, smaller) */}
      <rect x="44" y="47" width="12" height="2.5" fill="white"/>
    </svg>
  );
};

export default Logo;

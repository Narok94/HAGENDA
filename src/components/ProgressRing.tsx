import React from 'react';

interface ProgressRingProps {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}

export function ProgressRing({ pct, color, size = 44, stroke = 4, children }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle 
          cx={size / 2} 
          cy={size / 2} 
          r={radius} 
          stroke="#EEF0F3" 
          strokeWidth={stroke} 
          fill="none" 
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export default ProgressRing;

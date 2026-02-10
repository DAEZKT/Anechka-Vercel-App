import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hoverEffect = false, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        glass-panel rounded-2xl p-6 
        border border-white/40 
        text-glass-text
        transition-all duration-300
        ${hoverEffect ? 'hover:bg-white/40 hover:scale-[1.01] cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
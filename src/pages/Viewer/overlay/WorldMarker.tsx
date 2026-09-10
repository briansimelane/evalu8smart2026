import React from 'react';
import { WorldId, WORLD_ACCENT } from './worldAccent';
import { cn } from '@/lib/utils';

export const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

interface WorldMarkerProps {
  world: WorldId;
  teamColor: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
  title?: string;
  showWorldLetter?: boolean;
  style?: React.CSSProperties;
}

const SIZE_CLASSES = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const MULTI_CHAR_SIZE_CLASSES = {
  xs: 'min-w-[20px] h-4 px-1 text-[8.5px] leading-none tracking-tighter whitespace-nowrap',
  sm: 'min-w-[26px] h-6 px-1 text-[10px] leading-none tracking-tighter whitespace-nowrap',
  md: 'min-w-[32px] h-8 px-1.5 text-xs leading-none tracking-tight whitespace-nowrap',
  lg: 'min-w-[40px] h-10 px-1.5 text-xs leading-none tracking-tight whitespace-nowrap',
};

export const WorldMarker: React.FC<WorldMarkerProps> = ({
  world,
  teamColor,
  size = 'md',
  className,
  children,
  title,
  showWorldLetter = false,
  style,
}) => {
  const accent = WORLD_ACCENT[world];
  const textColor = getContrastTextColor(teamColor);
  const childrenStr = children !== null && children !== undefined && (typeof children === 'string' || typeof children === 'number')
    ? String(children)
    : '';
  const isMultiChar = childrenStr.length > 1;

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-black shrink-0 relative transition-all duration-200',
        isMultiChar ? MULTI_CHAR_SIZE_CLASSES[size] : SIZE_CLASSES[size],
        className
      )}
      style={{
        backgroundColor: teamColor,
        color: textColor,
        boxShadow: `0 0 0 1.5px #ffffff, 0 1px 3px rgba(0,0,0,0.3)`,
        ...style,
      }}
      title={title}
    >
      {showWorldLetter && (
        <span
          className="text-[8px] absolute -top-1 -left-1 px-1 rounded-full font-mono font-extrabold shadow-xs"
          style={{
            backgroundColor: accent.ring,
            color: '#ffffff',
          }}
        >
          {world}
        </span>
      )}
      {children}
    </div>
  );
};

interface WorldTagProps {
  world: WorldId;
  label?: string;
  className?: string;
}

export const WorldTag: React.FC<WorldTagProps> = ({ world, label, className }) => {
  const accent = WORLD_ACCENT[world];
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shrink-0 inline-flex items-center gap-1 shadow-xs',
        className
      )}
      style={{
        backgroundColor: accent.bg,
        color: accent.text,
        borderColor: accent.border,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.ring }} />
      {label || `WORLD ${world}`}
    </span>
  );
};

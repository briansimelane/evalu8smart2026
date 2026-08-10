import React, { useEffect, useState } from 'react';
import { useMotion } from './motion/MotionContext';

export const EventTicker = () => {
  const { ticker } = useMotion();
  const [currentEntry, setCurrentEntry] = useState<{ label: string; color?: string } | null>(null);
  const [fade, setFade] = useState(true);

  const activeEntry = ticker[0] || null;

  useEffect(() => {
    if (!activeEntry) return;

    // Trigger cross-fade transitions
    setFade(false);
    const timeout = setTimeout(() => {
      setCurrentEntry(activeEntry);
      setFade(true);
    }, 150);

    return () => clearTimeout(timeout);
  }, [activeEntry?.id, activeEntry?.label]);

  if (!currentEntry) {
    return (
      <div className="absolute top-[120px] left-0 right-0 h-[34px] bg-slate-900 border-y border-slate-800 flex items-center justify-center px-4 z-40">
        <div className="text-xs font-black tracking-wider uppercase text-slate-400">
          Waiting for actions...
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-[120px] left-0 right-0 h-[34px] bg-slate-900 border-y border-slate-800 flex items-center justify-center px-4 z-40">
      <div 
        className="text-xs font-black tracking-wider uppercase transition-all duration-150 ease-in-out"
        style={{
          color: currentEntry.color || '#e2e8f0',
          opacity: fade ? 1 : 0,
          transform: `translateY(${fade ? '0' : '2px'})`
        }}
      >
        {currentEntry.label}
      </div>
    </div>
  );
};
export default EventTicker;

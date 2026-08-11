import React, { useState, useEffect, useRef, ReactNode } from 'react';

const BOARD_W = 1920;
const BOARD_H = 1080;

interface ViewerScalerProps {
  children: ReactNode;
}

export function ViewerScaler({ children }: ViewerScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availW = rect.width || window.innerWidth;
      const availH = rect.height || window.innerHeight;
      
      const newScale = Math.min(
        availW / BOARD_W,
        availH / BOARD_H
      );
      setScale(newScale > 0 ? newScale : 1);
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full min-h-0 flex-1 overflow-hidden flex items-center justify-center bg-slate-950 relative"
    >
      <div 
        style={{ 
          width: BOARD_W, 
          height: BOARD_H,
          transform: `scale(${scale})`, 
          transformOrigin: 'center',
          ['--mo-scale' as string]: String(scale)
        }}
        className="relative shrink-0"
      >
        {children}
      </div>
    </div>
  );
}

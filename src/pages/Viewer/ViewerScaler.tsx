import React, { useState, useEffect, ReactNode } from 'react';

const BOARD_W = 1920;
const BOARD_H = 1080;

interface ViewerScalerProps {
  children: ReactNode;
}

export function ViewerScaler({ children }: ViewerScalerProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      setScale(Math.min(
        window.innerWidth / BOARD_W,
        window.innerHeight / BOARD_H
      ));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden flex items-center justify-center bg-slate-100">
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

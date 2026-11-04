import React, { useState, useEffect, useRef, ReactNode } from 'react';

const BOARD_W = 1920;
const BOARD_H = 1080;

interface ViewerScalerProps {
  children: ReactNode;
}

export function ViewerScaler({ children }: ViewerScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState({ x: 1, y: 1, min: 1 });

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availW = rect.width || window.innerWidth;
      const availH = rect.height || window.innerHeight;

      const scaleX = availW > 0 ? availW / BOARD_W : 1;
      const scaleY = availH > 0 ? availH / BOARD_H : 1;
      const minScale = Math.min(scaleX, scaleY);

      setScale({
        x: scaleX,
        y: scaleY,
        min: minScale > 0 ? minScale : 1,
      });
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    document.addEventListener('fullscreenchange', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
      document.removeEventListener('fullscreenchange', updateScale);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full aspect-[16/9] min-h-0 flex-1 overflow-hidden bg-slate-950 relative select-none"
    >
      <div
        style={{
          width: BOARD_W,
          height: BOARD_H,
          transform: `scale(${scale.x}, ${scale.y})`,
          transformOrigin: '0 0',
          ['--mo-scale' as string]: String(scale.min),
        }}
        className="absolute top-0 left-0 shrink-0"
      >
        {children}
      </div>
    </div>
  );
}

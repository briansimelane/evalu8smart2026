import React, { useEffect, useState } from 'react';

interface BoatProps {
  x: number;
  y: number;
  scale?: number;
  reducedMotion?: boolean;
}

export function Boat({ x, y, scale = 1, reducedMotion = false }: BoatProps) {
  const [bobOffset, setBobOffset] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      setBobOffset(1.8 * Math.sin(elapsed * 2));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [reducedMotion]);

  const s = 40 * scale;

  return (
    <g transform={`translate(${x}, ${y + bobOffset})`} className="ambient-boat pointer-events-none">
      {/* Hull */}
      <polygon
        points={`${-s * 0.4},0 ${s * 0.4},0 ${s * 0.28},${s * 0.18} ${-s * 0.25},${s * 0.18}`}
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth={1}
      />
      {/* Sail */}
      <polygon
        points={`0,${-s * 0.05} 0,${-s * 0.7} ${s * 0.35},${-s * 0.1}`}
        fill="#ff6b6b"
      />
      {/* Jib */}
      <polygon
        points={`0,${-s * 0.05} 0,${-s * 0.6} ${-s * 0.25},${-s * 0.12}`}
        fill="#f1f5f9"
      />
      {/* Mast */}
      <line x1={0} y1={0} x2={0} y2={-s * 0.75} stroke="#475569" strokeWidth={1.5} />
    </g>
  );
}

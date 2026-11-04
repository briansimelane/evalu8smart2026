import React, { useEffect, useState } from 'react';

interface WaterProps {
  reducedMotion?: boolean;
}

export function Water({ reducedMotion = false }: WaterProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      setPhase((elapsed * 1.5) % (Math.PI * 2));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [reducedMotion]);

  // Subtle ripple wave opacity and radius offset
  const rippleScale = reducedMotion ? 1 : 1 + 0.05 * Math.sin(phase);
  const rippleOpacity = reducedMotion ? 0.7 : 0.6 + 0.15 * Math.cos(phase);

  return (
    <g className="ambient-water-ripple pointer-events-none" opacity={rippleOpacity} transform={`scale(${rippleScale})`}>
      {/* Used by Caribbean / Australia water features */}
    </g>
  );
}

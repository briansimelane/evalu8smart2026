import React, { useEffect, useState } from 'react';

interface CloudsProps {
  reducedMotion?: boolean;
}

export function Clouds({ reducedMotion = false }: CloudsProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      // Drifts slowly across stage (takes ~120s to complete full loop)
      setOffset((elapsed * 12) % 2200);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <g className="ambient-clouds pointer-events-none select-none opacity-40">
      {/* Cloud 1 */}
      <g transform={`translate(${((offset + 100) % 2200) - 200}, 150)`}>
        <ellipse cx={0} cy={0} rx={50} ry={16} fill="#ffffff" />
        <ellipse cx={-20} cy={-8} rx={32} ry={18} fill="#ffffff" />
        <ellipse cx={18} cy={-6} rx={28} ry={14} fill="#ffffff" />
      </g>

      {/* Cloud 2 */}
      <g transform={`translate(${((offset + 850) % 2200) - 200}, 190)`}>
        <ellipse cx={0} cy={0} rx={65} ry={19} fill="#ffffff" />
        <ellipse cx={-25} cy={-10} rx={40} ry={22} fill="#ffffff" />
        <ellipse cx={25} cy={-7} rx={36} ry={18} fill="#ffffff" />
      </g>

      {/* Cloud 3 */}
      <g transform={`translate(${((offset + 1600) % 2200) - 200}, 160)`}>
        <ellipse cx={0} cy={0} rx={55} ry={17} fill="#ffffff" />
        <ellipse cx={-18} cy={-9} rx={34} ry={20} fill="#ffffff" />
        <ellipse cx={20} cy={-5} rx={30} ry={15} fill="#ffffff" />
      </g>
    </g>
  );
}

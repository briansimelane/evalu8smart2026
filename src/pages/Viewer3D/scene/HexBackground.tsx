import React, { useMemo } from 'react';

export function HexBackground() {
  // Deterministic hex tiles matching gen15.py
  const hexTiles = useMemo(() => {
    // Generate deterministic pseudo-random hexes
    const tiles: Array<{ cx: number; cy: number; w: number; h: number }> = [];
    const seed = (s: number) => {
      let x = Math.sin(s++) * 10000;
      return x - Math.floor(x);
    };

    // 34 background hex tiles
    for (let i = 0; i < 34; i++) {
      const rx = seed(i * 13 + 7);
      const ry = seed(i * 29 + 11);
      const rw = seed(i * 37 + 19);

      const cx = 160 + rx * 1600;
      const cy = 130 + ry * 800;
      const w = (1.4 + rw * 1.5) * 65;
      const h = w * 0.42;

      tiles.push({ cx, cy, w, h });
    }
    return tiles;
  }, []);

  return (
    <g className="hex-background-layer pointer-events-none select-none">
      <defs>
        <linearGradient id="board-bg" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#eef3fb" />
          <stop offset="50%" stopColor="#e4ecf8" />
          <stop offset="100%" stopColor="#dbe6f4" />
        </linearGradient>
      </defs>

      {/* Main Board Base Gradient */}
      <rect width="1920" height="1080" fill="url(#board-bg)" />

      {/* Scattered Ambient Hex Outlines */}
      {hexTiles.map((tile, i) => {
        const { cx, cy, w, h } = tile;
        const pts = [
          `${cx - w / 2},${cy}`,
          `${cx - w * 0.35},${cy - h / 2}`,
          `${cx + w * 0.35},${cy - h / 2}`,
          `${cx + w / 2},${cy}`,
          `${cx + w * 0.35},${cy + h / 2}`,
          `${cx - w * 0.35},${cy + h / 2}`,
        ].join(' ');

        return (
          <polygon
            key={i}
            points={pts}
            fill="#f6f9fe"
            stroke="#d9e3f3"
            strokeWidth={1.8}
            strokeLinejoin="round"
            opacity={0.65}
          />
        );
      })}
    </g>
  );
}

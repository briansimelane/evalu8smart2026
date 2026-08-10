import { MotionState } from './useBoardMotion';
import React from 'react';

// Pre-compute soft color helper
function getSoftColor(hex: string): string {
  if (hex && hex.startsWith('#')) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }
  return 'rgba(245, 158, 11, 0.18)';
}

export function getMotionStyles(m: MotionState, key: string, defaultColor?: string): React.CSSProperties {
  const tier = m.tierFor(key);
  const isRecent = m.isRecent(key);
  const delay = m.delayFor(key);

  const style: React.CSSProperties = {};
  if (tier > 0 && delay > 0) {
    style['--mo-delay' as any] = `${delay}ms`;
  }

  let color = defaultColor;
  if (isRecent) {
    color = m.recentColorFor(key) || color;
  }

  if (color) {
    style['--mo-accent' as any] = color;
    style['--mo-accent-soft' as any] = m.recentColorSoftFor(key) || getSoftColor(color);
  }

  return style;
}

export function getMotionClass(m: MotionState, key: string, size: 'sm' | 'lg' = 'sm'): string {
  const tier = m.tierFor(key);
  const isRecent = m.isRecent(key);

  const classes: string[] = [];

  if (tier === 1) {
    classes.push('mo-announce');
    if (size === 'sm') {
      classes.push('mo-announce--sm');
    } else {
      classes.push('mo-announce--lg');
    }
  } else if (tier === 2) {
    classes.push('mo-ack');
  }

  if (isRecent) {
    classes.push('mo-recent');
  }

  return classes.join(' ');
}

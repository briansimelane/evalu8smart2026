import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Medal3DProps {
  rank: number;
  reducedMotion?: boolean;
}

const MEDAL_COLORS: Record<number, { base: string; rim: string; shine: string }> = {
  1: { base: '#fbbf24', rim: '#f59e0b', shine: '#fef08a' }, // Gold
  2: { base: '#cbd5e1', rim: '#94a3b8', shine: '#f8fafc' }, // Silver
  3: { base: '#d6a36b', rim: '#b45309', shine: '#fed7aa' }, // Bronze
};

export function Medal3D({ rank, reducedMotion = false }: Medal3DProps) {
  const medalRef = useRef<THREE.Group>(null);
  const colors = MEDAL_COLORS[rank] || { base: '#e2e8f0', rim: '#cbd5e1', shine: '#ffffff' };

  useFrame((state, delta) => {
    if (reducedMotion || !medalRef.current) return;
    // Gentle tilt sway
    const t = state.clock.getElapsedTime();
    medalRef.current.rotation.y = Math.sin(t * 1.5 + rank) * 0.25;
    medalRef.current.rotation.x = Math.cos(t * 1.2) * 0.1;
  });

  return (
    <group ref={medalRef}>
      {/* Outer Coin / Rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 32]} />
        <meshStandardMaterial color={colors.rim} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Raised Face */}
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.04, 32]} />
        <meshStandardMaterial color={colors.base} metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Shine Accent */}
      <mesh position={[0.25, 0.25, 0.08]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.15, 0.4]} />
        <meshBasicMaterial color={colors.shine} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

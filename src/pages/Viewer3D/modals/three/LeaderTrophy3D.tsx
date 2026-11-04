import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LeaderTrophy3DProps {
  reducedMotion?: boolean;
}

export function LeaderTrophy3D({ reducedMotion = false }: LeaderTrophy3DProps) {
  const trophyRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (reducedMotion || !trophyRef.current) return;
    trophyRef.current.rotation.y += delta * 1.2;
  });

  return (
    <group ref={trophyRef} position={[0, 0, 0]} scale={[0.85, 0.85, 0.85]}>
      {/* Trophy Cup Base */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.35, 0.45, 0.18, 24]} />
        <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Stem */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.35, 16]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Bowl */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.55, 0.22, 0.65, 24, 1, true]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Bowl Bottom */}
      <mesh position={[0, -0.27, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
        <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Handles (left & right torus) */}
      <mesh position={[-0.48, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.22, 0.045, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.48, 0.08, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.22, 0.045, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Star / Crest inside */}
      <mesh position={[0, 0.48, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={0.6} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

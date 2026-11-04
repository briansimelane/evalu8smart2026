import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Effect3DIconProps {
  type: string;
  reducedMotion?: boolean;
}

export function Effect3DIcon({ type, reducedMotion = false }: Effect3DIconProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 2) * 0.05;
    groupRef.current.rotation.y = Math.sin(t * 1.5) * 0.12;
  });

  const getTileColor = () => {
    switch (type) {
      case 'Price Plus':
      case 'Price and Product':
        return '#e11d2e';
      case 'Product':
        return '#475569';
      case 'Research':
        return '#7c3aed';
      case 'Logistic':
        return '#06b6d4';
      default:
        return '#3b82f6';
    }
  };

  return (
    <group ref={groupRef}>
      {/* Glossy Rounded Box Tile */}
      <mesh>
        <boxGeometry args={[0.9, 0.9, 0.2]} />
        <meshStandardMaterial
          color={getTileColor()}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>

      {/* Front Gloss highlight plate */}
      <mesh position={[0, 0.18, 0.11]}>
        <planeGeometry args={[0.7, 0.25]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>

      {/* Center 3D Symbol Accent */}
      {type === 'Price Plus' && (
        <group position={[0, 0, 0.12]}>
          {/* Green plus accent */}
          <mesh position={[0.26, -0.26, 0.02]}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
            <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}

      {type === 'Research' && (
        <group position={[0, -0.05, 0.12]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#c084fc" emissive="#9333ea" emissiveIntensity={0.4} />
          </mesh>
        </group>
      )}

      {type === 'Product' && (
        <group position={[0, 0, 0.12]}>
          <mesh rotation={[0.2, 0.4, 0]}>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.3} />
          </mesh>
        </group>
      )}

      {type === 'Logistic' && (
        <group position={[0, 0, 0.12]}>
          <mesh position={[-0.05, 0, 0]}>
            <boxGeometry args={[0.42, 0.28, 0.18]} />
            <meshStandardMaterial color="#a5f3fc" emissive="#0891b2" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0.2, -0.04, 0]}>
            <boxGeometry args={[0.18, 0.2, 0.18]} />
            <meshStandardMaterial color="#67e8f9" />
          </mesh>
        </group>
      )}
    </group>
  );
}

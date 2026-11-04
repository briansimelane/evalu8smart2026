import React from 'react';
import { Canvas } from '@react-three/fiber';

interface ModalCanvasProps {
  children: React.ReactNode;
  className?: string;
  cameraPosition?: [number, number, number];
  fov?: number;
}

export function ModalCanvas({
  children,
  className = 'w-full h-full pointer-events-none',
  cameraPosition = [0, 0, 3.2],
  fov = 45,
}: ModalCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: cameraPosition, fov }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      className={className}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} />
      <pointLight position={[0, 2, 3]} intensity={0.8} />
      {children}
    </Canvas>
  );
}

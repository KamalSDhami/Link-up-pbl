import { Canvas, useFrame } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'

type PointerState = {
  x: number
  y: number
}

function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)
  const baseRotation = useRef(0)
  const pointer = useRef<PointerState>({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    // Handle visibility change to pause/resume animation smoothly
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }

    window.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const positions = useMemo(() => {
    const count = 2400
    const radius = 4
    const posArray = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const r = radius * Math.pow(Math.random(), 0.35)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      posArray[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      posArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      posArray[i * 3 + 2] = r * Math.cos(phi)
    }

    return posArray
  }, [])

  useFrame((_state: RootState, delta: number) => {
    if (!pointsRef.current) return
    
    // Skip animation update when tab is not visible
    // Also clamp delta to prevent jumps after tab switch (max 100ms = 0.1s)
    if (!isVisible) return
    const clampedDelta = Math.min(delta, 0.1)
    
    baseRotation.current += clampedDelta * 0.25

    const targetX = pointer.current.y * 0.4
    const targetY = pointer.current.x * 0.6

    pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, targetX, 0.05)
    pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, baseRotation.current + targetY, 0.05)
  })

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color="#b8d9ff"
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        opacity={0.9}
      />
    </Points>
  )
}

export function HeroParticleField() {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 8], fov: 55 }}
      gl={{ antialias: true }}
    >
  <color attach="background" args={[ '#010311' ]} />
  <fog attach="fog" args={[ '#010311', 12, 26 ]} />
      <ParticleField />
    </Canvas>
  )
}

export default HeroParticleField

import { useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Edges, Environment, Grid, Html, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Scene3DErrorBoundary, WebGLFallback, webGLSupported } from './SceneGuard'
import type { ComponentStatus } from '@/types'

/**
 * Interactive CONCEPTUAL assembly of the PUNARVA tester interior. Geometry is
 * symbolic (proportions chosen for clarity) — it is explicitly not a
 * dimensionally accurate CAD model. Components whose development status is
 * "planned" are rendered ghosted.
 */

export interface AssemblyPart {
  id: string
  label: string
  status: ComponentStatus
  position: [number, number, number]
}

export const ASSEMBLY_PARTS: AssemblyPart[] = [
  { id: 'esp32', label: 'ESP32 DevKit V1', status: 'in-development', position: [-0.7, 1.25, -0.35] },
  { id: 'ads1115', label: 'ADS1115 ADC', status: 'in-development', position: [0.28, 1.12, -0.5] },
  { id: 'voltage-sensing', label: 'Voltage sensing', status: 'in-development', position: [0.28, 1.12, 0.12] },
  { id: 'current-sensor', label: 'Current sensor', status: 'planned', position: [-0.1, 1.12, 0.4] },
  { id: 'temp-sensor', label: 'Temp sensor', status: 'planned', position: [0.72, 1.12, 0.42] },
  { id: 'oled', label: 'I2C OLED', status: 'planned', position: [0.75, 1.3, -0.38] },
  { id: 'load-stage', label: 'Controlled load (proposed)', status: 'planned', position: [-0.85, 1.3, 0.5] },
  { id: 'microsd', label: 'MicroSD logging', status: 'planned', position: [-0.12, 1.1, -0.72] },
  { id: 'probes', label: 'Probe connections', status: 'planned', position: [1.75, 0.95, 0.3] },
]

interface PartInteractionProps {
  id: string
  label: string
  status: ComponentStatus
  selected: boolean
  onSelect: (id: string) => void
  children: React.ReactNode
  labelPosition: [number, number, number]
}

function Part({ id, label, status, selected, onSelect, children, labelPosition }: PartInteractionProps) {
  const [hovered, setHovered] = useState(false)
  const ghost = status === 'planned'

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <group
        scale={selected ? 1.06 : hovered ? 1.03 : 1}
      >
        <group>{children}</group>
      </group>
      {(hovered || selected) && (
        <Html position={labelPosition} center distanceFactor={7} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold backdrop-blur ${
              selected
                ? 'border-copper-500/60 bg-plum-900/90 text-copper-300'
                : 'border-sea-400/50 bg-plum-900/85 text-sea-300'
            }`}
          >
            {label}
            {ghost && <span className="ml-1.5 text-lavender/70">· planned</span>}
          </div>
        </Html>
      )}
    </group>
  )
}

function Pcb() {
  return (
    <mesh position={[0, 0.82, 0]} receiveShadow castShadow>
      <boxGeometry args={[2.4, 0.06, 1.6]} />
      <meshStandardMaterial color="#14402f" metalness={0.3} roughness={0.55} />
      <Edges color="#2B9E8B" scale={1.001} />
    </mesh>
  )
}

function Esp32Module({ ghost }: { ghost: boolean }) {
  return (
    <group position={[-0.7, 0.9, -0.35]}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.78, 0.04, 0.52]} />
        <meshStandardMaterial color="#1d5c41" metalness={0.3} roughness={0.5} transparent={ghost} opacity={ghost ? 0.35 : 1} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.58, 0.09, 0.36]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.25} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
      <mesh position={[0.33, 0.1, 0.18]}>
        <boxGeometry args={[0.1, 0.05, 0.12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.3} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
    </group>
  )
}

function Ads1115({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.28, 0.9, -0.5]}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.44, 0.04, 0.36]} />
        <meshStandardMaterial color="#2b2b6b" metalness={0.3} roughness={0.5} transparent={ghost} opacity={ghost ? 0.35 : 1} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[0.17, 0.04, 0.17]} />
        <meshStandardMaterial color="#0d0817" metalness={0.4} roughness={0.4} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
    </group>
  )
}

function VoltageSensing({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.28, 0.9, 0.12]}>
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} castShadow>
          <boxGeometry args={[0.1, 0.06, 0.26]} />
          <meshStandardMaterial color="#8a6d3b" metalness={0.35} roughness={0.5} transparent={ghost} opacity={ghost ? 0.35 : 1} />
        </mesh>
      ))}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.16, 0.012, 0.05]} />
        <meshStandardMaterial color="#c9b26b" metalness={0.6} roughness={0.4} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
    </group>
  )
}

function CurrentSensor({ ghost }: { ghost: boolean }) {
  return (
    <mesh position={[-0.1, 0.92, 0.42]} castShadow>
      <boxGeometry args={[0.32, 0.14, 0.3]} />
      <meshStandardMaterial color="#101418" metalness={0.4} roughness={0.45} transparent opacity={ghost ? 0.3 : 1} />
    </mesh>
  )
}

function TempSensor({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.72, 0.92, 0.44]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 18]} />
        <meshStandardMaterial color="#181822" metalness={0.5} roughness={0.4} transparent opacity={ghost ? 0.3 : 1} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshStandardMaterial color="#c0392b" metalness={0.4} roughness={0.4} transparent opacity={ghost ? 0.3 : 1} />
      </mesh>
    </group>
  )
}

function Oled({ ghost }: { ghost: boolean }) {
  return (
    <group position={[0.75, 0.92, -0.38]}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.7, 0.1, 0.4]} />
        <meshStandardMaterial color="#0d0817" metalness={0.3} roughness={0.5} transparent={ghost} opacity={ghost ? 0.35 : 1} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial color="#63D8C2" toneMapped={false} transparent opacity={ghost ? 0.5 : 0.95} />
      </mesh>
    </group>
  )
}

function LoadStage({ ghost }: { ghost: boolean }) {
  return (
    <group position={[-0.85, 1.0, 0.52]}>
      <RoundedBox args={[0.72, 0.28, 0.5]} radius={0.05} smoothness={3} castShadow>
        <meshStandardMaterial color="#70597F" metalness={0.4} roughness={0.5} transparent opacity={ghost ? 0.22 : 1} />
        <Edges color="#FF936B" scale={1.01} />
      </RoundedBox>
      <mesh position={[0.45, 0.05, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 12]} />
        <meshStandardMaterial color="#c0392b" transparent opacity={ghost ? 0.25 : 1} />
      </mesh>
    </group>
  )
}

function MicroSd({ ghost }: { ghost: boolean }) {
  return (
    <mesh position={[-0.12, 0.9, -0.72]} castShadow>
      <boxGeometry args={[0.3, 0.09, 0.34]} />
      <meshStandardMaterial color="#3c3c48" metalness={0.5} roughness={0.4} transparent opacity={ghost ? 0.3 : 1} />
    </mesh>
  )
}

function Probes({ ghost }: { ghost: boolean }) {
  return (
    <group position={[1.72, 0.9, 0.3]}>
      {[0.22, -0.22].map((z, i) => (
        <group key={z} position={[0, 0, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.75, 12]} />
            <meshStandardMaterial color={i === 0 ? '#b8412f' : '#241e2e'} roughness={0.5} transparent opacity={ghost ? 0.35 : 1} />
          </mesh>
          <mesh position={[0.44, 0, 0]}>
            <torusGeometry args={[0.07, 0.02, 8, 20]} />
            <meshStandardMaterial color={i === 0 ? '#ff6b57' : '#584066'} metalness={0.6} roughness={0.35} transparent opacity={ghost ? 0.3 : 1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Enclosure() {
  return (
    <group position={[0, 1.02, 0]}>
      <RoundedBox args={[3.1, 1.7, 2.3]} radius={0.14} smoothness={4}>
        <meshStandardMaterial color="#35233F" transparent opacity={0.05} depthWrite={false} />
        <Edges color="#70597F" scale={1.0} />
      </RoundedBox>
    </group>
  )
}

function Pulse({ enabled }: { enabled: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const r = ring.current
    if (!r || !enabled) return
    const t = (state.clock.elapsedTime % 3) / 3
    const s = 0.4 + t * 3.4
    r.scale.set(s, s, s)
    ;(r.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t)
  })
  return (
    <mesh ref={ring} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={enabled}>
      <ringGeometry args={[0.9, 1.02, 48]} />
      <meshBasicMaterial color="#63D8C2" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

export interface TesterAssemblySceneProps {
  selectedId: string | null
  onSelect: (id: string | null) => void
  motionEnabled: boolean
  controlsRef?: React.Ref<OrbitControlsImpl>
}

function AssemblyContent({ selectedId, onSelect, motionEnabled }: Omit<TesterAssemblySceneProps, 'controlsRef'>) {
  const ghostFor = (id: string) => ASSEMBLY_PARTS.find((p) => p.id === id)?.status === 'planned'

  return (
    <>
      <color attach="background" args={['#1a1024']} />
      <fog attach="fog" args={['#1a1024', 13, 24]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-4, 2.5, 2]} intensity={16} color="#FF936B" distance={12} decay={2} />
      <pointLight position={[4, 2, -2]} intensity={14} color="#63D8C2" distance={12} decay={2} />

      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#fff4eb" />
        <Lightformer intensity={1.3} position={[-5, 1.5, 0]} rotation-y={Math.PI / 2} scale={[6, 2.5, 1]} color="#FF936B" />
        <Lightformer intensity={1.1} position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[6, 2.5, 1]} color="#63D8C2" />
      </Environment>

      <Enclosure />
      <Pcb />
      <Pulse enabled={motionEnabled} />

      <Part id="esp32" label="ESP32 DevKit V1" status="in-development" selected={selectedId === 'esp32'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[0].position}>
        <Esp32Module ghost={ghostFor('esp32')} />
      </Part>
      <Part id="ads1115" label="ADS1115 ADC" status="in-development" selected={selectedId === 'ads1115'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[1].position}>
        <Ads1115 ghost={ghostFor('ads1115')} />
      </Part>
      <Part id="voltage-sensing" label="Voltage sensing" status="in-development" selected={selectedId === 'voltage-sensing'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[2].position}>
        <VoltageSensing ghost={ghostFor('voltage-sensing')} />
      </Part>
      <Part id="current-sensor" label="Current sensor" status="planned" selected={selectedId === 'current-sensor'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[3].position}>
        <CurrentSensor ghost={ghostFor('current-sensor')} />
      </Part>
      <Part id="temp-sensor" label="Temp sensor" status="planned" selected={selectedId === 'temp-sensor'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[4].position}>
        <TempSensor ghost={ghostFor('temp-sensor')} />
      </Part>
      <Part id="oled" label="I2C OLED" status="planned" selected={selectedId === 'oled'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[5].position}>
        <Oled ghost={ghostFor('oled')} />
      </Part>
      <Part id="load-stage" label="Controlled load (proposed)" status="planned" selected={selectedId === 'load-stage'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[6].position}>
        <LoadStage ghost={ghostFor('load-stage')} />
      </Part>
      <Part id="microsd" label="MicroSD logging" status="planned" selected={selectedId === 'microsd'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[7].position}>
        <MicroSd ghost={ghostFor('microsd')} />
      </Part>
      <Part id="probes" label="Probe connections" status="planned" selected={selectedId === 'probes'} onSelect={onSelect} labelPosition={ASSEMBLY_PARTS[8].position}>
        <Probes ghost={ghostFor('probes')} />
      </Part>

      {/* Lab floor */}
      <mesh position={[0, -0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color="#170e21" roughness={0.96} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#3a2a4e"
        sectionSize={2.5}
        sectionThickness={1.1}
        sectionColor="#584066"
        fadeDistance={16}
        fadeStrength={1.4}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={12} blur={2.4} far={4} />
    </>
  )
}

export function TesterAssemblyVisual({ selectedId, onSelect, motionEnabled, controlsRef }: TesterAssemblySceneProps) {
  if (!webGLSupported()) {
    return (
      <WebGLFallback
        height={430}
        label="The component list and signal-flow diagram below remain fully interactive."
      />
    )
  }
  return (
    <Scene3DErrorBoundary fallback={<WebGLFallback height={430} />}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [3.4, 2.5, 3.8], fov: 40, near: 0.1, far: 60 }}
        gl={{ antialias: true }}
        onPointerMissed={() => onSelect(null)}
        style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
      >
        <AssemblyContent selectedId={selectedId} onSelect={onSelect} motionEnabled={motionEnabled} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={3.2}
          maxDistance={9}
          maxPolarAngle={Math.PI / 2 - 0.06}
          autoRotate={motionEnabled}
          autoRotateSpeed={0.5}
          target={[0, 0.95, 0]}
        />
      </Canvas>
    </Scene3DErrorBoundary>
  )
}


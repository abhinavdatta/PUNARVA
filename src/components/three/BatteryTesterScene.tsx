import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  createBatteryLabelTexture,
  createDisplayTexture,
  createStripTexture,
  type DisplayState,
} from './textures'
import { Scene3DErrorBoundary, WebGLFallback, webGLSupported } from './SceneGuard'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface LiveReadingView {
  voltage_v: number | null
  current_a: number | null
  temperature_c: number | null
}

export interface BatteryTesterSceneProps {
  testing?: boolean
  progress?: number
  reading?: LiveReadingView | null
  demo?: boolean
  waveform?: number[]
  compact?: boolean
  motionEnabled: boolean
  controlsRef?: React.Ref<OrbitControlsImpl>
}

/* ------------------------------------------------------------------ */
/* Sub-objects                                                         */
/* ------------------------------------------------------------------ */

const BATTERY_POS: [number, number, number] = [-1.55, 0, 0]
const TESTER_POS: [number, number, number] = [1.75, 0, 0]

function Battery({ label }: { label: THREE.Texture }) {
  return (
    <group position={BATTERY_POS}>
      {/* Casing */}
      <RoundedBox args={[2.2, 1.3, 1.25]} radius={0.09} smoothness={4} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b2d4d" metalness={0.55} roughness={0.38} />
      </RoundedBox>
      {/* Top cap line */}
      <mesh position={[0, 1.42, 0]}>
        <boxGeometry args={[2.22, 0.05, 1.27]} />
        <meshStandardMaterial color="#241a33" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Front label */}
      <mesh position={[0, 0.75, 0.629]}>
        <planeGeometry args={[1.8, 0.9]} />
        <meshBasicMaterial map={label} toneMapped={false} />
      </mesh>
      {/* Terminals: + (red) and − (black) */}
      {[
        { x: 0.55, color: '#c0392b', ring: '#ff6b57' },
        { x: -0.55, color: '#15121c', ring: '#584066' },
      ].map((t) => (
        <group key={t.x} position={[t.x, 1.44, 0.25]}>
          <mesh position={[0, -0.03, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.05, 24]} />
            <meshStandardMaterial color={t.ring} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.09, 0]} castShadow>
            <cylinderGeometry args={[0.095, 0.095, 0.2, 24]} />
            <meshStandardMaterial color={t.color} metalness={0.75} roughness={0.28} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Tester({ strip }: { strip: THREE.Texture }) {
  return (
    <group position={TESTER_POS}>
      {/* Enclosure */}
      <RoundedBox args={[1.6, 2.1, 0.95]} radius={0.12} smoothness={4} position={[0, 1.15, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#35233F" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      {/* Feet */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.8]} />
          <meshStandardMaterial color="#180E20" roughness={0.9} />
        </mesh>
      ))}
      {/* Display bezel (screen content is rendered by TesterDisplayUpdater) */}
      <mesh position={[0, 1.52, 0.49]}>
        <boxGeometry args={[1.24, 0.88, 0.04]} />
        <meshStandardMaterial color="#0d0817" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Nameplate strip */}
      <mesh position={[0, 0.92, 0.487]}>
        <planeGeometry args={[1.05, 0.2]} />
        <meshBasicMaterial map={strip} toneMapped={false} />
      </mesh>
      {/* Control buttons */}
      {[
        { x: -0.38, color: '#FF936B' },
        { x: 0, color: '#C7B7CC' },
        { x: 0.38, color: '#63D8C2' },
      ].map((b) => (
        <mesh key={b.x} position={[b.x, 0.6, 0.49]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.06, 24]} />
          <meshStandardMaterial color={b.color} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {/* Probe jacks on top */}
      {[
        { x: -0.35, ring: '#ff6b57' },
        { x: 0.35, ring: '#C7B7CC' },
      ].map((p) => (
        <group key={p.x} position={[p.x, 2.23, 0.18]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.11, 0.14, 20]} />
            <meshStandardMaterial color="#180E20" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[0.06, 0.018, 10, 24]} />
            <meshStandardMaterial color={p.ring} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Side vents */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0.805, 1.7 - i * 0.16, 0]}>
          <boxGeometry args={[0.012, 0.05, 0.6]} />
          <meshStandardMaterial color="#180E20" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function makeLeadCurve(from: THREE.Vector3, to: THREE.Vector3, sag: number, outX: number, midZ: number): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    from,
    new THREE.Vector3(outX, from.y - 0.5, from.z + 0.35),
    new THREE.Vector3(outX + 0.5, sag, midZ),
    new THREE.Vector3((from.x + to.x) / 2, sag - 0.08, midZ + 0.5),
    new THREE.Vector3(to.x + 0.3, sag + 0.25, to.z + 0.5),
    to,
  ])
}

function Lead({ curve, color }: { curve: THREE.CatmullRomCurve3; color: string }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 96, 0.028, 10, false), [curve])
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} metalness={0.15} roughness={0.5} />
    </mesh>
  )
}

/** Restrained energy pulses flowing along a lead while a test runs. */
function LeadFlow({ curve, testing, motionEnabled }: { curve: THREE.CatmullRomCurve3; testing: boolean; motionEnabled: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame((state) => {
    for (let i = 0; i < 3; i++) {
      const mesh = refs.current[i]
      if (!mesh) continue
      mesh.visible = testing && motionEnabled
      if (!mesh.visible) continue
      const t = (state.clock.elapsedTime * 0.22 + i / 3) % 1
      const p = curve.getPointAt(t)
      mesh.position.copy(p)
    }
  })
  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m }} visible={false}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#8AE8D6" toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  )
}

/** Scanning ring around the battery during a demo test. */
function ScanningRing({ testing, motionEnabled }: { testing: boolean; motionEnabled: boolean }) {
  const group = useRef<THREE.Group>(null)
  const matA = useRef<THREE.MeshBasicMaterial>(null)
  const matB = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.visible = testing
    if (!testing || !motionEnabled) return
    g.position.y = 0.78 + Math.sin(state.clock.elapsedTime * 2.1) * 0.52
    if (matA.current) matA.current.opacity = 0.65 + Math.sin(state.clock.elapsedTime * 4.2) * 0.25
    if (matB.current) matB.current.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 4.2 + 1) * 0.15
  })

  return (
    <group ref={group} position={[BATTERY_POS[0], 0.78, BATTERY_POS[2]]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <mesh>
        <torusGeometry args={[1.5, 0.02, 12, 96]} />
        <meshBasicMaterial ref={matA} color="#63D8C2" toneMapped={false} transparent opacity={0.8} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.66, 0.008, 8, 96]} />
        <meshBasicMaterial ref={matB} color="#FF936B" toneMapped={false} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

/** Small drifting particles — skipped entirely when motion is reduced. */
function Particles({ enabled }: { enabled: boolean }) {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(70 * 3)
    for (let i = 0; i < 70; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 7.5
      arr[i * 3 + 1] = Math.random() * 3.2
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4.5
    }
    return arr
  }, [])

  useFrame(() => {
    const p = points.current
    if (!p || !enabled) return
    const attr = p.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + 0.0022
      if (y > 3.4) y = 0
      attr.setY(i, y)
    }
    attr.needsUpdate = true
  })

  if (!enabled) return null
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.032} color="#8AE8D6" transparent opacity={0.45} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

/** Gentle whole-scene sway so the hero feels alive without being distracting. */
function Sway({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    if (!enabled) {
      g.rotation.y = 0
      g.position.y = 0
      return
    }
    g.rotation.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.035
    g.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.02
  })
  return <group ref={group}>{children}</group>
}

function TesterDisplayUpdater({
  testing,
  demo,
  reading,
  waveform,
  progress,
}: {
  testing: boolean
  demo: boolean
  reading: LiveReadingView | null
  waveform: number[]
  progress: number
}) {
  const displayRef = useRef<{ texture: THREE.CanvasTexture; update: (s: DisplayState) => void } | null>(null)
  const acc = useRef(0)

  if (displayRef.current === null) {
    displayRef.current = createDisplayTexture()
  }

  useFrame((_, delta) => {
    acc.current += delta
    if (acc.current < 0.22) return
    acc.current = 0
    const d = displayRef.current
    if (!d) return
    d.update({
      testing,
      demo,
      voltage: reading?.voltage_v ?? null,
      current: reading?.current_a ?? null,
      temperature: reading?.temperature_c ?? null,
      waveform,
      progress,
    })
  })

  const texture = displayRef.current.texture
  return (
    <group position={TESTER_POS}>
      <mesh position={[0, 1.52, 0.516]}>
        <planeGeometry args={[1.1, 0.74]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function SceneContent(props: BatteryTesterSceneProps) {
  const { testing = false, progress = 0, reading = null, demo = true, waveform = [], motionEnabled } = props

  const label = useMemo(() => createBatteryLabelTexture(), [])
  const strip = useMemo(() => createStripTexture('PUNARVA  BT-1  •  ESP32 PROTOTYPE'), [])

  const { redCurve, blackCurve } = useMemo(() => {
    // tester jacks (world coords)
    const jackRed = new THREE.Vector3(TESTER_POS[0] - 0.35, 2.3, TESTER_POS[2] + 0.18)
    const jackBlack = new THREE.Vector3(TESTER_POS[0] + 0.35, 2.3, TESTER_POS[2] + 0.18)
    // battery terminals (world coords)
    const termPlus = new THREE.Vector3(BATTERY_POS[0] + 0.55, 1.56, BATTERY_POS[2] + 0.25)
    const termMinus = new THREE.Vector3(BATTERY_POS[0] - 0.55, 1.56, BATTERY_POS[2] + 0.25)
    return {
      redCurve: makeLeadCurve(jackRed, termPlus, 0.45, TESTER_POS[0] + 1.1, 0.9),
      blackCurve: makeLeadCurve(jackBlack, termMinus, 0.32, TESTER_POS[0] + 1.35, 1.15),
    }
  }, [])

  return (
    <>
      <color attach="background" args={['#1a1024']} />
      <fog attach="fog" args={['#1a1024', 14, 26]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[4.5, 7.5, 4]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-4.5, 2.5, 2.5]} intensity={22} color="#FF936B" distance={13} decay={2} />
      <pointLight position={[4.5, 2.2, -2]} intensity={18} color="#63D8C2" distance={13} decay={2} />

      {/* Custom offline environment for metallic reflections (no CDN HDR fetch) */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.6} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#fff4eb" />
        <Lightformer intensity={1.4} position={[-5, 1.5, 1]} rotation-y={Math.PI / 2} scale={[7, 2.5, 1]} color="#FF936B" />
        <Lightformer intensity={1.2} position={[5, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[7, 2.5, 1]} color="#63D8C2" />
      </Environment>

      <Sway enabled={motionEnabled}>
        <Battery label={label} />
        <Tester strip={strip} />
        <TesterDisplayUpdater
          testing={testing}
          demo={demo}
          reading={reading}
          waveform={waveform}
          progress={progress}
        />
        <Lead curve={redCurve} color="#b8412f" />
        <Lead curve={blackCurve} color="#241e2e" />
        <LeadFlow curve={redCurve} testing={testing} motionEnabled={motionEnabled} />
        <LeadFlow curve={blackCurve} testing={testing} motionEnabled={motionEnabled} />
        <ScanningRing testing={testing} motionEnabled={motionEnabled} />
      </Sway>

      {/* Lab floor */}
      <mesh position={[0, -0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#170e21" roughness={0.96} metalness={0.05} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[24, 24]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#3a2a4e"
        sectionSize={2.5}
        sectionThickness={1.1}
        sectionColor="#584066"
        fadeDistance={19}
        fadeStrength={1.4}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.62} scale={15} blur={2.6} far={4.5} />

      <Particles enabled={motionEnabled} />

      <OrbitControls
        ref={props.controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4.2}
        maxDistance={10.5}
        maxPolarAngle={Math.PI / 2 - 0.05}
        autoRotate={motionEnabled && !testing}
        autoRotateSpeed={0.65}
        target={[0, 1.05, 0]}
      />
    </>
  )
}

/**
 * The PUNARVA hero visualization: a conceptual battery connected to the
 * PUNARVA tester via red/black leads, rendered with real WebGL.
 * Clearly labelled a conceptual prototype — not a manufacturing CAD model.
 */
export function BatteryTesterVisual(props: Omit<BatteryTesterSceneProps, 'controlsRef'> & { controlsRef?: React.Ref<OrbitControlsImpl> }) {
  if (!webGLSupported()) {
    return <WebGLFallback height={props.compact ? 360 : 460} label="The dashboard and test workflow work normally without it." />
  }
  return (
    <Scene3DErrorBoundary fallback={<WebGLFallback height={props.compact ? 360 : 460} />}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 2.35, props.compact ? 7.4 : 6.7], fov: 38, near: 0.1, far: 60 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
      >
        <SceneContent {...props} />
      </Canvas>
    </Scene3DErrorBoundary>
  )
}

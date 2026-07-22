import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import type { ActiveSpeech } from '@/features/speech/useHeadTTS'
import { ExaminerBust } from './ExaminerBust'
import { StudioLighting } from './StudioLighting'

function useTabVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

interface AvatarSceneProps {
  activeSpeechRef: React.RefObject<ActiveSpeech | null>
}

/** Layer 2 of the 3-layer render (see CLAUDE.md) — the avatar canvas. */
export function AvatarScene({ activeSpeechRef }: AvatarSceneProps) {
  const tabVisible = useTabVisible()

  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      shadows
      dpr={[1, Math.min(2, window.devicePixelRatio)]}
      frameloop={tabVisible ? 'always' : 'never'}
      camera={{ position: [0, 0.75, 6.3], fov: 30 }}
      gl={{ antialias: true }}
    >
      <StudioLighting />
      <group position={[0, 0.55, 0]}>
        <ExaminerBust activeSpeechRef={activeSpeechRef} />
        <ContactShadows position={[0, -1.35, 0]} opacity={0.5} blur={2.4} far={2} />
      </group>
    </Canvas>
  )
}

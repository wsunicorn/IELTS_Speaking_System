import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ActiveSpeech } from '@/features/speech/useHeadTTS'

const CLOSED_SCALE_Y = 1
const OPEN_SCALE_Y = 4.5
const LERP_SPEED = 18

/**
 * Approximate mouth-open animation driven by HeadTTS viseme timing — there is
 * no blendshape rig (see plan 6.1), so this just scales the mouth mesh on Y.
 */
export function useMouthSync(activeSpeechRef: React.RefObject<ActiveSpeech | null>) {
  const mouthRef = useRef<Mesh>(null)

  useFrame((_state, delta) => {
    const mouth = mouthRef.current
    if (!mouth) return

    const active = activeSpeechRef.current
    let openness = 0
    if (active) {
      const elapsed = active.audioCtx.currentTime - active.startTime
      const frame = active.envelope.frames.find(
        (f) => elapsed >= f.time && elapsed < f.time + f.duration,
      )
      openness = frame ? frame.openness : 0
    }

    const targetScaleY = CLOSED_SCALE_Y + openness * (OPEN_SCALE_Y - CLOSED_SCALE_Y)
    mouth.scale.y += (targetScaleY - mouth.scale.y) * Math.min(1, LERP_SPEED * delta)
  })

  return mouthRef
}

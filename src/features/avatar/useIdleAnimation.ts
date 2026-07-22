import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'

const BREATH_FREQUENCY_HZ = 0.22
const BREATH_AMPLITUDE = 0.015
const SWAY_AMPLITUDE_Y = 0.05
const SWAY_AMPLITUDE_X = 0.02
const BLINK_DURATION_S = 0.12
const BLINK_INTERVAL_MIN_S = 2
const BLINK_INTERVAL_MAX_S = 6

function randomBlinkDelay() {
  return (
    BLINK_INTERVAL_MIN_S +
    Math.random() * (BLINK_INTERVAL_MAX_S - BLINK_INTERVAL_MIN_S)
  )
}

/** Breathing, blinking, and micro head-sway for the `idle`/`listening` states. Owns its refs — attach them directly to the meshes/groups they animate. */
export function useIdleAnimation(reducedMotion: boolean) {
  const headRef = useRef<Group>(null)
  const chestRef = useRef<Group>(null)
  const eyelidLeftRef = useRef<Mesh>(null)
  const eyelidRightRef = useRef<Mesh>(null)
  const nextBlinkAt = useRef(randomBlinkDelay())
  const blinkStartedAt = useRef<number | null>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (!reducedMotion) {
      const chest = chestRef.current
      if (chest) {
        const breath = Math.sin(t * BREATH_FREQUENCY_HZ * Math.PI * 2) * BREATH_AMPLITUDE
        chest.scale.y = 1 + breath
        chest.position.y = breath * 0.5
      }
      const head = headRef.current
      if (head) {
        head.rotation.y = Math.sin(t * 0.15) * SWAY_AMPLITUDE_Y
        head.rotation.x = Math.sin(t * 0.11) * SWAY_AMPLITUDE_X
      }
    }

    const left = eyelidLeftRef.current
    const right = eyelidRightRef.current
    if (left && right) {
      if (blinkStartedAt.current === null && t >= nextBlinkAt.current) {
        blinkStartedAt.current = t
      }
      if (blinkStartedAt.current !== null) {
        const progress = (t - blinkStartedAt.current) / BLINK_DURATION_S
        if (progress >= 1) {
          left.scale.y = 1
          right.scale.y = 1
          blinkStartedAt.current = null
          nextBlinkAt.current = t + randomBlinkDelay()
        } else {
          // close then reopen within BLINK_DURATION_S
          const closeAmount = 1 - Math.sin(progress * Math.PI)
          left.scale.y = Math.max(closeAmount, 0.05)
          right.scale.y = Math.max(closeAmount, 0.05)
        }
      }
    }
  })

  return { headRef, chestRef, eyelidLeftRef, eyelidRightRef }
}

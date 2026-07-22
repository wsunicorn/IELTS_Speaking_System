import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIdleAnimation } from './useIdleAnimation'

const SKIN_COLOR = '#d9b79c'
const SUIT_COLOR = '#232838'
const EYE_COLOR = '#1a1a1f'
const MOUTH_COLOR = '#8a4a45'
const HAIR_COLOR = '#2b2620'

const HEAD_Y = 0.56
const HEAD_RADIUS = 0.38

/** Stylized, fully procedural examiner bust — no external mesh (see plan 6.1). */
export function ExaminerBust() {
  const reducedMotion = usePrefersReducedMotion()
  const { headRef, chestRef, eyelidLeftRef, eyelidRightRef } =
    useIdleAnimation(reducedMotion)

  return (
    <group>
      {/* Torso / shoulders (suit) — rounded ellipsoid, no flat cap */}
      <group ref={chestRef}>
        <mesh position={[0, -0.58, 0]} scale={[1.05, 0.85, 0.75]} castShadow receiveShadow>
          <sphereGeometry args={[0.68, 32, 32]} />
          <meshStandardMaterial color={SUIT_COLOR} roughness={0.75} metalness={0.05} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.18, 16]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>

      {/* Head group (sway target) */}
      <group ref={headRef} position={[0, HEAD_Y, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[HEAD_RADIUS, 32, 32]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.7} />
        </mesh>

        {/* Hair — full closed sphere sitting on top, avoids open-edge seams */}
        <mesh position={[0, 0.15, -0.02]} scale={[1.05, 0.58, 1.02]}>
          <sphereGeometry args={[HEAD_RADIUS + 0.02, 32, 32]} />
          <meshStandardMaterial color={HAIR_COLOR} roughness={0.9} />
        </mesh>

        {/* Eyes */}
        <group position={[0, 0.04, 0.33]}>
          <mesh position={[-0.14, 0, 0]}>
            <sphereGeometry args={[0.042, 16, 16]} />
            <meshStandardMaterial color={EYE_COLOR} roughness={0.3} />
          </mesh>
          <mesh position={[0.14, 0, 0]}>
            <sphereGeometry args={[0.042, 16, 16]} />
            <meshStandardMaterial color={EYE_COLOR} roughness={0.3} />
          </mesh>

          {/* Eyelids — scaled on Y to blink, resting just above the eyes */}
          <mesh ref={eyelidLeftRef} position={[-0.14, 0.02, 0.01]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.047, 16, 16]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.7} />
          </mesh>
          <mesh ref={eyelidRightRef} position={[0.14, 0.02, 0.01]} scale={[1, 0.001, 1]}>
            <sphereGeometry args={[0.047, 16, 16]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.7} />
          </mesh>
        </group>

        {/* Mouth — static for Phase 1; Phase 2 drives scale.y from TTS amplitude */}
        <mesh position={[0, -0.16, 0.36]}>
          <boxGeometry args={[0.15, 0.025, 0.02]} />
          <meshStandardMaterial color={MOUTH_COLOR} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

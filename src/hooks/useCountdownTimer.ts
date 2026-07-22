import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseCountdownTimerOptions {
  /** Start ticking immediately on mount instead of waiting for `start()`. */
  autoStart?: boolean
}

export interface UseCountdownTimerResult {
  secondsRemaining: number
  isRunning: boolean
  /** True once the timer has reached 0 and `onComplete` has fired. */
  isComplete: boolean
  start: () => void
  pause: () => void
  /** Stop, clear completion, and reset the remaining time (defaults to the original duration). */
  reset: (nextDurationSeconds?: number) => void
}

const TICK_INTERVAL_MS = 200

/**
 * Generic mm:ss countdown with a completion callback. Knows nothing about cue
 * cards or IELTS parts — reusable for any timed phase (Part 1/2/3 prep,
 * speaking, discussion) so each feature just picks its own duration.
 *
 * Uses a wall-clock deadline (not a naive per-tick decrement) so the
 * remaining time stays correct even if the tab is throttled in the
 * background and ticks are delayed/skipped.
 */
export function useCountdownTimer(
  durationSeconds: number,
  onComplete?: () => void,
  options: UseCountdownTimerOptions = {},
): UseCountdownTimerResult {
  const { autoStart = false } = options

  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds)
  const [isRunning, setIsRunning] = useState(autoStart)
  const [isComplete, setIsComplete] = useState(false)

  // Deadline is computed lazily inside the effect below (Date.now() is
  // impure and must not run during render) — null here just means
  // "not armed yet", including the autoStart case on first mount.
  const deadlineRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  useEffect(() => {
    if (!isRunning) return undefined

    if (deadlineRef.current === null) {
      deadlineRef.current = Date.now() + secondsRemaining * 1000
    }

    const id = window.setInterval(() => {
      const deadline = deadlineRef.current
      if (deadline === null) return

      const remainingMs = deadline - Date.now()
      const nextSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
      setSecondsRemaining(nextSeconds)

      if (nextSeconds <= 0) {
        deadlineRef.current = null
        setIsRunning(false)
        setIsComplete(true)
        onCompleteRef.current?.()
      }
    }, TICK_INTERVAL_MS)

    return () => window.clearInterval(id)
    // Only re-arm the interval when running state flips; the tick itself
    // always re-reads deadlineRef/onCompleteRef, so no other deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  const start = useCallback(() => {
    setSecondsRemaining((current) => {
      if (current <= 0) return current
      deadlineRef.current = Date.now() + current * 1000
      return current
    })
    setIsComplete(false)
    setIsRunning(true)
  }, [])

  const pause = useCallback(() => {
    deadlineRef.current = null
    setIsRunning(false)
  }, [])

  const reset = useCallback(
    (nextDurationSeconds?: number) => {
      deadlineRef.current = null
      setIsRunning(false)
      setIsComplete(false)
      setSecondsRemaining(nextDurationSeconds ?? durationSeconds)
    },
    [durationSeconds],
  )

  return { secondsRemaining, isRunning, isComplete, start, pause, reset }
}

/** Formats whole seconds as `m:ss` for on-screen timers. */
export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

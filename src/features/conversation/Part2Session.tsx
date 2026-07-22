import { useEffect, useRef } from 'react'
import { useSpeechToText } from '@/features/speech/useSpeechToText'
import { computeMetrics } from '@/features/scoring/metrics'
import { segmentsToWordTimings } from '@/features/scoring/wordTimings'
import type { Metrics } from '@/types/session'
import { CueCard, type CueCardPhase } from './CueCard'
import type { CueCardData } from './types'

export interface Part2SessionResult {
  card: CueCardData
  transcript: string
  metrics: Metrics
  durationMs: number
  /** True if STT never reached a usable transcript (mic denied, model load failed, ...). */
  transcriptionFailed: boolean
}

export interface Part2SessionProps {
  card: CueCardData
  prepSeconds?: number
  speakingSeconds?: number
  onSessionComplete: (result: Part2SessionResult) => void
  className?: string
}

/**
 * Wires the presentational CueCard to real mic transcription: starts the STT
 * pipeline as soon as prep begins (model load can take 10-30s+ on a cold
 * start — starting during the 1-minute prep window means it's usually ready
 * before the candidate needs to speak), stops it when the card is done, and
 * hands the parent a finished transcript + computed metrics.
 */
export function Part2Session({
  card,
  prepSeconds,
  speakingSeconds,
  onSessionComplete,
  className,
}: Part2SessionProps) {
  const stt = useSpeechToText('moonshine')
  const speakingStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    void stt.start()
    return () => stt.stop()
    // Mount-once: start listening as soon as the session appears so the STT
    // model has the whole prep phase to finish loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePhaseChange = (phase: CueCardPhase) => {
    if (phase === 'speaking') {
      speakingStartedAtRef.current = performance.now()
    }
  }

  const handleComplete = () => {
    stt.stop()

    const transcript = stt.segments.map((s) => s.text).join(' ').trim()
    const words = segmentsToWordTimings(stt.segments)
    const durationMs = speakingStartedAtRef.current
      ? performance.now() - speakingStartedAtRef.current
      : (speakingSeconds ?? 120) * 1000

    onSessionComplete({
      card,
      transcript,
      metrics: computeMetrics(words, transcript, durationMs),
      durationMs,
      transcriptionFailed: stt.status === 'error' || transcript.length === 0,
    })
  }

  return (
    <CueCard
      card={card}
      prepSeconds={prepSeconds}
      speakingSeconds={speakingSeconds}
      onPhaseChange={handlePhaseChange}
      onComplete={handleComplete}
      className={className}
    />
  )
}

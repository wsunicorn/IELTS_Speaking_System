import { useState } from 'react'
import { CheckCircle2, Mic, PenLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatCountdown, useCountdownTimer } from '@/hooks/useCountdownTimer'
import type { CueCardData } from './types'

const DEFAULT_PREP_SECONDS = 60
const DEFAULT_SPEAKING_SECONDS = 120

export type CueCardPhase = 'prep' | 'speaking' | 'done'

export interface CueCardProps {
  card: CueCardData
  /** Preparation time in seconds. IELTS Part 2 default is 60. */
  prepSeconds?: number
  /** Speaking time in seconds. IELTS Part 2 default is 120 (up to 2 minutes). */
  speakingSeconds?: number
  /** Fired on every phase transition — e.g. so a wrapper can start/stop mic recording on 'speaking'/'done'. */
  onPhaseChange?: (phase: CueCardPhase) => void
  /** Fired once when the speaking timer reaches 0. Rendering what comes next is a later phase. */
  onComplete?: () => void
  className?: string
}

const PHASE_COPY: Record<CueCardPhase, { label: string; announcement: string }> = {
  prep: {
    label: 'Preparation',
    announcement: 'Preparation started. You have one minute to prepare.',
  },
  speaking: {
    label: 'Speaking',
    announcement: 'Preparation time is over. Start speaking now.',
  },
  done: {
    label: "Time's up",
    announcement: "Time's up.",
  },
}

/**
 * IELTS Speaking Part 2 cue card: shows the topic + bullet points, then
 * auto-advances through a 1-minute prep phase into an up-to-2-minute
 * speaking phase with a visible countdown. Purely presentational/timer
 * logic — does not know about the conversation loop or Claude API.
 */
export function CueCard({
  card,
  prepSeconds = DEFAULT_PREP_SECONDS,
  speakingSeconds = DEFAULT_SPEAKING_SECONDS,
  onPhaseChange,
  onComplete,
  className,
}: CueCardProps) {
  const [phase, setPhase] = useState<CueCardPhase>('prep')

  const transitionTo = (next: CueCardPhase) => {
    setPhase(next)
    onPhaseChange?.(next)
  }

  // Two dedicated timer instances (one per phase) instead of one reused/reset
  // timer — each only ever runs once, so the phase transition is a plain
  // setState call from the completion callback with no reset/re-arm dance.
  const speakingTimer = useCountdownTimer(
    speakingSeconds,
    () => {
      transitionTo('done')
      onComplete?.()
    },
    { autoStart: false },
  )
  const prepTimer = useCountdownTimer(
    prepSeconds,
    () => {
      transitionTo('speaking')
      speakingTimer.start()
    },
    { autoStart: true },
  )

  const timer = phase === 'prep' ? prepTimer : speakingTimer

  const totalSeconds = phase === 'prep' ? prepSeconds : speakingSeconds
  const progressValue =
    totalSeconds > 0 ? (timer.secondsRemaining / totalSeconds) * 100 : 0
  const phaseCopy = PHASE_COPY[phase]

  return (
    <Card
      data-slot="cue-card"
      className={cn(
        'w-full max-w-md border-border/50 bg-card/60 py-5 text-left backdrop-blur-xl transition-colors',
        phase === 'speaking' && 'ring-1 ring-primary/40',
        phase === 'done' && 'ring-1 ring-destructive/40',
        className,
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={
              phase === 'prep'
                ? 'secondary'
                : phase === 'speaking'
                  ? 'default'
                  : 'destructive'
            }
            className="gap-1"
          >
            {phase === 'prep' && <PenLine className="size-3" aria-hidden="true" />}
            {phase === 'speaking' && <Mic className="size-3" aria-hidden="true" />}
            {phase === 'done' && <CheckCircle2 className="size-3" aria-hidden="true" />}
            {phaseCopy.label}
          </Badge>

          <span
            className="font-mono text-lg tabular-nums text-foreground"
            role="timer"
            aria-label={`${formatCountdown(timer.secondsRemaining)} remaining`}
          >
            {formatCountdown(timer.secondsRemaining)}
          </span>
        </div>

        {phase !== 'done' && (
          <Progress
            value={progressValue}
            className={cn(
              phase === 'prep' &&
                '*:data-[slot=progress-indicator]:bg-secondary-foreground/60',
            )}
          />
        )}

        <CardTitle className="text-balance text-lg leading-snug font-medium">
          {card.topic}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
          {card.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        {phase === 'prep' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
            You may take notes while you prepare.
          </p>
        )}

        {phase === 'done' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            Speaking time is over.
          </p>
        )}
      </CardContent>

      {/* Screen-reader-only phase announcements; the visible badge/timer above stays silent on every tick. */}
      <span className="sr-only" role="status" aria-live="polite">
        {phaseCopy.announcement}
      </span>
    </Card>
  )
}

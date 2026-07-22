import { BadgeInfo, MicOff, Repeat, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCountdown } from '@/hooks/useCountdownTimer'
import type { Metrics } from '@/types/session'
import type { Part2SessionResult } from './Part2Session'

export interface SummaryScreenProps {
  result: Part2SessionResult
  onRetry: () => void
  onSaveAndExit: () => void
  onDiscardAndExit: () => void
}

interface StatDefinition {
  key: keyof Metrics
  label: string
  format: (value: number) => string
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.round(ms)} ms`
}

const STAT_DEFS: StatDefinition[] = [
  {
    key: 'wordsPerMinute',
    label: 'Words per minute',
    format: (v) => Math.round(v).toString(),
  },
  { key: 'fillerCount', label: 'Filler words', format: (v) => Math.round(v).toString() },
  { key: 'avgPauseMs', label: 'Average pause', format: formatMs },
  {
    key: 'longPauseCount',
    label: 'Long pauses',
    format: (v) => Math.round(v).toString(),
  },
  { key: 'vocabDiversity', label: 'Vocabulary diversity', format: (v) => v.toFixed(2) },
  {
    key: 'sentenceLengthVariation',
    label: 'Sentence length variation',
    format: (v) => v.toFixed(2),
  },
]

/**
 * Shown right after a Part 2 practice run. There is no Claude scoring yet,
 * so this deliberately presents itself as objective speech stats, not a
 * band score — see the disclaimer panel below, which must stay visible
 * (not collapsed/dismissible) so it can't be missed or misread as an AI verdict.
 */
export function SummaryScreen({
  result,
  onRetry,
  onSaveAndExit,
  onDiscardAndExit,
}: SummaryScreenProps) {
  const { card, transcript, metrics, durationMs, transcriptionFailed } = result
  const hasTranscript = transcript.trim().length > 0

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-14">
        <header className="space-y-2">
          <Badge variant="secondary" className="gap-1">
            Part 2 practice summary
          </Badge>
          <h1 className="text-balance font-heading text-xl font-medium tracking-tight sm:text-2xl">
            {card.topic}
          </h1>
          <p className="text-sm text-muted-foreground">
            Speaking time used: {formatCountdown(durationMs / 1000)}
          </p>
        </header>

        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4"
        >
          <BadgeInfo className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-foreground/90">
            These are objective speech stats computed from your transcript — words per
            minute, fillers, pauses, vocabulary —{' '}
            <strong>not an official IELTS band score or AI feedback</strong>. Full scoring
            needs the Claude examiner, coming in a later update.
          </p>
        </div>

        <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Your transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              tabIndex={0}
              aria-label="Transcript of your answer"
              className="max-h-64 overflow-y-auto rounded-md border border-border/40 bg-background/40 p-3 text-sm leading-relaxed text-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {hasTranscript ? (
                <p className="whitespace-pre-wrap">{transcript}</p>
              ) : (
                <p className="text-muted-foreground italic">No speech was captured.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {transcriptionFailed ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center"
          >
            <MicOff className="size-6 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-destructive">Transcript unavailable</p>
            <p className="text-sm text-muted-foreground">
              We couldn't capture a transcript this time — check your microphone and try
              again.
            </p>
          </div>
        ) : (
          <section
            aria-label="Speech metrics"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {STAT_DEFS.map((def) => (
              <div
                key={def.key}
                className="rounded-lg border border-border/50 bg-card/60 p-3 backdrop-blur-xl"
              >
                <p className="text-xs text-muted-foreground">{def.label}</p>
                <p className="mt-1 font-heading text-xl font-medium tabular-nums text-foreground">
                  {def.format(metrics[def.key])}
                </p>
              </div>
            ))}
          </section>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onDiscardAndExit} className="gap-1.5">
            <Trash2 className="size-4" aria-hidden="true" />
            Discard
          </Button>
          <Button variant="secondary" onClick={onRetry} className="gap-1.5">
            <Repeat className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button onClick={onSaveAndExit} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            Save to history
          </Button>
        </div>
      </div>
    </main>
  )
}

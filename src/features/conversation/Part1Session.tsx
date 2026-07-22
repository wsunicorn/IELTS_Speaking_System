import { Ear, Loader2, Mic, MicOff, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { TTSStatus } from '@/features/speech/useHeadTTS'
import { useConversationSession } from './useConversationSession'

export interface Part1SessionProps {
  speak: (text: string) => void
  stopAllSpeech: () => void
  ttsStatus: TTSStatus
  onExit: () => void
}

const PHASE_COPY = {
  idle: { label: 'Ready', hint: 'Press Start to begin Part 1.', Icon: Mic },
  listening: { label: 'Listening', hint: 'Your turn — speak now.', Icon: Ear },
  thinking: { label: 'Thinking', hint: 'The examiner is preparing a reply...', Icon: Loader2 },
  speaking: { label: 'Examiner speaking', hint: '', Icon: Volume2 },
} as const

/**
 * Real Part 1 conversation loop: STT -> Gemini (streamed) -> progressive TTS,
 * driven by useConversationSession's XState machine. This is the first
 * screen where the examiner is actually a live model, not a local demo.
 */
export function Part1Session({ speak, stopAllSpeech, ttsStatus, onExit }: Part1SessionProps) {
  const session = useConversationSession({ part: 'part1', speak, stopAllSpeech, ttsStatus })
  const { label, hint, Icon } = PHASE_COPY[session.phase]
  const isActive = session.phase !== 'idle'

  return (
    <Card className="w-full max-w-lg border-border/50 bg-card/60 py-5 text-left backdrop-blur-xl">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={session.phase === 'listening' ? 'default' : 'secondary'} className="gap-1">
            <Icon
              className={`size-3 ${session.phase === 'thinking' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {label}
          </Badge>
        </div>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          tabIndex={0}
          aria-label="Conversation transcript"
          className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/40 p-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {session.turns.length === 0 && !session.pendingReply ? (
            <p className="text-muted-foreground italic">
              No conversation yet — the examiner will greet you once you press Start.
            </p>
          ) : (
            session.turns.map((turn, i) => (
              <p key={i} className={turn.role === 'examiner' ? 'text-foreground' : 'text-foreground/80'}>
                <span className="font-medium">{turn.role === 'examiner' ? 'Examiner: ' : 'You: '}</span>
                {turn.text}
              </p>
            ))
          )}
          {/* Live subtitle while the examiner is thinking/speaking — turns[]
              only gets this once the whole reply finishes, which would
              otherwise leave the transcript blank for the entire speaking phase. */}
          {session.pendingReply && (
            <p className="text-foreground">
              <span className="font-medium">Examiner: </span>
              {session.pendingReply}
              {session.phase === 'speaking' && (
                <span className="ml-1 inline-block animate-pulse text-muted-foreground">▍</span>
              )}
            </p>
          )}
        </div>

        {session.error && (
          <p role="alert" className="text-sm text-destructive">
            {session.error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {!isActive ? (
            <Button onClick={session.start} className="gap-1.5">
              <Mic className="size-4" aria-hidden="true" />
              Start Part 1
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                session.stop()
              }}
              className="gap-1.5"
            >
              <MicOff className="size-4" aria-hidden="true" />
              End session
            </Button>
          )}
          <Button variant="outline" onClick={onExit}>
            Back to home
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

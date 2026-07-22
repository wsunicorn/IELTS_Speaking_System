import { lazy, Suspense, useState } from 'react'
import { useHeadTTS } from '@/features/speech/useHeadTTS'
import { HomeScreen } from '@/features/conversation/HomeScreen'
import { Part2Session, type Part2SessionResult } from '@/features/conversation/Part2Session'
import { SummaryScreen } from '@/features/conversation/SummaryScreen'
import { DEMO_CUE_CARDS } from '@/features/conversation/demoCueCards'
import { HistoryScreen } from '@/features/session-history/HistoryScreen'
import { db } from '@/lib/db'
import type { Session } from '@/types/session'

const AvatarScene = lazy(() =>
  import('@/features/avatar/AvatarScene').then((m) => ({ default: m.AvatarScene })),
)

type Screen = 'home' | 'part2-session' | 'part2-summary' | 'history'

function App() {
  const { activeSpeechRef } = useHeadTTS()

  const [screen, setScreen] = useState<Screen>('home')
  const [cardIndex, setCardIndex] = useState(0)
  const [lastResult, setLastResult] = useState<Part2SessionResult | null>(null)

  const activeCard = DEMO_CUE_CARDS[cardIndex % DEMO_CUE_CARDS.length]

  const handleSessionComplete = (result: Part2SessionResult) => {
    setLastResult(result)
    setScreen('part2-summary')
  }

  const handleRetry = () => {
    setCardIndex((i) => i + 1)
    setLastResult(null)
    setScreen('part2-session')
  }

  const handleSaveAndExit = async () => {
    if (lastResult) {
      const session: Session = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        mode: 'part2',
        topic: lastResult.card.topic,
        turns: [
          {
            role: 'candidate',
            text: lastResult.transcript,
            tStart: 0,
            tEnd: lastResult.durationMs,
          },
        ],
        metrics: lastResult.metrics,
      }
      await db.sessions.add(session)
    }
    setLastResult(null)
    setScreen('home')
  }

  const handleDiscardAndExit = () => {
    setLastResult(null)
    setScreen('home')
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        onStartPart2Practice={() => setScreen('part2-session')}
        onViewHistory={() => setScreen('history')}
      />
    )
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'part2-summary' && lastResult) {
    return (
      <SummaryScreen
        result={lastResult}
        onRetry={handleRetry}
        onSaveAndExit={() => void handleSaveAndExit()}
        onDiscardAndExit={handleDiscardAndExit}
      />
    )
  }

  // screen === 'part2-session'
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Layer 1 — background (audio-reactive shader lands here in a later phase) */}
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      {/* Layer 2 — avatar canvas (idle presence; no examiner speech until Phase 4) */}
      <Suspense fallback={null}>
        <AvatarScene activeSpeechRef={activeSpeechRef} />
      </Suspense>

      {/* Layer 3 — DOM UI overlay */}
      <div className="relative flex min-h-screen flex-col items-center justify-end gap-4 px-6 pb-16">
        <Part2Session card={activeCard} onSessionComplete={handleSessionComplete} />
      </div>
    </main>
  )
}

export default App

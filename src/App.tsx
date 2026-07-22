import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CueCard } from '@/features/conversation/CueCard'
import { DEMO_CUE_CARDS } from '@/features/conversation/demoCueCards'
import { useHeadTTS } from '@/features/speech/useHeadTTS'
import { useSpeechToText } from '@/features/speech/useSpeechToText'

const AvatarScene = lazy(() =>
  import('@/features/avatar/AvatarScene').then((m) => ({ default: m.AvatarScene })),
)

const DEMO_SENTENCE =
  "Good morning, my name is Claude, and I'll be your examiner today."

function App() {
  const { status, error, loadProgress, speak, activeSpeechRef } = useHeadTTS()
  const stt = useSpeechToText('moonshine')

  // TEMPORARY demo toggle for Part 2 cue card UI — remove once wired into the
  // real session flow. `demoRunId` remounts CueCard to restart its timers.
  const [showCueCardDemo, setShowCueCardDemo] = useState(false)
  const [demoRunId, setDemoRunId] = useState(0)

  const isBusy = status === 'loading' || status === 'speaking'
  const isListening = stt.status !== 'idle' && stt.status !== 'error'

  let statusText = 'Bấm nút để nghe giám khảo nói (Phase 2 demo).'
  if (status === 'loading') {
    statusText =
      loadProgress !== null
        ? `Đang tải model giọng nói lần đầu... ${loadProgress}%`
        : 'Đang tải model giọng nói lần đầu...'
  } else if (status === 'speaking') {
    statusText = 'Giám khảo đang nói...'
  } else if (status === 'error') {
    statusText = `Lỗi: ${error}`
  }

  let sttStatusText = 'Bấm nút để tự luyện nói (Phase 3 demo).'
  if (stt.status === 'loading') sttStatusText = 'Đang tải model nhận diện giọng nói lần đầu...'
  else if (stt.status === 'ready') sttStatusText = 'Sẵn sàng — mời bạn nói.'
  else if (stt.status === 'recording') sttStatusText = 'Đang nghe bạn nói...'
  else if (stt.status === 'transcribing') sttStatusText = 'Đang nhận diện...'
  else if (stt.status === 'error') sttStatusText = `Lỗi: ${stt.error}`

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Layer 1 — background (audio-reactive shader lands here in a later phase) */}
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      {/* Layer 2 — avatar canvas */}
      <Suspense fallback={null}>
        <AvatarScene activeSpeechRef={activeSpeechRef} />
      </Suspense>

      {/* Layer 3 — DOM UI overlay */}
      <div className="relative flex min-h-screen flex-col items-center justify-end gap-4 pb-16 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          IELTS Speaking AI Examiner
        </h1>

        <p className="text-muted-foreground">{statusText}</p>
        <Button disabled={isBusy} onClick={() => speak(DEMO_SENTENCE)}>
          Nghe giám khảo nói
        </Button>

        <p className="mt-4 text-muted-foreground">{sttStatusText}</p>
        <Button
          variant={isListening ? 'destructive' : 'default'}
          onClick={() => (isListening ? stt.stop() : stt.start())}
        >
          {isListening ? 'Dừng nghe' : 'Bắt đầu nói'}
        </Button>

        {stt.segments.length > 0 && (
          <div className="max-w-lg space-y-1 text-sm text-foreground/90">
            {stt.segments.map((segment, i) => (
              <p key={i}>{segment.text}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3 border-t border-border/50 pt-6">
          <p className="text-xs text-muted-foreground">
            Demo tạm thời — Part 2 cue card (durations rút ngắn để xem nhanh, bản thật là 60s/120s)
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setDemoRunId((id) => id + 1)
              setShowCueCardDemo(true)
            }}
          >
            {showCueCardDemo ? 'Restart cue card demo' : 'Show cue card demo'}
          </Button>
          {showCueCardDemo && (
            <CueCard
              key={demoRunId}
              card={DEMO_CUE_CARDS[0]}
              prepSeconds={8}
              speakingSeconds={12}
              onComplete={() => console.log('[CueCard demo] speaking time complete')}
            />
          )}
        </div>
      </div>
    </main>
  )
}

export default App

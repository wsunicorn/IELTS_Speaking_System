import { lazy, Suspense } from 'react'

const AvatarScene = lazy(() =>
  import('@/features/avatar/AvatarScene').then((m) => ({ default: m.AvatarScene })),
)

function App() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Layer 1 — background (audio-reactive shader lands here in a later phase) */}
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      {/* Layer 2 — avatar canvas */}
      <Suspense fallback={null}>
        <AvatarScene />
      </Suspense>

      {/* Layer 3 — DOM UI overlay */}
      <div className="relative flex min-h-screen flex-col items-center justify-end pb-16 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          IELTS Speaking AI Examiner
        </h1>
        <p className="mt-2 text-muted-foreground">
          Phase 1 — avatar tĩnh sẵn sàng. TTS/STT sẽ được thêm ở các phase tiếp theo.
        </p>
      </div>
    </main>
  )
}

export default App

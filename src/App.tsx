import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-3xl font-medium tracking-tight">
          IELTS Speaking AI Examiner
        </h1>
        <p className="mt-2 text-muted-foreground">
          Phase 0 scaffold ready — avatar 3D, TTS, STT sẽ được thêm ở các phase tiếp theo.
        </p>
        <Button className="mt-6">Bắt đầu luyện tập</Button>
      </div>
    </main>
  )
}

export default App

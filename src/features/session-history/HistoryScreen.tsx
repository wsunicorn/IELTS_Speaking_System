import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import type { Session } from '@/types/session'

export interface HistoryScreenProps {
  onBack: () => void
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MODE_LABEL: Record<Session['mode'], string> = {
  part1: 'Part 1',
  part2: 'Part 2',
  part3: 'Part 3',
  full: 'Full mock test',
  freetalk: 'Free talk',
}

/** Local-first practice history (IndexedDB via Dexie) — see plan section 7/8. */
export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const [sessions, setSessions] = useState<Session[] | null>(null)

  useEffect(() => {
    let cancelled = false
    db.sessions
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then((rows) => {
        if (!cancelled) setSessions(rows)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleDelete = async (id: string) => {
    await db.sessions.delete(id)
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? prev)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-14">
        <header className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <h1 className="text-xl font-medium tracking-tight">Practice history</h1>
        </header>

        {sessions === null && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {sessions !== null && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No practice sessions saved yet — finish a Part 2 practice and choose "Save to
            history" to see it here.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {sessions?.map((session) => (
            <Card key={session.id} className="border-border/50 bg-card/60 backdrop-blur-xl">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{MODE_LABEL[session.mode]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(session.createdAt)}
                    </span>
                  </div>
                  <CardTitle className="text-base font-medium">{session.topic}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete session"
                  onClick={() => void handleDelete(session.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">WPM</dt>
                    <dd className="tabular-nums">
                      {Math.round(session.metrics.wordsPerMinute)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fillers</dt>
                    <dd className="tabular-nums">{session.metrics.fillerCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Vocab diversity</dt>
                    <dd className="tabular-nums">
                      {session.metrics.vocabDiversity.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  History,
  Lock,
  MessageSquare,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface HomeScreenProps {
  onStartPart2Practice: () => void
  onViewHistory: () => void
}

interface ModeDefinition {
  id: string
  title: string
  tagline: string
  description: string
  icon: LucideIcon
  available: boolean
}

/**
 * Copy sourced from IELTS_Speaking_AI_Plan.md section 4.1 (test structure)
 * and section 5 (feature list) so part descriptions match the real exam
 * format even though only Part 2 is wired up yet.
 */
const MODES: ModeDefinition[] = [
  {
    id: 'part1',
    title: 'Part 1',
    tagline: 'Introduction & familiar topics',
    description:
      'A 4–5 minute warm-up: the examiner asks short questions about yourself and everyday topics.',
    icon: MessageSquare,
    available: false,
  },
  {
    id: 'part2',
    title: 'Part 2',
    tagline: 'Cue card',
    description:
      "1 minute to prepare, then speak for up to 2 minutes on a cue card topic. You'll get objective speech stats — words per minute, filler words, pauses, vocabulary — computed from your own recording.",
    icon: BookOpen,
    available: true,
  },
  {
    id: 'part3',
    title: 'Part 3',
    tagline: 'Two-way discussion',
    description:
      'A 4–5 minute deeper discussion of abstract ideas connected to your Part 2 topic.',
    icon: Users,
    available: false,
  },
  {
    id: 'full',
    title: 'Full mock test',
    tagline: 'Part 1 → 2 → 3',
    description: 'The complete IELTS Speaking test, run back to back in one sitting.',
    icon: GraduationCap,
    available: false,
  },
  {
    id: 'freetalk',
    title: 'Free talk',
    tagline: 'Open conversation',
    description:
      'Chat freely with the examiner to build confidence, with no scoring at all.',
    icon: Sparkles,
    available: false,
  },
]

interface ModeCardProps {
  mode: ModeDefinition
  onSelect?: () => void
}

function ModeCard({ mode, onSelect }: ModeCardProps) {
  const Icon = mode.icon

  if (!mode.available) {
    return (
      <div
        aria-disabled="true"
        className="flex h-full flex-col gap-3 rounded-xl border border-border/50 bg-card/40 p-5 text-left opacity-60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Coming soon
          </Badge>
        </div>
        <div>
          <h3 className="font-heading text-base font-medium text-foreground/80">
            {mode.title}
          </h3>
          <p className="text-xs text-muted-foreground">{mode.tagline}</p>
        </div>
        <p className="text-sm text-muted-foreground">{mode.description}</p>
        <p className="mt-auto text-xs text-muted-foreground/80">
          Coming soon — needs the Claude conversation loop.
        </p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-xl border border-primary/40 bg-card/60 p-5 text-left backdrop-blur-xl',
        'outline-none transition-colors hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <Badge className="gap-1">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Available now
        </Badge>
      </div>
      <div>
        <h3 className="font-heading text-base font-medium text-foreground">
          {mode.title}
        </h3>
        <p className="text-xs text-muted-foreground">{mode.tagline}</p>
      </div>
      <p className="text-sm text-foreground/90">{mode.description}</p>
      <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
        Start practicing
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </button>
  )
}

/**
 * Mode-selection entry screen. Only Part 2 is wired to a real practice loop
 * (on-device STT + computed metrics) — everything else needs the Claude
 * conversation loop, which is on hold pending API credentials, so those
 * cards are shown but deliberately inert rather than hidden.
 */
export function HomeScreen({ onStartPart2Practice, onViewHistory }: HomeScreenProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-linear-to-b from-background to-[#0a0c14]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-14">
        <header className="space-y-2 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
            IELTS Speaking AI Examiner
          </h1>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            Choose a practice mode. Part 2 is ready to try now — the rest of the test
            unlocks once the AI conversation loop is connected.
          </p>
        </header>

        <section
          aria-label="Practice modes"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {MODES.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              onSelect={mode.id === 'part2' ? onStartPart2Practice : undefined}
            />
          ))}
        </section>

        <section className="mt-auto flex justify-center border-t border-border/50 pt-6">
          <button
            type="button"
            onClick={onViewHistory}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-4 py-2.5 text-sm font-medium text-foreground/90',
              'outline-none transition-colors hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50',
            )}
          >
            <History className="size-4" aria-hidden="true" />
            Practice history
          </button>
        </section>
      </div>
    </main>
  )
}

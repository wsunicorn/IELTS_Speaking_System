import type { ScoreResult } from '@/features/scoring/scoreSchema'

export type SessionMode = 'part1' | 'part2' | 'part3' | 'full' | 'freetalk'

export interface Turn {
  role: 'examiner' | 'candidate'
  text: string
  tStart: number
  tEnd: number
}

/** Client-computed metrics fed to Claude as scoring evidence — see ielts-rubric skill. */
export interface Metrics {
  wordsPerMinute: number
  fillerCount: number
  avgPauseMs: number
  longPauseCount: number
  vocabDiversity: number
  sentenceLengthVariation: number
}

export interface Session {
  id: string
  createdAt: number
  mode: SessionMode
  topic: string
  turns: Turn[]
  metrics: Metrics
  score?: ScoreResult
  audioBlobRefs?: string[]
}

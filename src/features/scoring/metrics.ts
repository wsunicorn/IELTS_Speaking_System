import type { Metrics } from '@/types/session'

export interface WordTiming {
  text: string
  startMs: number
  endMs: number
}

const FILLER_WORDS = new Set([
  'um',
  'umm',
  'uh',
  'uhh',
  'erm',
  'er',
  'like',
  'basically',
  'actually',
  'literally',
])
const FILLER_PHRASES = ['you know', 'sort of', 'kind of', 'i mean']

const LONG_PAUSE_THRESHOLD_MS = 1000

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '')
}

export function calculateWordsPerMinute(words: WordTiming[], durationMs: number): number {
  if (durationMs <= 0 || words.length === 0) return 0
  return (words.length / durationMs) * 60_000
}

export function countFillers(words: WordTiming[]): number {
  if (words.length === 0) return 0

  const normalized = words.map((w) => normalizeWord(w.text))
  let count = normalized.filter((w) => FILLER_WORDS.has(w)).length

  const joined = normalized.join(' ')
  for (const phrase of FILLER_PHRASES) {
    const matches = joined.match(new RegExp(`\\b${phrase}\\b`, 'g'))
    count += matches?.length ?? 0
  }

  return count
}

export function calculatePauses(words: WordTiming[]): {
  avgPauseMs: number
  longPauseCount: number
} {
  if (words.length < 2) return { avgPauseMs: 0, longPauseCount: 0 }

  const gaps: number[] = []
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startMs - words[i - 1].endMs
    if (gap > 0) gaps.push(gap)
  }

  if (gaps.length === 0) return { avgPauseMs: 0, longPauseCount: 0 }

  const avgPauseMs = gaps.reduce((sum, g) => sum + g, 0) / gaps.length
  const longPauseCount = gaps.filter((g) => g >= LONG_PAUSE_THRESHOLD_MS).length

  return { avgPauseMs, longPauseCount }
}

export function calculateVocabDiversity(words: WordTiming[]): number {
  const normalized = words.map((w) => normalizeWord(w.text)).filter((w) => w.length > 0)
  if (normalized.length === 0) return 0

  const uniqueCount = new Set(normalized).size
  return uniqueCount / normalized.length
}

export function calculateSentenceLengthVariation(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length < 2) return 0

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  const mean = lengths.reduce((sum, l) => sum + l, 0) / lengths.length
  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length

  return Math.sqrt(variance)
}

/** Combines every metric into the shape sent to Claude as scoring evidence. */
export function computeMetrics(words: WordTiming[], text: string, durationMs: number): Metrics {
  const { avgPauseMs, longPauseCount } = calculatePauses(words)

  return {
    wordsPerMinute: calculateWordsPerMinute(words, durationMs),
    fillerCount: countFillers(words),
    avgPauseMs,
    longPauseCount,
    vocabDiversity: calculateVocabDiversity(words),
    sentenceLengthVariation: calculateSentenceLengthVariation(text),
  }
}

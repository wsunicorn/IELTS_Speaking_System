import type { TranscriptSegment } from '@/features/speech/sttTypes'
import type { WordTiming } from './metrics'

/**
 * Our STT worker only returns segment-level timestamps (one per VAD-detected
 * speech chunk), not real per-word timestamps. Words within a segment are
 * evenly spread across its [start, end] window — an approximation for
 * within-segment timing — but the silence *between* segments is real (VAD
 * only splits on actual pauses), so pause metrics computed from this are
 * meaningful, not just intra-segment ones.
 */
export function segmentsToWordTimings(segments: TranscriptSegment[]): WordTiming[] {
  const result: WordTiming[] = []

  for (const segment of segments) {
    const words = segment.text.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    const duration = Math.max(0, segment.end - segment.start)
    const perWordMs = duration / words.length

    words.forEach((word, i) => {
      const startMs = segment.start + i * perWordMs
      result.push({ text: word, startMs, endMs: startMs + perWordMs })
    })
  }

  return result
}

import { describe, expect, it } from 'vitest'
import {
  calculatePauses,
  calculateSentenceLengthVariation,
  calculateVocabDiversity,
  calculateWordsPerMinute,
  computeMetrics,
  countFillers,
  type WordTiming,
} from './metrics'

/**
 * Builds a WordTiming[] from a list of tokens and the gaps (ms) between
 * consecutive words. `gapsMs[i]` is the silence between token[i] and
 * token[i + 1]. Each word is given a fixed speaking duration so that
 * every timestamp — and therefore every gap fed into calculatePauses —
 * is exactly what the test author specified, not something derived by
 * hand-adding cumulative offsets (which is where transcription errors
 * creep in).
 */
function wordsFromGaps(tokens: string[], gapsMs: number[], wordDurationMs = 300): WordTiming[] {
  const words: WordTiming[] = []
  let cursor = 0
  for (let i = 0; i < tokens.length; i++) {
    const startMs = cursor
    const endMs = startMs + wordDurationMs
    words.push({ text: tokens[i], startMs, endMs })
    cursor = endMs + (gapsMs[i] ?? 0)
  }
  return words
}

describe('calculateWordsPerMinute', () => {
  it('computes (words / durationMs) * 60_000 for a normal answer', () => {
    // 10 words spoken over 30s -> 20 words/minute
    const words: WordTiming[] = Array.from({ length: 10 }, (_, i) => ({
      text: `word${i}`,
      startMs: i * 3000,
      endMs: i * 3000 + 500,
    }))
    expect(calculateWordsPerMinute(words, 30_000)).toBe(20)
  })

  it('returns 0 for an empty transcript even with a positive duration', () => {
    expect(calculateWordsPerMinute([], 30_000)).toBe(0)
  })

  it('returns 0 when durationMs is 0', () => {
    const words: WordTiming[] = [{ text: 'hello', startMs: 0, endMs: 300 }]
    expect(calculateWordsPerMinute(words, 0)).toBe(0)
  })

  it('returns 0 when durationMs is negative', () => {
    const words: WordTiming[] = [{ text: 'hello', startMs: 0, endMs: 300 }]
    expect(calculateWordsPerMinute(words, -500)).toBe(0)
  })

  it('handles a single word', () => {
    // 1 word over 2s -> (1/2000) * 60000 = 30 wpm
    const words: WordTiming[] = [{ text: 'yes', startMs: 0, endMs: 400 }]
    expect(calculateWordsPerMinute(words, 2000)).toBe(30)
  })
})

describe('countFillers', () => {
  it('returns 0 for an empty transcript', () => {
    expect(countFillers([])).toBe(0)
  })

  it('returns 0 when there are no fillers', () => {
    const tokens = ['I', 'enjoy', 'reading', 'books', 'every', 'weekend']
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    expect(countFillers(words)).toBe(0)
  })

  it('counts every word when the whole transcript is fillers', () => {
    // um, uh, erm, like, basically, actually, literally are all in FILLER_WORDS
    const tokens = ['um', 'uh', 'erm', 'like', 'basically', 'actually', 'literally']
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    expect(countFillers(words)).toBe(7)
  })

  it('counts filler words and filler phrases together, case-insensitively and punctuation-stripped', () => {
    // Candidate answer about hobbies with 2 filler *words* ("um", "like") and
    // 1 filler *phrase* ("kind of") plus 1 more ("i mean"):
    // normalized: um i really like traveling actually... wait see below
    const tokens = [
      'Um,',
      'I',
      'really',
      'LIKE',
      'traveling,',
      'actually.', // filler word #3 ("actually")
      'Um', // filler word #4 (2nd "um")
      'I',
      'mean',
      'it',
      'was',
      'kind',
      'of',
      'amazing.',
    ]
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    // Word-level matches: "um" (Um,), "like" (LIKE), "actually" (actually.), "um" (Um) = 4
    // Phrase matches: "i mean" (I mean) = 1, "kind of" (kind of) = 1
    // Total = 4 + 2 = 6
    expect(countFillers(words)).toBe(6)
  })

  it('detects a filler phrase split across punctuation-bearing tokens', () => {
    const tokens = ['You,', 'know,', 'I', 'think', "it's", 'sort', 'of', 'difficult']
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    // "you know" (1) + "sort of" (1) = 2; none of the individual words are
    // themselves in FILLER_WORDS
    expect(countFillers(words)).toBe(2)
  })
})

describe('calculatePauses', () => {
  it('returns {0, 0} for an empty transcript', () => {
    expect(calculatePauses([])).toEqual({ avgPauseMs: 0, longPauseCount: 0 })
  })

  it('returns {0, 0} for a single word (no gaps possible)', () => {
    const words: WordTiming[] = [{ text: 'hello', startMs: 0, endMs: 300 }]
    expect(calculatePauses(words)).toEqual({ avgPauseMs: 0, longPauseCount: 0 })
  })

  it('returns {0, 0} when words are back-to-back or overlapping (no positive gaps)', () => {
    const words: WordTiming[] = [
      { text: 'a', startMs: 0, endMs: 300 },
      { text: 'b', startMs: 300, endMs: 600 }, // gap = 0
      { text: 'c', startMs: 550, endMs: 900 }, // gap = -50 (overlap)
    ]
    expect(calculatePauses(words)).toEqual({ avgPauseMs: 0, longPauseCount: 0 })
  })

  it('computes avgPauseMs and longPauseCount (>= 1000ms) from real gaps', () => {
    const tokens = ['I', 'went', 'to', 'Da', 'Nang']
    // gaps between the 5 tokens: 200, 1500, 800, 1200
    const words = wordsFromGaps(tokens, [200, 1500, 800, 1200])
    // avg = (200 + 1500 + 800 + 1200) / 4 = 3700 / 4 = 925
    // long pauses (>= 1000): 1500 and 1200 -> 2
    const result = calculatePauses(words)
    expect(result.avgPauseMs).toBe(925)
    expect(result.longPauseCount).toBe(2)
  })

  it('treats a gap of exactly 1000ms as a long pause (boundary)', () => {
    const words = wordsFromGaps(['pause', 'here'], [1000])
    expect(calculatePauses(words)).toEqual({ avgPauseMs: 1000, longPauseCount: 1 })
  })

  it('does not count a 999ms gap as a long pause', () => {
    const words = wordsFromGaps(['almost', 'there'], [999])
    expect(calculatePauses(words)).toEqual({ avgPauseMs: 999, longPauseCount: 0 })
  })
})

describe('calculateVocabDiversity', () => {
  it('returns 0 for an empty transcript', () => {
    expect(calculateVocabDiversity([])).toBe(0)
  })

  it('returns 1 when every word is unique', () => {
    const tokens = ['I', 'love', 'travelling', 'to', 'new', 'places']
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    expect(calculateVocabDiversity(words)).toBe(1)
  })

  it('computes the type-token ratio with repeated words', () => {
    const tokens = ['I', 'really', 'really', 'like', 'like', 'like', 'traveling']
    const words = wordsFromGaps(tokens, tokens.map(() => 50))
    // unique: I, really, like, traveling = 4 ; total = 7
    expect(calculateVocabDiversity(words)).toBeCloseTo(4 / 7, 10)
  })

  it('is case-insensitive', () => {
    const words = wordsFromGaps(['I', 'i', 'I'], [50, 50])
    // all normalize to "i" -> 1 unique / 3 total
    expect(calculateVocabDiversity(words)).toBeCloseTo(1 / 3, 10)
  })

  it('strips punctuation before comparing words', () => {
    const words = wordsFromGaps(['dog', 'dog,', 'dog.'], [50, 50])
    expect(calculateVocabDiversity(words)).toBeCloseTo(1 / 3, 10)
  })

  it('ignores tokens that normalize to an empty string (pure punctuation)', () => {
    const words = wordsFromGaps(['um', '...', 'uh'], [50, 50])
    // "..." strips down to "" and is filtered out entirely -> 2 unique / 2 total
    expect(calculateVocabDiversity(words)).toBe(1)
  })
})

describe('calculateSentenceLengthVariation', () => {
  it('returns 0 for an empty transcript', () => {
    expect(calculateSentenceLengthVariation('')).toBe(0)
  })

  it('returns 0 for a single sentence with no terminal punctuation', () => {
    expect(calculateSentenceLengthVariation('I like traveling')).toBe(0)
  })

  it('returns 0 for a single sentence with terminal punctuation', () => {
    expect(calculateSentenceLengthVariation('I like traveling.')).toBe(0)
  })

  it('computes the population standard deviation of words-per-sentence for two sentences', () => {
    // S1: "I like cats" -> 3 words
    // S2: "My favorite hobby is reading books every single weekend without fail" -> 11 words
    // mean = (3 + 11) / 2 = 7
    // variance = ((3-7)^2 + (11-7)^2) / 2 = (16 + 16) / 2 = 16
    // stdDev = sqrt(16) = 4
    const text =
      'I like cats. My favorite hobby is reading books every single weekend without fail.'
    expect(calculateSentenceLengthVariation(text)).toBe(4)
  })

  it('computes variation across three sentences of differing length', () => {
    // S1: "Um I really like traveling" -> 5 words
    // S2: "Last year I went to Da Nang with my family and it was amazing" -> 14 words
    // S3: "We visited the beach every morning and, you know, tried some local food" -> 13 words
    // mean = (5 + 14 + 13) / 3 = 32/3
    // variance = ((5-32/3)^2 + (14-32/3)^2 + (13-32/3)^2) / 3
    //          = ((-17/3)^2 + (10/3)^2 + (7/3)^2) / 3
    //          = ((289 + 100 + 49) / 9) / 3 = (438/9)/3 = 438/27 = 16.2222...
    // stdDev = sqrt(16.2222...) = 4.02768...
    const text =
      'Um, I really like traveling. Last year I went to Da Nang with my family and it was amazing. We visited the beach every morning and, you know, tried some local food.'
    expect(calculateSentenceLengthVariation(text)).toBeCloseTo(4.0277, 3)
  })

  it('collapses runs of terminal punctuation (e.g. "!!!" / "???") into one split point', () => {
    // S1: "Hello" -> 1 word ; S2: "How are you" -> 3 words
    // mean = 2 ; variance = ((1-2)^2 + (3-2)^2)/2 = 1 ; stdDev = 1
    expect(calculateSentenceLengthVariation('Hello!!! How are you???')).toBe(1)
  })
})

describe('computeMetrics', () => {
  it('combines all metrics for a realistic hobbies/travel answer with fillers and pauses', () => {
    const tokens = [
      'Um,', // 1  filler word "um"
      'I', // 2
      'really', // 3
      'like', // 4  filler word "like"
      'traveling.', // 5
      'Last', // 6
      'year', // 7
      'I', // 8  (dup of "I")
      'went', // 9
      'to', // 10
      'Da', // 11
      'Nang', // 12
      'with', // 13
      'my', // 14
      'family', // 15
      'and', // 16
      'it', // 17
      'was', // 18
      'amazing.', // 19
      'We', // 20
      'visited', // 21
      'the', // 22
      'beach', // 23
      'every', // 24
      'morning', // 25
      'and,', // 26 (dup of "and")
      'you', // 27  filler phrase "you know" starts
      'know,', // 28  filler phrase "you know" ends
      'tried', // 29
      'some', // 30
      'local', // 31
      'food.', // 32
    ]
    expect(tokens).toHaveLength(32)

    // gaps[i] is the silence after tokens[i]; index 4 (after "traveling.") = 600ms
    // (a natural but unremarkable pause), index 18 (after "amazing.") = 1400ms
    // (long pause), index 25 (after "and,") = 1100ms (long pause, hesitation
    // before the filler phrase). All other 28 gaps are 80ms.
    const gaps = new Array(31).fill(80)
    gaps[4] = 600
    gaps[18] = 1400
    gaps[25] = 1100

    const words = wordsFromGaps(tokens, gaps, 300)
    const text =
      'Um, I really like traveling. Last year I went to Da Nang with my family and it was amazing. We visited the beach every morning and, you know, tried some local food.'

    // durationMs = last word's endMs - first word's startMs (first starts at 0)
    const durationMs = words[words.length - 1].endMs
    // 32 * 300ms speaking time + sum(gaps) = 9600 + (28*80 + 600 + 1400 + 1100)
    //                                       = 9600 + (2240 + 3100) = 9600 + 5340 = 14940
    expect(durationMs).toBe(14940)

    const metrics = computeMetrics(words, text, durationMs)

    // wpm = (32 / 14940) * 60000 = 128.5140562...
    expect(metrics.wordsPerMinute).toBeCloseTo(128.514, 3)
    // filler words: "um", "like" ; filler phrases: "you know" -> 3 total
    expect(metrics.fillerCount).toBe(3)
    // avg of the 31 gaps = 5340 / 31 = 172.258...
    expect(metrics.avgPauseMs).toBeCloseTo(172.258, 3)
    // long pauses (>= 1000ms): 1400 and 1100 -> 2
    expect(metrics.longPauseCount).toBe(2)
    // unique words: "I" and "and" each repeat once -> 30 unique / 32 total
    expect(metrics.vocabDiversity).toBeCloseTo(30 / 32, 10)
    // three sentences of 5, 14, 13 words -> stdDev ~= 4.0277 (see dedicated test above)
    expect(metrics.sentenceLengthVariation).toBeCloseTo(4.0277, 3)
  })

  it('returns all-zero metrics for a completely empty transcript', () => {
    const metrics = computeMetrics([], '', 0)
    expect(metrics).toEqual({
      wordsPerMinute: 0,
      fillerCount: 0,
      avgPauseMs: 0,
      longPauseCount: 0,
      vocabDiversity: 0,
      sentenceLengthVariation: 0,
    })
  })

  it('handles a single-word answer with no pauses and no sentence punctuation', () => {
    const words: WordTiming[] = [{ text: 'Yes.', startMs: 0, endMs: 400 }]
    const metrics = computeMetrics(words, 'Yes.', 400)
    expect(metrics.wordsPerMinute).toBe(150) // (1/400)*60000
    expect(metrics.fillerCount).toBe(0)
    expect(metrics.avgPauseMs).toBe(0)
    expect(metrics.longPauseCount).toBe(0)
    expect(metrics.vocabDiversity).toBe(1)
    expect(metrics.sentenceLengthVariation).toBe(0) // single sentence
  })
})

import { describe, expect, it } from 'vitest'
import { parseScoreResult, scoreResultSchema, type ScoreResult } from './scoreSchema'

/** A well-formed scoring response matching IELTS_Speaking_AI_Plan.md section 4.5 exactly. */
function validScoreResult(): ScoreResult {
  return {
    overall_band: 6.5,
    criteria: {
      fluency_coherence: {
        band: 6,
        evidence:
          "Speaks at a reasonable pace (118 wpm) but relies on frequent fillers like 'um' and 'you know', causing some hesitation between ideas.",
        issues: ['Frequent use of fillers', 'Occasional long pauses before answering'],
        tips: [
          'Practice speaking in longer, unbroken stretches',
          'Replace fillers with a brief silent pause instead',
        ],
      },
      lexical_resource: {
        band: 7,
        evidence:
          "Uses a reasonably wide range of vocabulary related to travel and hobbies, including less common items like 'breathtaking'.",
        issues: ["Some repetition of basic vocabulary such as 'nice' and 'good'"],
        tips: [
          'Learn topic-specific collocations for travel',
          'Practice paraphrasing simple adjectives',
        ],
      },
      grammatical_range_accuracy: {
        band: 6,
        evidence:
          'Uses a mix of simple and complex sentences with generally accurate grammar, though some tense errors occur.',
        issues: ['Inconsistent use of past tense', 'Occasional subject-verb agreement errors'],
        tips: [
          'Review past simple vs present perfect usage',
          'Practice self-correcting mid-sentence when speaking',
        ],
      },
      pronunciation: {
        band: 6,
        note: 'approx from transcript+audio',
        issues: ['Some word stress errors on multi-syllable words'],
        tips: [
          'Practice word stress patterns on topic vocabulary',
          'Record and compare with native speaker samples',
        ],
      },
    },
    metrics: {
      words_per_minute: 118,
      filler_count: 9,
      avg_pause_ms: 850,
      vocab_diversity: 0.42,
    },
    corrections: [
      {
        original: 'I have went to Da Nang last year',
        corrected: 'I went to Da Nang last year',
        explanation:
          "Use the simple past 'went' rather than the present perfect construction 'have went', which is also grammatically incorrect.",
      },
    ],
    vocabulary_upgrades: [
      {
        used: 'good',
        upgrade: 'compelling',
        example: 'The scenery was compelling, especially at sunrise.',
      },
    ],
    model_answer:
      'One of my favourite hobbies is travelling, particularly to coastal cities where I can relax on the beach and try local food.',
    actionable_next_steps: [
      'Reduce filler word usage by pausing silently instead',
      'Expand topic vocabulary for travel and hobbies',
    ],
  }
}

describe('scoreResultSchema / parseScoreResult — well-formed input', () => {
  it('parses a well-formed scoring response and preserves all fields', () => {
    const fixture = validScoreResult()
    const result = parseScoreResult(JSON.stringify(fixture))
    expect(result).toEqual(fixture)
  })

  it('accepts overall_band and criterion bands at the lower boundary (0)', () => {
    const fixture = validScoreResult()
    fixture.overall_band = 0
    fixture.criteria.fluency_coherence.band = 0
    fixture.criteria.pronunciation.band = 0
    expect(() => parseScoreResult(JSON.stringify(fixture))).not.toThrow()
  })

  it('accepts overall_band and criterion bands at the upper boundary (9)', () => {
    const fixture = validScoreResult()
    fixture.overall_band = 9
    fixture.criteria.lexical_resource.band = 9
    fixture.criteria.pronunciation.band = 9
    expect(() => parseScoreResult(JSON.stringify(fixture))).not.toThrow()
  })

  it('strips unknown top-level keys rather than rejecting them (default zod object behavior)', () => {
    const withExtra = { ...validScoreResult(), unexpected_field: 'should be dropped' }
    const result = parseScoreResult(JSON.stringify(withExtra))
    expect(result).not.toHaveProperty('unexpected_field')
    expect(result).toEqual(validScoreResult())
  })
})

describe('parseScoreResult — invalid JSON', () => {
  it('throws a descriptive error for syntactically invalid JSON', () => {
    expect(() => parseScoreResult('{ this is not json')).toThrow(/not valid JSON/i)
  })

  it('throws for an empty string', () => {
    expect(() => parseScoreResult('')).toThrow(/not valid JSON/i)
  })

  it('throws for markdown-fenced JSON instead of silently stripping the fence', () => {
    const fenced = '```json\n' + JSON.stringify(validScoreResult()) + '\n```'
    expect(() => parseScoreResult(fenced)).toThrow(/not valid JSON/i)
  })

  it('throws for a response with a conversational preamble before the JSON', () => {
    const withPreamble = 'Sure, here is the scoring result:\n' + JSON.stringify(validScoreResult())
    expect(() => parseScoreResult(withPreamble)).toThrow(/not valid JSON/i)
  })
})

describe('parseScoreResult — schema-invalid JSON (valid JSON, wrong shape)', () => {
  it('throws when a required top-level field is missing (model_answer)', () => {
    const fixture = validScoreResult() as Record<string, unknown>
    delete fixture.model_answer
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when a required nested field is missing (pronunciation.note)', () => {
    const fixture = validScoreResult()
    const pronunciation = fixture.criteria.pronunciation as Record<string, unknown>
    delete pronunciation.note
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when overall_band is above the 0-9 range (10)', () => {
    const fixture = validScoreResult()
    fixture.overall_band = 10
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when a criterion band is below the 0-9 range (negative)', () => {
    const fixture = validScoreResult()
    fixture.criteria.grammatical_range_accuracy.band = -1
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when a band is sent as a string instead of a number', () => {
    const fixture = validScoreResult() as unknown as { overall_band: unknown }
    fixture.overall_band = '6.5'
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when metrics is missing a required field (avg_pause_ms)', () => {
    const fixture = validScoreResult()
    const metrics = fixture.metrics as Record<string, unknown>
    delete metrics.avg_pause_ms
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when corrections[] entries are missing a required field (explanation)', () => {
    const fixture = validScoreResult()
    fixture.corrections = [
      { original: 'I go there yesterday', corrected: 'I went there yesterday' } as never,
    ]
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when actionable_next_steps is not an array of strings', () => {
    const fixture = validScoreResult() as unknown as { actionable_next_steps: unknown }
    fixture.actionable_next_steps = 'Practice more.'
    expect(() => parseScoreResult(JSON.stringify(fixture))).toThrow(/schema validation/i)
  })

  it('throws when the payload is a JSON array instead of an object', () => {
    expect(() => parseScoreResult('[]')).toThrow(/schema validation/i)
  })

  it('throws when the payload is a bare JSON primitive', () => {
    expect(() => parseScoreResult('null')).toThrow(/schema validation/i)
    expect(() => parseScoreResult('42')).toThrow(/schema validation/i)
  })
})

describe('scoreResultSchema (direct)', () => {
  it('safeParse succeeds for well-formed input without throwing', () => {
    const result = scoreResultSchema.safeParse(validScoreResult())
    expect(result.success).toBe(true)
  })

  it('safeParse reports failure (not a thrown exception) for malformed input', () => {
    const fixture = validScoreResult() as Record<string, unknown>
    delete fixture.overall_band
    const result = scoreResultSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })
})

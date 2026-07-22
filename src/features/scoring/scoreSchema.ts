import { z } from 'zod'

const criterionSchema = z.object({
  band: z.number().min(0).max(9),
  evidence: z.string(),
  issues: z.array(z.string()),
  tips: z.array(z.string()),
})

const pronunciationCriterionSchema = z.object({
  band: z.number().min(0).max(9),
  note: z.string(),
  issues: z.array(z.string()),
  tips: z.array(z.string()),
})

const correctionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
})

const vocabularyUpgradeSchema = z.object({
  used: z.string(),
  upgrade: z.string(),
  example: z.string(),
})

/** Matches the Scoring mode JSON contract in IELTS_Speaking_AI_Plan.md section 4.5 exactly. */
export const scoreResultSchema = z.object({
  overall_band: z.number().min(0).max(9),
  criteria: z.object({
    fluency_coherence: criterionSchema,
    lexical_resource: criterionSchema,
    grammatical_range_accuracy: criterionSchema,
    pronunciation: pronunciationCriterionSchema,
  }),
  metrics: z.object({
    words_per_minute: z.number(),
    filler_count: z.number(),
    avg_pause_ms: z.number(),
    vocab_diversity: z.number(),
  }),
  corrections: z.array(correctionSchema),
  vocabulary_upgrades: z.array(vocabularyUpgradeSchema),
  model_answer: z.string(),
  actionable_next_steps: z.array(z.string()),
})

export type ScoreResult = z.infer<typeof scoreResultSchema>

/**
 * Parses raw text from Claude's scoring-mode response. Throws a descriptive
 * error rather than silently passing through malformed output — see
 * ielts-rubric skill: never render unvalidated scoring JSON.
 */
export function parseScoreResult(raw: string): ScoreResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('Scoring response is not valid JSON.')
  }
  const result = scoreResultSchema.safeParse(json)
  if (!result.success) {
    throw new Error(`Scoring response failed schema validation: ${result.error.message}`)
  }
  return result.data
}

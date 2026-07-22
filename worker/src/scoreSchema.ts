/**
 * Gemini `responseSchema` for scoring mode — must stay in sync by hand with
 * the zod schema in src/features/scoring/scoreSchema.ts (plan section 4.5).
 * Written out fully (no $ref) since Gemini's schema subset support for refs
 * is unconfirmed.
 */
const criterion = {
  type: 'object',
  properties: {
    band: { type: 'number' },
    evidence: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['band', 'evidence', 'issues', 'tips'],
}

const pronunciationCriterion = {
  type: 'object',
  properties: {
    band: { type: 'number' },
    note: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['band', 'note', 'issues', 'tips'],
}

export const scoreResponseSchema = {
  type: 'object',
  properties: {
    overall_band: { type: 'number' },
    criteria: {
      type: 'object',
      properties: {
        fluency_coherence: criterion,
        lexical_resource: criterion,
        grammatical_range_accuracy: criterion,
        pronunciation: pronunciationCriterion,
      },
      required: [
        'fluency_coherence',
        'lexical_resource',
        'grammatical_range_accuracy',
        'pronunciation',
      ],
    },
    metrics: {
      type: 'object',
      properties: {
        words_per_minute: { type: 'number' },
        filler_count: { type: 'number' },
        avg_pause_ms: { type: 'number' },
        vocab_diversity: { type: 'number' },
      },
      required: ['words_per_minute', 'filler_count', 'avg_pause_ms', 'vocab_diversity'],
    },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          corrected: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['original', 'corrected', 'explanation'],
      },
    },
    vocabulary_upgrades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          used: { type: 'string' },
          upgrade: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['used', 'upgrade', 'example'],
      },
    },
    model_answer: { type: 'string' },
    actionable_next_steps: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'overall_band',
    'criteria',
    'metrics',
    'corrections',
    'vocabulary_upgrades',
    'model_answer',
    'actionable_next_steps',
  ],
}

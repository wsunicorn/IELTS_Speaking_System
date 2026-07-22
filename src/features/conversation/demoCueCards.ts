import type { CueCardData } from './types'

/**
 * TEMPORARY local demo data. The real Claude API will generate/select cue
 * cards once the conversation loop is wired up in a later phase — this file
 * only exists so `CueCard` is visually verifiable today.
 */
export const DEMO_CUE_CARDS: CueCardData[] = [
  {
    topic: 'Describe a book you enjoyed reading.',
    points: [
      'What the book was about',
      'When you read it',
      'Why you chose it',
      'And explain why you enjoyed it',
    ],
  },
  {
    topic: 'Describe a skill you would like to learn.',
    points: [
      'What the skill is',
      'How you would learn it',
      'How long it would take to learn',
      'And explain why you want to learn this skill',
    ],
  },
]

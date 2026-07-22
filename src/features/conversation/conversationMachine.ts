import { setup, assign } from 'xstate'
import type { ConversationTurn } from './geminiClient'

export interface ConversationContext {
  turns: ConversationTurn[]
  error: string | null
}

export type ConversationEvent =
  | { type: 'START' }
  | { type: 'SPEECH_END'; transcript: string }
  | { type: 'REPLY_STARTED' }
  | { type: 'REPLY_DONE'; replyText: string }
  | { type: 'ERROR'; message: string }
  | { type: 'STOP' }

/**
 * `idle | listening | thinking | speaking` — see CLAUDE.md architecture
 * rules. Guarded transitions (not a hand-rolled reducer) so the async
 * sources (STT, Gemini stream, TTS playback) can never combine into an
 * invalid state like `listening` + `speaking` at once.
 */
export const conversationMachine = setup({
  types: {
    context: {} as ConversationContext,
    events: {} as ConversationEvent,
  },
}).createMachine({
  id: 'conversation',
  initial: 'idle',
  context: { turns: [], error: null },
  states: {
    idle: {
      on: { START: 'listening' },
    },
    listening: {
      on: {
        SPEECH_END: {
          target: 'thinking',
          actions: assign({
            turns: ({ context, event }) => [
              ...context.turns,
              { role: 'candidate', text: event.transcript },
            ],
          }),
        },
        STOP: 'idle',
      },
    },
    thinking: {
      on: {
        REPLY_STARTED: 'speaking',
        ERROR: {
          target: 'idle',
          actions: assign({ error: ({ event }) => event.message }),
        },
        STOP: 'idle',
      },
    },
    speaking: {
      on: {
        REPLY_DONE: {
          target: 'listening',
          actions: assign({
            turns: ({ context, event }) => [
              ...context.turns,
              { role: 'examiner', text: event.replyText },
            ],
          }),
        },
        STOP: 'idle',
      },
    },
  },
})

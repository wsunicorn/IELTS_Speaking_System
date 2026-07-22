export interface ConversationTurn {
  role: 'examiner' | 'candidate'
  text: string
}

export type ExamPart = 'part1' | 'part2' | 'part3'

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://127.0.0.1:8787'

/** Matches complete sentences (ending in `.`, `!`, or `?`) — see plan 4.7. */
const SENTENCE_RE = /[^.!?]+[.!?]+(?:\s+|$)/g

/**
 * Streams the examiner's reply from the Worker proxy, calling `onSentence`
 * as soon as each complete sentence arrives (not the full reply) — this is
 * what lets the caller start TTS immediately instead of waiting for the
 * whole response. Resolves with the full reply text once the stream ends.
 */
export async function streamExaminerReply(
  part: ExamPart,
  turns: ConversationTurn[],
  onSentence: (sentence: string) => void,
  feedbackLanguage: 'en' | 'vi' = 'en',
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ part, turns, feedbackLanguage }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`Conversation request failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''
  let sentenceBuffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    lineBuffer += decoder.decode(value, { stream: true })
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice('data:'.length).trim()
      if (!payload || payload === '[DONE]') continue

      let text: string | undefined
      try {
        ;({ text } = JSON.parse(payload) as { text?: string })
      } catch {
        continue
      }
      if (!text) continue

      fullText += text
      sentenceBuffer += text

      const matches = sentenceBuffer.match(SENTENCE_RE)
      if (matches) {
        for (const sentence of matches) onSentence(sentence.trim())
        sentenceBuffer = sentenceBuffer.slice(matches.join('').length)
      }
    }
  }

  if (sentenceBuffer.trim()) onSentence(sentenceBuffer.trim())

  return fullText.trim()
}

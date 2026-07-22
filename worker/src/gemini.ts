const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export interface GeminiTurn {
  role: 'user' | 'model'
  text: string
}

function buildContents(turns: GeminiTurn[]) {
  return turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }))
}

/**
 * Starts a Gemini streamGenerateContent call and returns the raw upstream
 * Response — caller re-parses the SSE body (see index.ts) rather than piping
 * it straight through, so the client never needs to understand Gemini's
 * response envelope.
 */
export async function streamGenerateContent(opts: {
  apiKey: string
  model: string
  systemInstruction: string
  turns: GeminiTurn[]
}): Promise<Response> {
  const url = `${GEMINI_BASE}/models/${opts.model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`
  const body = {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: buildContents(opts.turns),
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Extracts the incremental text from a single Gemini streamGenerateContent SSE chunk. */
export function extractChunkText(chunk: unknown): string {
  if (typeof chunk !== 'object' || chunk === null) return ''
  const candidates = (chunk as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return ''
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text: unknown }).text ?? '') : '')).join('')
}

/** Non-streaming call with JSON-schema-constrained structured output (scoring mode). */
export async function generateStructuredJSON(opts: {
  apiKey: string
  model: string
  systemInstruction: string
  turns: GeminiTurn[]
  responseSchema: Record<string, unknown>
}): Promise<string> {
  const url = `${GEMINI_BASE}/models/${opts.model}:generateContent?key=${opts.apiKey}`
  const body = {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: buildContents(opts.turns),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: opts.responseSchema,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText}`)
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini response had no text in candidates[0].content.parts[0].text')
  }
  return text
}

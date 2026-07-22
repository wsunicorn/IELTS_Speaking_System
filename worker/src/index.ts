import { streamGenerateContent, extractChunkText, generateStructuredJSON, type GeminiTurn } from './gemini'
import { conversationSystemInstruction, scoringSystemInstruction, type ExamPart } from './prompts'
import { scoreResponseSchema } from './scoreSchema'

export interface Env {
  GEMINI_API_KEY: string
}

const CONVERSATION_MODEL = 'gemini-3.5-flash-lite'
const SCORING_MODEL = 'gemini-3.6-flash'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}

function jsonError(message: string, status = 400): Response {
  return withCors(
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

interface ConversationTurnInput {
  role: 'examiner' | 'candidate'
  text: string
}

interface ConversationRequestBody {
  part: ExamPart
  turns: ConversationTurnInput[]
  feedbackLanguage?: 'en' | 'vi'
}

async function handleConversation(req: Request, env: Env): Promise<Response> {
  let body: ConversationRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body.')
  }

  if (!body.part || !Array.isArray(body.turns)) {
    return jsonError('Body must include `part` and `turns`.')
  }

  const geminiTurns: GeminiTurn[] = body.turns.map((t) => ({
    role: t.role === 'candidate' ? 'user' : 'model',
    text: t.text,
  }))

  const upstream = await streamGenerateContent({
    apiKey: env.GEMINI_API_KEY,
    model: CONVERSATION_MODEL,
    systemInstruction: conversationSystemInstruction(body.part, body.feedbackLanguage ?? 'en'),
    turns: geminiTurns,
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text()
    return jsonError(`Gemini API error ${upstream.status}: ${errText}`, 502)
  }

  // Re-parse Gemini's SSE and re-emit our own minimal `data: {"text":"..."}`
  // format, so the frontend never needs to understand Gemini's envelope.
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = upstream.body.getReader()
  let buffer = ''

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice('data:'.length).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const chunk = JSON.parse(payload)
          const text = extractChunkText(chunk)
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        } catch {
          // Ignore unparseable keep-alive/comment lines from upstream.
        }
      }
    },
  })

  return withCors(
    new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    }),
  )
}

interface ScoreRequestBody {
  transcript: string
  metrics: {
    wordsPerMinute: number
    fillerCount: number
    avgPauseMs: number
    vocabDiversity: number
  }
  feedbackLanguage?: 'en' | 'vi'
}

async function handleScore(req: Request, env: Env): Promise<Response> {
  let body: ScoreRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body.')
  }

  if (!body.transcript || !body.metrics) {
    return jsonError('Body must include `transcript` and `metrics`.')
  }

  const userMessage = [
    'Transcript:',
    body.transcript,
    '',
    'Metrics (client-computed evidence):',
    JSON.stringify(body.metrics),
  ].join('\n')

  try {
    const text = await generateStructuredJSON({
      apiKey: env.GEMINI_API_KEY,
      model: SCORING_MODEL,
      systemInstruction: scoringSystemInstruction(body.feedbackLanguage ?? 'en'),
      turns: [{ role: 'user', text: userMessage }],
      responseSchema: scoreResponseSchema,
    })
    return withCors(new Response(text, { headers: { 'Content-Type': 'application/json' } }))
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 502)
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/api/conversation') {
      return handleConversation(req, env)
    }
    if (req.method === 'POST' && url.pathname === '/api/score') {
      return handleScore(req, env)
    }

    return jsonError('Not found.', 404)
  },
}

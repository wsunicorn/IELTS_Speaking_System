import { useEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { useSpeechToText } from '@/features/speech/useSpeechToText'
import type { TTSStatus } from '@/features/speech/useHeadTTS'
import { conversationMachine } from './conversationMachine'
import { streamExaminerReply, type ExamPart } from './geminiClient'

export interface UseConversationSessionArgs {
  part: ExamPart
  speak: (text: string) => void
  stopAllSpeech: () => void
  ttsStatus: TTSStatus
}

/**
 * Orchestrates one conversation "turn cycle": listening (STT) -> thinking
 * (Gemini stream) -> speaking (progressive TTS) -> back to listening.
 *
 * Deliberate simplification: the STT pipeline is started once for the whole
 * session and never torn down between turns (reloading the Moonshine/VAD
 * model per turn would add many seconds of dead air) — instead, speech
 * segments that arrive while not in `listening` are silently ignored. Mic
 * capture keeps running as a background side effect during `thinking`/
 * `speaking`, it just isn't *acted on*, which is a looser reading of the
 * "mic off while speaking" rule than Phase 2/3's single-shot sessions used.
 *
 * Another simplification: each VAD-closed speech segment is treated as one
 * complete candidate turn. A candidate who pauses mid-thought for >400ms
 * (the VAD silence threshold) will get cut off early — acceptable for MVP,
 * revisit if it turns out to feel broken in practice.
 */
export function useConversationSession({ part, speak, stopAllSpeech, ttsStatus }: UseConversationSessionArgs) {
  const [state, send] = useMachine(conversationMachine)
  const stt = useSpeechToText('moonshine')

  const lastHandledSegmentCount = useRef(0)
  const streamDoneRef = useRef(false)
  const fullReplyRef = useRef('')
  // Mirrors fullReplyRef as state so the UI can show a live subtitle while
  // the examiner is still thinking/speaking — turns only gets the committed
  // reply on REPLY_DONE, which would otherwise leave the transcript blank
  // for the whole speaking phase, violating the "subtitles always visible" rule.
  const [pendingReply, setPendingReply] = useState('')

  // New STT segment while listening => end of candidate turn. Segments that
  // arrive during thinking/speaking are acknowledged but not acted on.
  useEffect(() => {
    if (stt.segments.length <= lastHandledSegmentCount.current) return
    const latest = stt.segments[stt.segments.length - 1]
    lastHandledSegmentCount.current = stt.segments.length

    if (state.matches('listening') && latest.text.trim()) {
      send({ type: 'SPEECH_END', transcript: latest.text.trim() })
    }
    // state.matches reads the latest snapshot at effect-run time; re-running
    // this effect only on segment growth (not every state change) is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.segments])

  // Entering `thinking` => call Gemini, feed sentences to TTS as they arrive.
  useEffect(() => {
    if (!state.matches('thinking')) return
    let cancelled = false
    let startedSpeaking = false
    streamDoneRef.current = false
    fullReplyRef.current = ''
    // Not reset synchronously here (would trip the "no setState in effect
    // body" rule) — it's already cleared by the previous turn's REPLY_DONE,
    // and the first `onSentence` callback below overwrites it immediately
    // once the new stream actually starts producing text.

    streamExaminerReply(part, state.context.turns, (sentence) => {
      if (cancelled) return
      fullReplyRef.current += (fullReplyRef.current ? ' ' : '') + sentence
      setPendingReply(fullReplyRef.current)
      speak(sentence)
      if (!startedSpeaking) {
        startedSpeaking = true
        send({ type: 'REPLY_STARTED' })
      }
    })
      .then(() => {
        if (cancelled) return
        streamDoneRef.current = true
        if (!startedSpeaking) {
          // Gemini returned no usable sentences — don't hang in `thinking` forever.
          send({ type: 'ERROR', message: 'Examiner had no reply — please try again.' })
        }
      })
      .catch((err) => {
        if (cancelled) return
        send({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value])

  // TTS queue fully drained *and* the Gemini stream is done => turn complete.
  useEffect(() => {
    if (state.matches('speaking') && streamDoneRef.current && ttsStatus === 'ready') {
      send({ type: 'REPLY_DONE', replyText: fullReplyRef.current })
      setPendingReply('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsStatus, state.value])

  const start = () => {
    void stt.start()
    send({ type: 'START' })
  }

  const stop = () => {
    stt.stop()
    stopAllSpeech()
    send({ type: 'STOP' })
  }

  return {
    phase: state.value as 'idle' | 'listening' | 'thinking' | 'speaking',
    turns: state.context.turns,
    pendingReply,
    error: state.context.error,
    sttStatus: stt.status,
    start,
    stop,
  }
}

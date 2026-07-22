import { useCallback, useRef, useState } from 'react'
import { HeadTTS } from '@met4citizen/headtts'
import { buildVisemeEnvelope, type SpeechEnvelope } from './visemeEnvelope'

export type TTSStatus = 'idle' | 'loading' | 'ready' | 'speaking' | 'error'

export interface ActiveSpeech {
  envelope: SpeechEnvelope
  audioCtx: AudioContext
  /** audioCtx.currentTime when playback started. */
  startTime: number
}

const DEFAULT_VOICE = 'af_bella'
const DEFAULT_LANGUAGE = 'en-us'

/**
 * Wraps @met4citizen/headtts (Kokoro, in-browser WebGPU/WASM worker — see
 * speech-pipeline skill). `activeSpeechRef` is a ref, not state: the avatar's
 * useMouthSync hook reads it every animation frame and a ref avoids a
 * re-render per frame.
 *
 * `speak(text)` queues sentences and plays them back-to-back without
 * overlap — this is what makes progressive TTS (plan 4.7) possible: the
 * conversation loop can call `speak()` once per sentence as they stream in,
 * instead of waiting for the full reply before saying anything.
 */
export function useHeadTTS() {
  const [status, setStatus] = useState<TTSStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)

  const headttsRef = useRef<HeadTTS | null>(null)
  const activeSpeechRef = useRef<ActiveSpeech | null>(null)
  const queueRef = useRef<string[]>([])
  const isProcessingRef = useRef(false)

  const ensureConnected = useCallback(async () => {
    if (!headttsRef.current) {
      headttsRef.current = new HeadTTS({ endpoints: ['webgpu', 'wasm'] })
    }
    const headtts = headttsRef.current
    if (!headtts.isConnected) {
      setStatus('loading')
      setLoadProgress(0)
      await headtts.connect(null, (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          setLoadProgress(Math.round((ev.loaded / ev.total) * 100))
        }
      })
      await headtts.setup({
        voice: DEFAULT_VOICE,
        language: DEFAULT_LANGUAGE,
        speed: 1,
        audioEncoding: 'wav',
      })
      setLoadProgress(null)
    }
    return headtts
  }, [])

  /** Synthesizes + plays one utterance, resolving only once playback ends. */
  const playOne = useCallback(
    (headtts: HeadTTS, text: string) =>
      new Promise<void>((resolve, reject) => {
        headtts
          .synthesize({ input: text })
          .then(([message]) => {
            const { audio, ...visemeData } = message.data
            const audioCtx = headtts.settings.audioCtx
            return audioCtx.resume().then(() => {
              const source = audioCtx.createBufferSource()
              source.buffer = audio
              source.connect(audioCtx.destination)

              activeSpeechRef.current = {
                envelope: buildVisemeEnvelope(visemeData),
                audioCtx,
                startTime: audioCtx.currentTime,
              }
              source.onended = () => {
                activeSpeechRef.current = null
                resolve()
              }
              source.start()
            })
          })
          .catch(reject)
      }),
    [],
  )

  const drainQueue = useCallback(async () => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    try {
      const headtts = await ensureConnected()
      setStatus('speaking')
      while (queueRef.current.length > 0) {
        const text = queueRef.current.shift()!
        await playOne(headtts, text)
      }
      setStatus('ready')
    } catch (err) {
      queueRef.current = []
      activeSpeechRef.current = null
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    } finally {
      isProcessingRef.current = false
    }
  }, [ensureConnected, playOne])

  const speak = useCallback(
    (text: string) => {
      setError(null)
      queueRef.current.push(text)
      void drainQueue()
    },
    [drainQueue],
  )

  /** Clears any queued/in-flight speech — used when a session resets or errors out. */
  const stopAll = useCallback(() => {
    queueRef.current = []
    activeSpeechRef.current = null
  }, [])

  return { status, error, loadProgress, speak, stopAll, activeSpeechRef }
}

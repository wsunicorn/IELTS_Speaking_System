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
 */
export function useHeadTTS() {
  const [status, setStatus] = useState<TTSStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)

  const headttsRef = useRef<HeadTTS | null>(null)
  const activeSpeechRef = useRef<ActiveSpeech | null>(null)

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

  const speak = useCallback(
    async (text: string) => {
      try {
        setError(null)
        const headtts = await ensureConnected()
        setStatus('speaking')

        const [message] = await headtts.synthesize({ input: text })
        const { audio, ...visemeData } = message.data
        const audioCtx = headtts.settings.audioCtx
        await audioCtx.resume()

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
          setStatus('ready')
        }
        source.start()
      } catch (err) {
        activeSpeechRef.current = null
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [ensureConnected],
  )

  return { status, error, loadProgress, speak, activeSpeechRef }
}

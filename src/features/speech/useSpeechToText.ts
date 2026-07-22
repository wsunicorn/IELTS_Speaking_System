import { useCallback, useRef, useState } from 'react'
import { SAMPLE_RATE } from './sttConstants'
import type { SttEngine, SttStatus, SttWorkerMessage, TranscriptSegment } from './sttTypes'

/**
 * Mic capture (AudioWorklet) + VAD + Moonshine/Whisper transcription, all in
 * a Web Worker (see speech-pipeline skill). Never touches the main thread
 * beyond posting small Float32Array chunks.
 */
export function useSpeechToText(engine: SttEngine = 'moonshine') {
  const [status, setStatus] = useState<SttStatus>('idle')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null
    workletRef.current?.disconnect()
    workletRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)
      setSegments([])

      const worker = new Worker(new URL('./stt-worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<SttWorkerMessage>) => {
        const data = event.data
        if (data.type === 'status') {
          setStatus(data.status)
        } else if (data.type === 'output') {
          if (data.message) {
            setSegments((prev) => [...prev, { text: data.message, start: data.start, end: data.end }])
          }
          setStatus('recording')
        } else if (data.type === 'error') {
          setError(data.message)
          setStatus('error')
        }
      }
      worker.onerror = (ev) => {
        setError(ev.message)
        setStatus('error')
      }
      worker.postMessage({ type: 'load', engine })

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' })
      audioCtxRef.current = audioCtx
      await audioCtx.audioWorklet.addModule(new URL('./vad-processor.js', import.meta.url))

      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      const worklet = new AudioWorkletNode(audioCtx, 'vad-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      })
      workletRef.current = worklet
      worklet.port.onmessage = (event: MessageEvent<{ buffer: Float32Array }>) => {
        workerRef.current?.postMessage({ type: 'audio', buffer: event.data.buffer })
      }
      source.connect(worklet)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
      stop()
    }
  }, [engine, stop])

  return { status, segments, error, start, stop }
}

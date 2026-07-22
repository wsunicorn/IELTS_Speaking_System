export type SttEngine = 'moonshine' | 'whisper'

export type SttStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error'

export type SttWorkerMessage =
  | { type: 'info'; message: string }
  | { type: 'status'; status: Exclude<SttStatus, 'idle'>; message: string }
  | { type: 'output'; message: string; start: number; end: number }
  | { type: 'error'; message: string }

export interface TranscriptSegment {
  text: string
  /** ms, relative to performance.now() at capture time. */
  start: number
  end: number
}

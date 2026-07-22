/**
 * @met4citizen/headtts ships no TypeScript declarations. This covers only the
 * surface this project actually calls — not a full re-typing of the library.
 */
declare module '@met4citizen/headtts' {
  export interface HeadTTSAudioData {
    words: string[]
    wtimes: number[]
    wdurations: number[]
    visemes: string[]
    vtimes: number[]
    vdurations: number[]
    phonemes: string[]
    audioEncoding: 'wav' | 'pcm'
    audio: AudioBuffer
  }

  export interface HeadTTSAudioMessage {
    type: 'audio'
    ref: number
    data: HeadTTSAudioData
  }

  export interface HeadTTSSettings {
    endpoints?: string[]
    audioCtx?: AudioContext | null
    [key: string]: unknown
  }

  export interface HeadTTSSynthesizeInput {
    input: string
    voice?: string
    language?: string
    speed?: number
    audioEncoding?: 'wav' | 'pcm'
  }

  export class HeadTTS {
    constructor(
      settings?: Partial<HeadTTSSettings> | null,
      onerror?: ((error: unknown) => void) | null,
    )
    settings: HeadTTSSettings & { audioCtx: AudioContext }
    isConnected: boolean
    connect(
      settings?: Partial<HeadTTSSettings> | null,
      onprogress?: ((ev: ProgressEvent) => void) | null,
      onerror?: ((error: unknown) => void) | null,
    ): Promise<void>
    setup(data: {
      voice?: string
      language?: string
      speed?: number
      audioEncoding?: 'wav' | 'pcm'
    }): Promise<void>
    synthesize(data: HeadTTSSynthesizeInput): Promise<HeadTTSAudioMessage[]>
  }
}

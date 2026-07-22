import {
  AutoModel,
  Tensor,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers'
import {
  SAMPLE_RATE,
  SPEECH_THRESHOLD,
  EXIT_THRESHOLD,
  MIN_SILENCE_DURATION_SAMPLES,
  SPEECH_PAD_SAMPLES,
  MIN_SPEECH_DURATION_SAMPLES,
  MAX_BUFFER_DURATION,
  MAX_NUM_PREV_BUFFERS,
} from './sttConstants'
import type { SttEngine, SttWorkerMessage } from './sttTypes'

async function supportsWebGPU(): Promise<boolean> {
  try {
    if (!('gpu' in navigator)) return false
    await navigator.gpu.requestAdapter()
    return true
  } catch {
    return false
  }
}

const post = (message: SttWorkerMessage) => self.postMessage(message)

const ENGINE_MODELS: Record<SttEngine, string> = {
  moonshine: 'onnx-community/moonshine-base-ONNX',
  whisper: 'onnx-community/whisper-base.en',
}

// Per-component dtype configs (encoder fp32 / decoder q4-or-q8) failed to
// build a session in this environment ("Missing required scale" — a
// quantization/opset mismatch between the published ONNX weights and the
// installed onnxruntime-web). Plain fp32 is slower/larger but universally
// compatible; revisit component-level quantization once pinned versions
// are verified to work together.
const DEVICE_DTYPE_CONFIGS = {
  webgpu: 'fp32',
  wasm: 'fp32',
} as const

let transcriber: AutomaticSpeechRecognitionPipeline
let sileroVad: Awaited<ReturnType<typeof AutoModel.from_pretrained>>
let vadState = new Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128])
const vadSampleRate = new Tensor('int64', [SAMPLE_RATE], [])
let isReady = false

// Transformers.js doesn't support concurrent inference — chain every call.
// Typed `unknown` because the chain alternates between VAD and ASR results;
// each call site casts the awaited value to what it actually knows it is.
let inferenceChain: Promise<unknown> = Promise.resolve()

async function loadModels(device: 'webgpu' | 'wasm', engine: SttEngine) {
  // Silero VAD isn't a standard architecture — the real config shape at
  // runtime doesn't match transformers.js's strict PretrainedConfig type.
  // `device` must be passed explicitly here too — otherwise this call picks
  // its own default (webgpu-if-available) regardless of the fallback loop
  // below, and a wasm retry would still fail on the VAD model alone.
  sileroVad = await AutoModel.from_pretrained('onnx-community/silero-vad', {
    config: { model_type: 'custom' },
    dtype: 'fp32',
    device,
  } as Parameters<typeof AutoModel.from_pretrained>[1])

  transcriber = await pipeline('automatic-speech-recognition', ENGINE_MODELS[engine], {
    device,
    dtype: DEVICE_DTYPE_CONFIGS[device],
  })

  await transcriber(new Float32Array(SAMPLE_RATE)) // warm up / compile shaders
}

async function init(engine: SttEngine) {
  // requestAdapter() succeeding doesn't guarantee onnxruntime-web can actually
  // create a WebGPU session (observed failing deeper in sandboxed/headless
  // environments) — so try webgpu first but always fall back to wasm on any
  // failure, same as the TTS pipeline (see CLAUDE.md architecture rules).
  const devices: Array<'webgpu' | 'wasm'> = (await supportsWebGPU())
    ? ['webgpu', 'wasm']
    : ['wasm']

  let lastError: unknown
  for (const device of devices) {
    try {
      post({ type: 'info', message: `Using device: "${device}"` })
      post({ type: 'status', status: 'loading', message: 'Đang tải model nhận diện giọng nói...' })
      await loadModels(device, engine)
      isReady = true
      post({ type: 'status', status: 'ready', message: 'Sẵn sàng.' })
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function vad(buffer: Float32Array, isRecording: boolean): Promise<boolean> {
  const input = new Tensor('float32', buffer, [1, buffer.length])
  inferenceChain = inferenceChain.then(() => sileroVad({ input, sr: vadSampleRate, state: vadState }))
  const { stateN, output } = (await inferenceChain) as { stateN: Tensor; output: Tensor }
  vadState = stateN

  const isSpeech: number = output.data[0] as number
  return isSpeech > SPEECH_THRESHOLD || (isRecording && isSpeech >= EXIT_THRESHOLD)
}

async function transcribe(buffer: Float32Array, start: number, end: number) {
  inferenceChain = inferenceChain.then(() => transcriber(buffer))
  const { text } = (await inferenceChain) as AutomaticSpeechRecognitionOutput
  post({ type: 'output', message: text.trim(), start, end })
}

const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE)
let bufferPointer = 0
let isRecording = false
let postSpeechSamples = 0
let prevBuffers: Float32Array[] = []

function reset(offset = 0) {
  BUFFER.fill(0, offset)
  bufferPointer = offset
  isRecording = false
  postSpeechSamples = 0
}

function dispatchAndReset(overflow?: Float32Array) {
  post({ type: 'status', status: 'transcribing', message: 'Đang nhận diện...' })

  const now = performance.now()
  const end = now - ((postSpeechSamples + SPEECH_PAD_SAMPLES) / SAMPLE_RATE) * 1000
  const start = end - (bufferPointer / SAMPLE_RATE) * 1000

  const speechBuffer = BUFFER.slice(0, bufferPointer + SPEECH_PAD_SAMPLES)
  const prevLength = prevBuffers.reduce((acc, b) => acc + b.length, 0)
  const paddedBuffer = new Float32Array(prevLength + speechBuffer.length)
  let offset = 0
  for (const prev of prevBuffers) {
    paddedBuffer.set(prev, offset)
    offset += prev.length
  }
  paddedBuffer.set(speechBuffer, offset)
  void transcribe(paddedBuffer, start, end)

  const overflowLength = overflow?.length ?? 0
  if (overflow) BUFFER.set(overflow, 0)
  reset(overflowLength)
  prevBuffers = []
}

async function handleAudioChunk(buffer: Float32Array) {
  const wasRecording = isRecording
  const isSpeech = await vad(buffer, wasRecording)

  if (!wasRecording && !isSpeech) {
    if (prevBuffers.length >= MAX_NUM_PREV_BUFFERS) prevBuffers.shift()
    prevBuffers.push(buffer)
    return
  }

  const remaining = BUFFER.length - bufferPointer
  if (buffer.length >= remaining) {
    BUFFER.set(buffer.subarray(0, remaining), bufferPointer)
    bufferPointer += remaining
    dispatchAndReset(buffer.subarray(remaining))
    return
  }
  BUFFER.set(buffer, bufferPointer)
  bufferPointer += buffer.length

  if (isSpeech) {
    if (!isRecording) {
      post({ type: 'status', status: 'recording', message: 'Đang nghe...' })
    }
    isRecording = true
    postSpeechSamples = 0
    return
  }

  postSpeechSamples += buffer.length
  if (postSpeechSamples < MIN_SILENCE_DURATION_SAMPLES) return

  if (bufferPointer < MIN_SPEECH_DURATION_SAMPLES) {
    reset()
    return
  }

  dispatchAndReset()
}

self.onmessage = (event: MessageEvent) => {
  const data = event.data as { type: 'load'; engine: SttEngine } | { type: 'audio'; buffer: Float32Array }
  if (data.type === 'load') {
    init(data.engine).catch((error: unknown) => post({ type: 'error', message: String(error) }))
    return
  }
  if (data.type === 'audio' && isReady) {
    void handleAudioChunk(data.buffer)
  }
}

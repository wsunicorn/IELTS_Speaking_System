/** Sample rate expected by both Silero VAD and Moonshine/Whisper. */
export const SAMPLE_RATE = 16000
const SAMPLE_RATE_MS = SAMPLE_RATE / 1000

/** Probabilities above this value are considered speech. */
export const SPEECH_THRESHOLD = 0.3
/** While already recording, probabilities above this (lower) value still count as speech. */
export const EXIT_THRESHOLD = 0.1

/** Wait for at least this much silence before closing out a speech chunk. */
export const MIN_SILENCE_DURATION_SAMPLES = 400 * SAMPLE_RATE_MS
/** Pad each speech chunk with this much audio on each side. */
export const SPEECH_PAD_SAMPLES = 80 * SAMPLE_RATE_MS
/** Discard finished chunks shorter than this. */
export const MIN_SPEECH_DURATION_SAMPLES = 250 * SAMPLE_RATE_MS

/** Max duration a single transcription buffer can hold. */
export const MAX_BUFFER_DURATION = 30
/** Size of buffers coming from the AudioWorklet. */
export const NEW_BUFFER_SIZE = 512
/** How many pre-speech buffers to keep so the padding above is actually available. */
export const MAX_NUM_PREV_BUFFERS = Math.ceil(SPEECH_PAD_SAMPLES / NEW_BUFFER_SIZE)

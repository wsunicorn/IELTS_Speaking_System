export interface VisemeFrame {
  /** Seconds from utterance start. */
  time: number
  /** Seconds. */
  duration: number
  /** Approximate mouth openness, 0 (closed) – 1 (wide open). */
  openness: number
}

export interface SpeechEnvelope {
  frames: VisemeFrame[]
  totalDuration: number
}

/**
 * Oculus viseme code -> approximate mouth openness. There is no real blendshape
 * rig behind this avatar (see plan 6.1) — this drives a single mouth-scale
 * value, not an actual viseme shape.
 */
const VISEME_OPENNESS: Record<string, number> = {
  sil: 0,
  PP: 0.05,
  FF: 0.15,
  TH: 0.2,
  DD: 0.25,
  kk: 0.3,
  CH: 0.35,
  SS: 0.2,
  nn: 0.25,
  RR: 0.3,
  aa: 1,
  E: 0.6,
  I: 0.45,
  O: 0.75,
  U: 0.5,
}

const DEFAULT_OPENNESS = 0.3

export function buildVisemeEnvelope(data: {
  visemes: string[]
  vtimes: number[]
  vdurations: number[]
}): SpeechEnvelope {
  const frames = data.visemes.map((viseme, i) => ({
    time: data.vtimes[i] / 1000,
    duration: data.vdurations[i] / 1000,
    openness: VISEME_OPENNESS[viseme] ?? DEFAULT_OPENNESS,
  }))
  const last = frames[frames.length - 1]
  const totalDuration = last ? last.time + last.duration : 0
  return { frames, totalDuration }
}

# CLAUDE.md — IELTS Speaking AI Examiner & Partner

## Project
A browser-based web/PWA app where users practice IELTS Speaking with a **3D talking examiner avatar** (real lip-sync). The system (1) holds a natural spoken conversation like a real examiner and (2) scores IELTS Speaking on the 4 official criteria with detailed feedback. See `IELTS_Speaking_AI_Plan.md` for the full spec.

Core rule: **Voice + 3D + STT + TTS run 100% client-side and free.** Only the Claude "brain" (scoring/conversation) uses the Anthropic API via a key-holding proxy.

## Tech stack (do not swap without asking)
- Vite + React + TypeScript + Tailwind CSS
- 3D avatar + lip-sync: TalkingHead (met4citizen) + Ready Player Me (GLB)
- TTS: HeadTTS with Kokoro-82M voices (viseme + word timestamps, WebGPU/WASM)
- STT: Moonshine v2 streaming (real-time) + Whisper base.en fallback, via Transformers.js, in a Web Worker
- Audio-reactive visuals: Three.js / React-Three-Fiber + GLSL + Web Audio AnalyserNode
- LLM brain: Claude API (Sonnet for conversation, Opus optional for final scoring) via a Cloudflare Worker proxy
- Local storage: IndexedDB via Dexie.js (local-first; schema must map 1:1 to Postgres for later Supabase sync)
- Validation: zod for the scoring JSON

## Architecture rules
- 3-layer render: (1) audio-reactive background canvas, (2) TalkingHead avatar canvas, (3) React DOM UI overlay. Do NOT merge separate Three.js scenes.
- App is driven by an explicit state machine: `idle | listening | thinking | speaking`.
- STT/TTS inference runs in Web Workers; never block the main thread.
- Prefer WebGPU, fall back to WASM automatically.
- NEVER put the Anthropic API key in client code. All Claude calls go through the proxy.
- Scoring mode must request JSON-only output from Claude and validate with zod before rendering.

## IELTS scoring
- 4 criteria, band 0–9, overall = average rounded to nearest 0.5: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Pronunciation from transcript+audio is approximate — label it as such, never present as exact.
- Feed client-computed metrics (WPM, fillers, pauses, vocab diversity) to Claude as evidence.
- Follow the exact JSON schema in the plan (section 4.5).

## Conventions
- TypeScript strict mode. Functional React components + hooks. No `any` unless justified.
- Keep components small; colocate feature logic under `src/features/<feature>/`.
- Respect `prefers-reduced-motion`; subtitles always available; keyboard accessible.
- Commit per build phase (see plan section 8). Each phase must be demo-able.

## Explanations
- Explain reasoning and decisions to the user in **Vietnamese**; keep code, identifiers, and comments in English.

## Where to look
- Full plan & rationale: `IELTS_Speaking_AI_Plan.md`
- Skills: `.claude/skills/` — Subagents: `.claude/agents/`

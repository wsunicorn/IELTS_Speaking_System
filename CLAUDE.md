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
- State machine: XState — explicit states + guarded transitions, not a hand-rolled reducer. Async sources (STT worker, Claude API stream, TTS playback) are easy to race into an invalid combined state (e.g. `listening` + `speaking` at once); a formal machine prevents that by construction.

## Architecture rules
- 3-layer render: (1) audio-reactive background canvas, (2) TalkingHead avatar canvas, (3) React DOM UI overlay. Do NOT merge separate Three.js scenes.
- App is driven by an explicit state machine (XState): `idle | listening | thinking | speaking`.
- STT/TTS inference runs in Web Workers; never block the main thread.
- Prefer WebGPU, fall back to WASM automatically.
- NEVER put the Anthropic API key in client code. All Claude calls go through the proxy.
- Scoring mode must request JSON-only output from Claude and validate with zod before rendering.
- Conversation mode streams the Claude response and starts TTS synthesis/playback on the first complete sentence while later sentences are still generating — do not wait for the full reply before speaking. This is the main lever against "dead air" between turns; see plan section 4.7.
- Barge-in (interrupting the avatar mid-speech) is explicitly **out of MVP scope** — mic stays off while `speaking`. Do not add it without discussing the added complexity (VAD-while-TTS-playing, cancel-and-resume) first.
- Primary target device is **desktop/laptop**; mobile should not crash or be unusable, but is not tuned or QA'd per phase.

## Design & assets — code-first, no external tools
- All visual/design assets are authored **directly as code by Claude Code** — no Canva, Figma, stock photos, or external image-gen tools. This covers: icons/illustrations (hand-written SVG), UI decoration and design tokens (Tailwind), 3D lighting/materials/animation, particle systems, and audio-reactive GLSL shaders.
- **One exception:** the examiner's rigged humanoid avatar mesh (GLB with Oculus viseme blendshapes) is sourced once from Ready Player Me — no LLM can generate a riggable 3D mesh from a text prompt. Everything applied to that mesh afterward (lighting, camera, animation, effects) is still code.
- Do not reach for the Canva MCP tool for this project; it is not part of the design workflow.
- **Default visual intensity is calm, not maximal.** The audio-reactive background/particles default to a subtle preset (this is a study tool — the candidate needs to concentrate on speaking, not watch a light show). Full "cinematic" intensity exists as an opt-in Settings toggle, not the default.

## IELTS scoring
- 4 criteria, band 0–9, overall = average rounded to nearest 0.5: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Pronunciation from transcript+audio is approximate — label it as such, never present as exact.
- Feed client-computed metrics (WPM, fillers, pauses, vocab diversity) to Claude as evidence.
- Follow the exact JSON schema in the plan (section 4.5).
- The results screen must let the user hear `corrections[].corrected` and `model_answer` read aloud via the same TTS pipeline (Kokoro) — reuses existing infrastructure, high learning value (hear the fix, not just read it).

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

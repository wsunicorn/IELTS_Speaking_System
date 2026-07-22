# CLAUDE.md — IELTS Speaking AI Examiner & Partner

## Project
A browser-based web/PWA app where users practice IELTS Speaking with a **3D talking examiner avatar** (real lip-sync). The system (1) holds a natural spoken conversation like a real examiner and (2) scores IELTS Speaking on the 4 official criteria with detailed feedback. See `IELTS_Speaking_AI_Plan.md` for the full spec.

Core rule: **Voice + 3D + STT + TTS run 100% client-side and free.** Only the "brain" (scoring/conversation) uses the Gemini API via a key-holding proxy.

> **LLM provider note:** the app's runtime brain is **Google Gemini** (not Anthropic Claude) — switched 2026-07-22 per explicit user decision. This is unrelated to "Claude Code" elsewhere in this file, which refers to the coding assistant building the app, not the app's own AI.

## Tech stack (do not swap without asking)
- Vite + React + TypeScript + Tailwind CSS
- 3D avatar + lip-sync: **fully procedural**, built with Three.js/React-Three-Fiber — a stylized geometric bust (no external mesh, no GLB, no TalkingHead library). Mouth animation is driven by TTS word timestamps/amplitude (approximate viseme-less lip movement), not real Oculus blendshapes. Traded photorealism for zero external dependency, per explicit user decision. A real rigged GLB (e.g. from Ready Player Me) can be swapped in later without changing anything outside `src/features/avatar/`.
- TTS: HeadTTS with Kokoro-82M voices (viseme + word timestamps, WebGPU/WASM)
- STT: Moonshine v2 streaming (real-time) + Whisper base.en fallback, via Transformers.js, in a Web Worker
- Audio-reactive visuals: Three.js / React-Three-Fiber + GLSL + Web Audio AnalyserNode
- LLM brain: **Gemini API** (`gemini-3.5-flash-lite` for real-time conversation, `gemini-3.6-flash` for final scoring — both current GA models as of 2026-07; re-verify model IDs before use since Google's naming shifts) via a Cloudflare Worker proxy. REST endpoint, API key as a query param (`?key=...`), never in a header a browser could leak — see `ai.google.dev/api/generate-content`.
- Local storage: IndexedDB via Dexie.js (local-first; schema must map 1:1 to Postgres for later Supabase sync)
- Validation: zod for the scoring JSON (independent of Gemini's own `response_schema` structured-output constraint — never trust upstream shape blindly, validate again on receipt)
- State machine: XState — explicit states + guarded transitions, not a hand-rolled reducer. Async sources (STT worker, Gemini API stream, TTS playback) are easy to race into an invalid combined state (e.g. `listening` + `speaking` at once); a formal machine prevents that by construction.

## Architecture rules
- 3-layer render: (1) audio-reactive background canvas, (2) procedural avatar canvas, (3) React DOM UI overlay. Do NOT merge separate Three.js scenes.
- App is driven by an explicit state machine (XState): `idle | listening | thinking | speaking`.
- STT/TTS inference runs in Web Workers; never block the main thread.
- Prefer WebGPU, fall back to WASM automatically.
- NEVER put the Gemini API key in client code. All Gemini calls go through the proxy.
- Scoring mode must request JSON-only output from Gemini (use `generationConfig.response_schema` for structured output, matching the zod schema) and validate with zod before rendering — the schema constraint on Gemini's side is defense-in-depth, not a replacement for zod.
- Conversation mode streams the Gemini response (`streamGenerateContent?alt=sse`) and starts TTS synthesis/playback on the first complete sentence while later sentences are still generating — do not wait for the full reply before speaking. This is the main lever against "dead air" between turns; see plan section 4.7.
- Barge-in (interrupting the avatar mid-speech) is explicitly **out of MVP scope** — mic stays off while `speaking`. Do not add it without discussing the added complexity (VAD-while-TTS-playing, cancel-and-resume) first.
- Primary target device is **desktop/laptop**; mobile should not crash or be unusable, but is not tuned or QA'd per phase.

## Design & assets — code-first, no external tools, no exceptions
- All visual/design assets, including the avatar itself, are authored **directly as code by Claude Code** — no Canva, Figma, stock photos, external image-gen tools, or external 3D mesh source (no Ready Player Me). Icons/illustrations are hand-written SVG; the avatar, lighting, and effects are Three.js/R3F geometry and materials.
- Do not reach for the Canva MCP tool for this project; it is not part of the design workflow.
- **Default visual intensity is calm, not maximal.** The audio-reactive background/particles default to a subtle preset (this is a study tool — the candidate needs to concentrate on speaking, not watch a light show). Full "cinematic" intensity exists as an opt-in Settings toggle, not the default.

## IELTS scoring
- 4 criteria, band 0–9, overall = average rounded to nearest 0.5: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Pronunciation from transcript+audio is approximate — label it as such, never present as exact.
- Feed client-computed metrics (WPM, fillers, pauses, vocab diversity) to Gemini as evidence.
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

# IELTS Speaking AI Examiner & Partner

Browser-based web/PWA app for practicing IELTS Speaking with a 3D talking examiner avatar (real lip-sync). See [`IELTS_Speaking_AI_Plan.md`](./IELTS_Speaking_AI_Plan.md) for the full spec and [`CLAUDE.md`](./CLAUDE.md) for project conventions.

Core rule: **voice + 3D + STT + TTS run 100% client-side and free.** Only the Claude "brain" (scoring/conversation) uses the Anthropic API via a key-holding proxy.

## Stack

Vite + React + TypeScript + Tailwind CSS + shadcn/ui. See `CLAUDE.md` for the full stack (3D avatar, TTS, STT, LLM brain, storage).

## Getting started

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run lint      # eslint
npm run format    # prettier --write
```

## Project status

Phase 0 (scaffold) complete. See `IELTS_Speaking_AI_Plan.md` section 8 for the full build roadmap.

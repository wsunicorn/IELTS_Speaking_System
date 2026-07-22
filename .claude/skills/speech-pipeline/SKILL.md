---
name: speech-pipeline
description: Use when integrating or modifying the speech pipeline — HeadTTS/Kokoro text-to-speech, Moonshine/Whisper speech-to-text via Transformers.js, Web Worker wiring for either, or the client-side state machine (idle/listening/thinking/speaking) that coordinates them. Covers latency, threading, and fallback rules.
---

# Speech Pipeline — TTS (Kokoro) + STT (Moonshine/Whisper)

## Nguyên tắc cốt lõi
Toàn bộ inference giọng nói chạy **100% client-side, miễn phí, trong Web Worker** — không bao giờ block main thread, không bao giờ gửi audio thô lên server.

## TTS — HeadTTS + Kokoro-82M
- HeadTTS xuất **audio + viseme + word timestamps** cùng lúc — timestamps này dùng thẳng cho lip-sync (`r3f-3d` skill) và cho highlight subtitle theo từ.
- Ưu tiên **WebGPU**, tự động fallback **WASM** khi không có WebGPU (feature-detect, không hardcode theo user-agent).
- Cho user chọn giọng Kokoro + "chất lượng model" trong Settings — máy yếu nên có model nhỏ hơn.

## STT — Moonshine v2 streaming + Whisper base.en fallback
- **Moonshine v2 streaming**: dùng cho hội thoại real-time (~100ms latency) — mặc định khi đang trong lúc thi/luyện.
- **Whisper base.en**: fallback khi cần độ chính xác cao hơn (vd. STT sai với accent nặng, hoặc user bấm "ghi âm lại"), hỗ trợ timestamp cho metrics engine.
- Cả hai chạy qua **Transformers.js**, luôn trong **Web Worker riêng** (không chung worker với TTS) để tránh nghẽn khi cả hai chạy gần nhau (vd. barge-in).

## Web Worker rules
- Main thread chỉ gửi/nhận message (audio chunks, transcript deltas, viseme/timestamp payloads) — không import model trực tiếp vào main bundle.
- Mỗi worker load model **1 lần**, cache lại (Transformers.js tự cache qua Cache API/IndexedDB) — không re-download mỗi phiên.
- Có UI progress rõ ràng khi tải model lần đầu (Kokoro ~80–300MB, STT ~50–250MB), giải thích "tải 1 lần, sau đó offline".

## State machine — idle | listening | thinking | speaking
Pipeline giọng nói phải đồng bộ chặt với state machine trung tâm:
- `idle` → chờ user bấm mic.
- `listening` → STT worker đang nhận audio stream, UI hiện waveform.
- `thinking` → đã có transcript, đang chờ Claude API trả lời (proxy call), mic tắt.
- `speaking` → TTS đang phát + avatar lip-sync; barge-in (user ngắt lời) nên được cân nhắc nhưng không bắt buộc ở MVP.

Không để 2 state chạy song song ngoài ý muốn (vd. vừa `speaking` vừa nhận input STT) trừ khi chủ đích implement barge-in.

## Vị trí code
Worker script + wrapper hooks đặt trong `src/features/speech/` (vd. `speech/tts-worker.ts`, `speech/stt-worker.ts`, `speech/useSpeechPipeline.ts`). Không import trực tiếp thư viện inference nặng vào component React — luôn qua worker + message-passing hook.

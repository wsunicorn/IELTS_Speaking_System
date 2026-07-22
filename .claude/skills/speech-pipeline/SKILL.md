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
- Màn kết quả (scoring) tái dùng cùng TTS pipeline để **đọc lại** `corrections[].corrected` và `model_answer` — không cần thêm hạ tầng TTS riêng.

## Streaming + progressive TTS (Conversation mode — quan trọng cho độ trễ)
Không chờ Claude trả lời xong toàn bộ rồi mới TTS — sẽ tạo khoảng lặng chết 2–4 giây mỗi lượt. Thay vào đó:
1. Nhận Claude response ở dạng **stream** (qua proxy).
2. Tách text thành câu hoàn chỉnh theo dấu câu ngay khi stream về.
3. Đưa câu đầu tiên vào TTS synthesize + phát **ngay**, không chờ các câu sau.
4. Các câu tiếp theo vào queue TTS, phát nối tiếp khi câu trước phát xong.

State machine chuyển sang `speaking` ngay khi câu đầu tiên bắt đầu phát, không phải khi toàn bộ response generate xong. Xem thêm plan mục 4.7.

## STT — Moonshine v2 streaming + Whisper base.en fallback
- **Moonshine v2 streaming**: dùng cho hội thoại real-time (~100ms latency) — mặc định khi đang trong lúc thi/luyện.
- **Whisper base.en**: fallback khi cần độ chính xác cao hơn (vd. STT sai với accent nặng, hoặc user bấm "ghi âm lại"), hỗ trợ timestamp cho metrics engine.
- Cả hai chạy qua **Transformers.js**, luôn trong **Web Worker riêng** (không chung worker với TTS) để tránh nghẽn khi cả hai chạy gần nhau (vd. barge-in).

## Web Worker rules
- Main thread chỉ gửi/nhận message (audio chunks, transcript deltas, viseme/timestamp payloads) — không import model trực tiếp vào main bundle.
- Mỗi worker load model **1 lần**, cache lại (Transformers.js tự cache qua Cache API/IndexedDB) — không re-download mỗi phiên.
- Có UI progress rõ ràng khi tải model lần đầu (Kokoro ~80–300MB, STT ~50–250MB), giải thích "tải 1 lần, sau đó offline".

## State machine (XState) — idle | listening | thinking | speaking
Pipeline giọng nói phải đồng bộ chặt với state machine trung tâm:
- `idle` → chờ user bấm mic.
- `listening` → STT worker đang nhận audio stream, UI hiện waveform.
- `thinking` → đã có transcript, đang chờ Claude API trả lời (proxy call, streaming), mic tắt.
- `speaking` → TTS đang phát (bắt đầu ngay từ câu đầu tiên, xem phần streaming ở trên) + avatar lip-sync; mic tắt.

**Barge-in (user ngắt lời avatar) KHÔNG có trong MVP** — không implement VAD-trong-lúc-speaking, không cancel TTS giữa chừng. Không để 2 state chạy song song ngoài ý muốn (vd. vừa `speaking` vừa nhận input STT) — dùng guard của XState để chặn cứng việc này.

## Vị trí code
Worker script + wrapper hooks đặt trong `src/features/speech/` (vd. `speech/tts-worker.ts`, `speech/stt-worker.ts`, `speech/useSpeechPipeline.ts`). Không import trực tiếp thư viện inference nặng vào component React — luôn qua worker + message-passing hook.

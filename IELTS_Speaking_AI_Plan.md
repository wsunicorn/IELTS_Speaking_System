# KẾ HOẠCH XÂY DỰNG: "AI IELTS Speaking Examiner & Partner"

> Tài liệu này là bản đặc tả (PRD + kiến trúc + lộ trình) để dán vào **Claude Code** và xây dựng hệ thống.
> Ngôn ngữ giải thích: tiếng Việt. Thuật ngữ kỹ thuật, code, tên biến: tiếng Anh.
> Nguyên tắc cốt lõi: **Voice + 3D chạy 100% client-side, MIỄN PHÍ**. "Bộ não" chấm điểm dùng Gemini API (chi phí token rất nhỏ cho text).
> **Cập nhật 2026-07-22:** đổi bộ não từ Claude API (Anthropic) sang Gemini API (Google) theo quyết định của user — xem mục 1.1 và 3. Đây là quyết định kiến trúc, không ảnh hưởng đến việc dùng Claude Code làm công cụ xây dựng dự án.

---

## 1. TẦM NHÌN & MỤC TIÊU

Một web app nơi người dùng **nói chuyện tiếng Anh trực tiếp** với một **giám khảo IELTS 3D biết nói, có khẩu hình như người thật**. Hệ thống vừa:
1. **Đối thoại tự nhiên** như một examiner thật (hỏi, lắng nghe, hỏi tiếp).
2. **Chấm điểm IELTS Speaking** theo 4 tiêu chí chính thức + đưa feedback chi tiết, sửa lỗi, gợi ý nâng band.

Mục tiêu người dùng: luyện Speaking đạt band **6.5–7.0**, có trải nghiệm đẹp – mượt – hiện đại – tạo cảm giác "phòng thi thật".

**Định hướng đã chốt:**
- Nền tảng: **Web app / PWA** (chạy trình duyệt, cài được như app).
- Giọng nói: **tốt nhất trong nhóm miễn phí**, chạy on-device.
- 3D: **năng lực kỹ thuật tối đa**, nhưng **mặc định hiển thị ở mức "calm"** (tinh tế, ít xao nhãng — phù hợp một công cụ luyện thi cần tập trung); "Cinematic mode" đầy hiệu ứng là tùy chọn user tự bật trong Settings. *(Cập nhật sau review chất lượng — xem mục 1.1.)*
- Thiết bị mục tiêu: **desktop/laptop-first**. Mobile phải chạy được, không crash, nhưng không tối ưu/QA riêng ở mỗi phase.
- Phạm vi: **cá nhân trước**, kiến trúc **sẵn sàng mở rộng** thành sản phẩm nhiều người dùng.

### 1.1 Các quyết định bổ sung sau review chất lượng UX
Sau khi rà soát lại toàn bộ plan để tối đa hoá chất lượng/trải nghiệm, đã chốt thêm:
- **Streaming + progressive TTS** (mục 4.7): giảm "khoảng lặng chết" giữa các lượt hội thoại — đòn bẩy UX lớn nhất, xem chi tiết ở mục 4.7.
- **Visual mặc định "calm", cinematic là tùy chọn** (đảo lại phần "3D tối đa" ban đầu) — ưu tiên sự tập trung của người luyện thi hơn hiệu ứng thị giác.
- **State machine dùng XState** thay vì tự viết reducer — tránh race condition giữa các nguồn async (STT worker / Gemini stream / TTS playback).
- **Nghe lại câu đã sửa / model answer bằng TTS** ở màn kết quả — tận dụng pipeline TTS có sẵn, giá trị học tập cao, chi phí kỹ thuật gần bằng 0.
- **Barge-in (ngắt lời avatar) — chưa đưa vào MVP**, giữ flow lượt-nói-lượt-nghe đơn giản như thi thật; có thể thêm sau nếu cần.

### 1.2 Đổi bộ não: Claude API → Gemini API (2026-07-22)
Quyết định của user, thay thế các mục 2/3/4.2/4.6/11 bên dưới:
- **Lý do:** user đã có sẵn Gemini API key.
- **Model dùng:** `gemini-3.5-flash-lite` cho hội thoại real-time (rẻ/nhanh, tương đương vai trò Sonnet cũ), `gemini-3.6-flash` cho chấm điểm cuối (mạnh hơn, tương đương vai trò Opus cũ). *Google đổi tên model khá thường xuyên — kiểm tra lại model ID còn hợp lệ tại [ai.google.dev/gemini-api/docs/latest-model](https://ai.google.dev/gemini-api/docs/latest-model) trước khi dùng nếu cách lần chốt này quá vài tháng.*
- **Gọi API:** REST thuần qua `fetch`, không cần SDK Node (hợp với Cloudflare Worker). Endpoint `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...` (streaming: `:streamGenerateContent?alt=sse&key=...`). API key nằm ở **query param**, không phải header — proxy phải tự thêm vào, không bao giờ để client biết key.
- **JSON mode cho Scoring:** Gemini hỗ trợ `generationConfig.response_schema` (structured output) — dùng để ràng buộc shape ngay từ phía Gemini, nhưng **vẫn validate lại bằng zod** ở client khi nhận về (không tin tưởng tuyệt đối phía model).
- **Bảo mật:** vẫn bắt buộc qua Cloudflare Worker proxy y như thiết kế gốc — chỉ đổi biến môi trường từ `ANTHROPIC_API_KEY` thành `GEMINI_API_KEY`.
- ⚠️ **Lưu ý bảo mật riêng:** trong lúc trao đổi, user từng dán trực tiếp 4 API key Gemini (từ một project khác) vào chat ở dạng plaintext — các key đó coi như đã lộ, đã khuyến nghị user thu hồi/xoay vòng. Không dùng lại các key đó cho dự án này.

---

## 2. KIẾN TRÚC TỔNG QUÁT (Data Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT (Client)                        │
│                                                                    │
│  [Mic] → STT (Moonshine/Whisper, Web Worker) → transcript+timing   │
│                          │                                         │
│                          ▼                                         │
│              Metrics engine (WPM, fillers, pauses, vocab)          │
│                          │                                         │
│                          ▼                                         │
│         (gửi transcript qua proxy) ──► GEMINI API (bộ não)         │
│                          ▲                     │                   │
│                          │                     ▼                   │
│                   câu hỏi/feedback  ◄── examiner reply (text)      │
│                          │                                         │
│                          ▼                                         │
│   TTS (Kokoro qua HeadTTS) → audio + visemes + word timestamps     │
│                          │                                         │
│                          ▼                                         │
│   AVATAR 3D (procedural, Three.js/R3F) lip-sync xấp xỉ + nói       │
│                                                                    │
│   Nền: audio-reactive shader/particles (Web Audio AnalyserNode)    │
│   UI overlay: React DOM (glassmorphism + Framer Motion)            │
│                                                                    │
│  [IndexedDB / Dexie] lưu lịch sử session (local-first)             │
└──────────────────────────────────────────────────────────────────┘
                          │ (chỉ Gemini API cần proxy giữ key)
                          ▼
     Cloudflare Worker (free tier) — giữ GEMINI_API_KEY an toàn
```

**Điểm mấu chốt về chi phí & bảo mật:**
- STT, TTS, 3D, audio-reactive, UI: **hoàn toàn miễn phí, chạy trong máy người dùng**.
- Gemini API là phần duy nhất tốn tiền (rất nhỏ, chỉ text) và **cần một proxy nhỏ** để không lộ API key ra client. Dùng **Cloudflare Worker (free tier)** là đủ và vẫn "gần như không tốn phí".
- Nếu muốn **$0 tuyệt đối**: có thể thay bộ não bằng WebLLM (Llama chạy in-browser) — nhưng **chất lượng chấm điểm/hội thoại thấp hơn Gemini rõ rệt**, không khuyến nghị cho mục tiêu luyện thi nghiêm túc. Giữ Gemini làm bộ não chính, WebLLM chỉ là "offline fallback" tùy chọn.

---

## 3. TECH STACK (đã research, chốt phương án tốt nhất & miễn phí)

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Build tool | **Vite + React + TypeScript** | Nhanh, hiện đại, dễ scale lên product |
| Styling/UI | **Tailwind CSS** + (tùy chọn shadcn/ui) | Nhất quán, đẹp, nhanh |
| Animation UI | **Framer Motion** (+ GSAP nếu cần) | Micro-interactions, chuyển cảnh mượt |
| State machine | **XState** | `idle/listening/thinking/speaking` có nhiều nguồn async (STT worker, Gemini stream, TTS) dễ race condition nếu tự viết reducer — XState đảm bảo transition hợp lệ bằng cấu trúc |
| Avatar 3D + lip-sync | **Procedural, tự dựng bằng Three.js/R3F** (không GLB, không mesh ngoài) | *(Đổi sau yêu cầu "tự tạo, không dùng gì ngoài" — mục 6.1)* Hình khối cách điệu do Claude Code viết 100% code; đổi lại realism thấp hơn mesh người thật, khớp miệng xấp xỉ theo amplitude/timestamp TTS thay vì Oculus viseme blendshape thật |
| TTS (giọng nói) | **HeadTTS** với **Kokoro-82M** voices | Miễn phí, chạy local (WebGPU/WASM), xuất **viseme + timestamp** → dùng làm dữ liệu điều khiển khớp miệng xấp xỉ cho avatar procedural |
| STT (nhận giọng) | **Moonshine v2 streaming** (real-time) + **Whisper base.en** (độ chính xác cao) qua **Transformers.js** | Moonshine: độ trễ ~100ms, hợp hội thoại; Whisper: fallback chính xác, 99 ngôn ngữ, có timestamp |
| Audio-reactive 3D | **Three.js / R3F + GLSL shader** + **Web Audio AnalyserNode** | Orb/particle phản ứng theo biên độ/tần số giọng |
| Bộ não (LLM) | **Gemini API** — `gemini-3.5-flash-lite` cho hội thoại real-time, `gemini-3.6-flash` cho báo cáo chấm điểm cuối *(đổi từ Claude API 2026-07-22, xem mục 1.2 — kiểm tra lại model ID tại ai.google.dev nếu đã lâu)* | Rẻ/nhanh cho hội thoại, mạnh hơn cho chấm điểm; hỗ trợ structured output (`response_schema`) khớp thẳng vào zod schema |
| Proxy giữ key | **Cloudflare Workers** (free tier) | Bảo mật API key (`GEMINI_API_KEY`), hỗ trợ streaming SSE, gần như $0 |
| Lưu trữ local | **IndexedDB** qua **Dexie.js** | Local-first, schema sẵn sàng sync lên server sau |
| Mở rộng product (sau) | **Supabase** (Auth + Postgres + Storage, free tier) | Thêm tài khoản/đồng bộ mà không đổi kiến trúc |
| Hosting | **Cloudflare Pages / Vercel** (static, free) | Deploy PWA miễn phí |

### 3.1 Cách các mảnh khớp nhau
Ban đầu tham khảo combo **TalkingHead + HeadTTS(Kokoro) + whisper-web** (demo "AI in-browser bạn có thể nói chuyện") để giảm rủi ro tích hợp lip-sync ↔ TTS. Từ Phase 1 đã đổi avatar sang **procedural tự dựng** (mục 6.1, không dùng TalkingHead/Ready Player Me — không dùng mesh ngoài), và từ mục 1.2 đã đổi bộ não từ Claude API sang **Gemini API**. HeadTTS(Kokoro) cho TTS và Moonshine/Whisper cho STT vẫn giữ nguyên như chốt ban đầu.

### 3.2 Kiến trúc render 3 lớp (để vừa đẹp vừa mượt, tránh xung đột scene)
- **Lớp nền (background):** canvas audio-reactive (shader/particles) phản ứng theo giọng examiner đang nói và giọng user đang nói.
- **Lớp avatar:** canvas avatar procedural (Three.js/R3F, khớp miệng xấp xỉ theo Kokoro timestamp) ở trung tâm — xem mục 6.1.
- **Lớp UI (DOM):** React overlay — nút mic, subtitle, timer cue-card, panel điểm số, với glassmorphism + Framer Motion.

Tách lớp giúp mỗi phần tối ưu độc lập, tránh trộn 2 Three.js scene gây rối.

---

## 4. "GIÁM KHẢO AI" — THIẾT KẾ LÕI (phần giá trị nhất)

### 4.1 Cấu trúc bài thi IELTS Speaking cần mô phỏng
- **Part 1** (4–5 phút): giới thiệu + chủ đề quen thuộc, Q&A ngắn.
- **Part 2** (3–4 phút): cue card, **1 phút chuẩn bị**, nói **1–2 phút**, có follow-up. → Cần **timer + màn hình cue card**.
- **Part 3** (4–5 phút): thảo luận trừu tượng, liên quan chủ đề Part 2.

### 4.2 Hai "chế độ" của Gemini
**(A) Conversation mode** — Gemini đóng vai examiner: hỏi tự nhiên, phản hồi ngắn gọn, dẫn dắt đúng flow từng Part, KHÔNG sửa lỗi giữa chừng (giống thi thật).

**(B) Scoring mode** — sau mỗi Part/cả session: nhận **transcript + metrics** và trả về **JSON có cấu trúc** để render lên UI đẹp.

### 4.3 Metrics tính client-side (làm "bằng chứng" cho chấm điểm)
Từ transcript + word timestamps của STT:
- `words_per_minute` (proxy fluency)
- `filler_count` (um, uh, like, you know…)
- `avg_pause_ms`, `long_pause_count` (từ khoảng trống timestamp)
- `vocab_diversity` (type–token ratio)
- `sentence_length_variation`
Metrics này giúp Gemini chấm **có căn cứ**, giảm "chấm cảm tính".

### 4.4 4 tiêu chí chấm (band 0–9, làm tròn 0.5, trung bình 4 tiêu chí)
1. **Fluency & Coherence (FC)**
2. **Lexical Resource (LR)**
3. **Grammatical Range & Accuracy (GRA)**
4. **Pronunciation (P)** — ⚠️ *chấm từ transcript + audio metrics là gần đúng*. Với web miễn phí, đây là mắt xích yếu nhất. MVP: đánh giá định tính (tốc độ nói, ngập ngừng, lỗi phổ biến của người Việt) + luyện phoneme. Nâng cấp tương lai (tùy chọn): dùng model pronunciation-assessment/forced-alignment.

### 4.5 JSON schema đầu ra của Scoring mode
```json
{
  "overall_band": 6.5,
  "criteria": {
    "fluency_coherence":        { "band": 6, "evidence": "", "issues": [], "tips": [] },
    "lexical_resource":         { "band": 7, "evidence": "", "issues": [], "tips": [] },
    "grammatical_range_accuracy": { "band": 6, "evidence": "", "issues": [], "tips": [] },
    "pronunciation":            { "band": 6, "note": "approx from transcript+audio", "issues": [], "tips": [] }
  },
  "metrics": { "words_per_minute": 118, "filler_count": 9, "avg_pause_ms": 850, "vocab_diversity": 0.42 },
  "corrections": [ { "original": "", "corrected": "", "explanation": "" } ],
  "vocabulary_upgrades": [ { "used": "good", "upgrade": "compelling", "example": "" } ],
  "model_answer": "A band 8 sample answer to the same question…",
  "actionable_next_steps": [ "" ]
}
```
> Ép Gemini trả về **CHỈ JSON** (dùng `generationConfig.response_schema` để ràng buộc shape, không markdown, không mở đầu) để parse an toàn; validate lại bằng schema (zod) trước khi render.

### 4.6 Gợi ý system prompt cho examiner (rút gọn — Claude Code sẽ mở rộng khi build)
- *Conversation:* "You are a professional but warm IELTS Speaking examiner. Ask questions naturally for {part}. Keep your turns short. Do NOT correct the candidate mid-test. Follow the official timing and flow."
- *Scoring:* "You are a certified IELTS examiner. Given the transcript and metrics, score each of the 4 criteria (0–9), cite concrete evidence from the transcript, list corrections and vocabulary upgrades, and provide a band-8 model answer. Return ONLY valid JSON matching the schema."
- Cho phép người dùng chọn **feedback bằng tiếng Việt** (giải thích lỗi dễ hiểu hơn) trong khi model answer giữ tiếng Anh.

### 4.7 Giảm độ trễ hội thoại — streaming + progressive TTS (quan trọng nhất cho "cảm giác thật")
Nếu chờ Gemini trả lời **xong toàn bộ câu** rồi mới bắt đầu TTS, mỗi lượt hội thoại có thể "im lặng chết" 2–4 giây — phá cảm giác đang nói chuyện với người thật.

**Cách xử lý:**
1. Gọi Gemini API ở chế độ **streaming** (`streamGenerateContent?alt=sse`, qua proxy).
2. Tách text stream thành từng câu hoàn chỉnh (theo dấu câu `. ! ?`).
3. Ngay khi có câu đầu tiên → đưa vào TTS (Kokoro/HeadTTS) synthesize + phát **ngay**, trong lúc Gemini vẫn đang generate các câu tiếp theo.
4. Queue các câu tiếp theo vào TTS tuần tự, nối tiếp không giật.

Đánh đổi: code phức tạp hơn ở Phase 4 (cần tách câu, quản lý queue TTS, đồng bộ với state machine `speaking`), nhưng đây là đòn bẩy lớn nhất để hội thoại "giống thật".

---

## 5. DANH SÁCH TÍNH NĂNG (theo module)

**MVP (cá nhân):**
- Chọn Part (1/2/3) hoặc **Full mock test** (1→2→3 liền mạch).
- Avatar examiner 3D nói + lip-sync; subtitle bật/tắt.
- Ghi âm → transcript real-time.
- Part 2: màn hình cue card + timer chuẩn bị 1' + nói 2'.
- Bảng điểm 4 tiêu chí + overall band + sửa lỗi + nâng vocab + model answer.
- **Nghe lại** câu đã sửa (`corrections[].corrected`) và `model_answer` bằng giọng đọc TTS (Kokoro) ngay tại màn kết quả — tái dùng pipeline TTS có sẵn, giúp user *nghe* được sự khác biệt thay vì chỉ đọc text.
- Lịch sử session + biểu đồ tiến bộ theo thời gian (local).
- Chế độ "Free talk" luyện phản xạ không chấm điểm.
- Cài đặt: chọn giọng Kokoro, tốc độ, chất lượng model (theo cấu hình máy), ngôn ngữ feedback.

**Mở rộng (product):**
- Tài khoản + đồng bộ đám mây (Supabase).
- Ngân hàng đề theo chủ đề thật + cập nhật.
- Bảng xếp hạng/streak, mục tiêu band, nhắc luyện tập.
- Chế độ luyện phát âm chuyên sâu (phoneme drills).

---

## 6. UI/UX & 3D — ĐỊNH HƯỚNG THIẾT KẾ

- **Concept "phòng thi hiện đại":** không gian tối/gradient sâu, đèn viền, avatar được chiếu sáng như studio. Cảm giác cinematic nhưng tập trung.
- **Audio-reactive:** khi examiner nói → orb/particle nền "thở" theo giọng examiner (màu lạnh); khi user nói → phản ứng theo mic (màu ấm) → phản hồi trực quan rằng "hệ thống đang nghe". **Mặc định ở mức "Calm"** (chuyển động nhẹ, không lấn át) vì đây là công cụ luyện thi cần tập trung, không phải trình diễn thị giác — xem mục 6.1.
- **Setting "Visual intensity": Calm (mặc định) / Cinematic** — Cinematic bật toàn bộ hiệu ứng particle/glow rực rỡ như mô tả gốc, cho user chủ động chọn khi muốn trải nghiệm mãn nhãn hơn thay vì luyện tập nghiêm túc.
- **Micro-interactions:** nút mic có ripple + waveform real-time; chuyển Part có transition mượt; điểm số xuất hiện bằng count-up animation + radar chart 4 tiêu chí.
- **Glassmorphism** cho panel; typography rõ ràng, ưu tiên đọc nhanh subtitle.
- **Trạng thái rõ ràng:** idle / listening / thinking / speaking — avatar + UI đổi theo state machine (XState).
- **Onboarding lần đầu:** màn hình tải model (Kokoro ~80–300MB, STT ~50–250MB) có progress đẹp + giải thích "tải 1 lần, sau đó offline".
- **Accessibility:** subtitle luôn có, contrast tốt, keyboard control, tôn trọng `prefers-reduced-motion`.
- **Thiết bị:** tối ưu cho desktop/laptop; mobile chạy được (WASM fallback) nhưng không được tối ưu/QA riêng ở MVP.

### 6.1 Nguyên tắc thiết kế: 100% bằng code, không dùng công cụ ngoài — kể cả avatar
Toàn bộ asset thị giác của app — icon, hoạ tiết trang trí, design token (màu/spacing/typography), hiệu ứng 3D, particle, GLSL shader audio-reactive, glassmorphism, **và cả avatar giám khảo** — được **Claude Code viết trực tiếp bằng code** (SVG, Tailwind, Three.js/R3F, GLSL). Không dùng Canva, Figma, ảnh stock, công cụ tạo ảnh ngoài, hay mesh 3D ngoài nào (không dùng Ready Player Me).

**Đánh đổi đã chấp nhận:** vì không có mesh người thật đã rig sẵn (đây vốn là loại dữ liệu hình học/rig mà không LLM nào sinh được từ text prompt), avatar giám khảo là **hình khối cách điệu (stylized)** tự dựng bằng Three.js primitives — không phải khuôn mặt người thật. Khớp miệng theo lời nói là **xấp xỉ** (dựa trên amplitude/word-timestamp từ TTS), không phải blendshape viseme chuẩn Oculus. Đổi lại: zero phụ thuộc ngoài, đúng tinh thần "tự làm hết". Có thể nâng cấp lên mesh thật (RPM hoặc tự rig) bất kỳ lúc nào sau này mà không đổi kiến trúc xung quanh.

**Nếu bạn muốn tự thử ý tưởng thiết kế trước khi giao cho Claude Code:** không cần "prompt ở nơi khác rồi dán ảnh về" — vì kết quả cuối là code chứ không phải ảnh để copy. Cách hiệu quả nhất là **mô tả bằng lời** ý tưởng (màu sắc, cảm giác, tham chiếu — vd. "giống phòng thi IELTS thật nhưng tối và cinematic hơn, ánh đèn viền xanh lạnh") ngay trong hội thoại với Claude Code; Claude Code sẽ hiện thực hoá trực tiếp bằng Tailwind/SVG/Three.js và bạn xem kết quả chạy thật trong trình duyệt để tinh chỉnh tiếp — lặp lại vòng "mô tả → code → xem → chỉnh" thay vì vòng "tạo ảnh → chuyển giao ảnh".

---

## 7. MÔ HÌNH DỮ LIỆU (local-first, sẵn sàng lên server)

```ts
// Dexie schema (IndexedDB)
Session {
  id: string; createdAt: number;
  mode: 'part1' | 'part2' | 'part3' | 'full' | 'freetalk';
  topic: string;
  turns: Turn[];              // hội thoại
  metrics: Metrics;
  score?: ScoreResult;        // JSON ở mục 4.5
  audioBlobRefs?: string[];   // tùy chọn lưu audio
}
Turn { role: 'examiner' | 'candidate'; text: string; tStart: number; tEnd: number; }
```
> Thiết kế sao cho **mỗi bảng map 1–1 sang Postgres/Supabase** khi lên product — chỉ cần thêm `userId` và tầng sync.

---

## 8. LỘ TRÌNH BUILD (chia phase cho Claude Code)

- **Phase 0 — Scaffold:** Vite + React + TS + Tailwind; cấu trúc thư mục; `CLAUDE.md`; ESLint/Prettier.
- **Phase 1 — Avatar tĩnh:** dựng avatar procedural (Three.js/R3F, hình khối cách điệu) trong canvas riêng; idle animation (breathing, blink, head sway nhẹ); ánh sáng studio.
- **Phase 2 — Cho avatar nói:** tích hợp HeadTTS(Kokoro) → avatar đọc 1 câu hardcode + khớp miệng xấp xỉ theo amplitude/word-timestamp (avatar không có rig nên không dùng viseme blendshape thật).
- **Phase 3 — Nghe user:** tích hợp STT (Moonshine streaming + Whisper fallback) trong Web Worker → transcript + timestamps.
- **Phase 4 — Bộ não:** Cloudflare Worker proxy giữ `GEMINI_API_KEY` → vòng lặp hội thoại examiner (Part 1). State machine **XState** `idle/listening/thinking/speaking`. Gemini API **streaming** + **progressive TTS** (tách câu, phát ngay câu đầu — mục 4.7) ngay từ phase này, không để dồn lại xử lý sau. Barge-in **không** làm ở phase này (ngoài scope MVP).
- **Phase 5 — Full flow:** Part 1→2→3, cue card + timers, chuyển cảnh.
- **Phase 6 — Chấm điểm:** metrics engine + Scoring mode (JSON + zod) → màn hình kết quả (radar chart, corrections, model answer, nút **nghe lại** corrections/model answer bằng TTS).
- **Phase 7 — Đẹp & mượt:** audio-reactive background (mặc định **Calm**, toggle **Cinematic** trong Settings), Framer Motion, micro-interactions, polish.
- **Phase 8 — Lịch sử & tiến bộ:** Dexie + dashboard biểu đồ.
- **Phase 9 — Hiệu suất & a11y:** Web Workers, ưu tiên WebGPU + fallback WASM, caching model, code-splitting, reduced-motion, keyboard.
- **Phase 10 (sau) — Product:** hardening proxy, thêm Supabase Auth/DB, sync.

> Gợi ý: mỗi phase là 1 mốc chạy được (demo-able). Yêu cầu Claude Code commit theo phase.

---

## 9. HIỆU SUẤT — CHECKLIST

- STT/TTS chạy trong **Web Worker** (không block UI).
- **WebGPU** khi có, **WASM** fallback; cho chọn "chất lượng model" theo máy.
- **Cache** model sau lần tải đầu (Transformers.js tự cache; PWA precache assets).
- GLB avatar nén **Draco/meshopt**; giới hạn poly/texture.
- **Lazy-load** 3D + model; code-split theo route.
- Giới hạn DPR cho canvas trên máy yếu; tạm dừng render khi tab ẩn.

---

## 10. RỦI RO & CÁCH XỬ LÝ

| Rủi ro | Cách xử lý |
|---|---|
| Lộ Anthropic API key nếu gọi từ client | **Bắt buộc** dùng proxy (Cloudflare Worker) giữ key |
| Chấm phát âm từ text là gần đúng | Minh bạch với user; MVP đánh giá định tính; tương lai thêm model phát âm |
| Model tải lần đầu nặng | Onboarding + progress UI + cache; cho chọn model nhỏ |
| WebGPU không có trên máy cũ | Fallback WASM tự động |
| STT sai với giọng có accent | Cho **ghi âm lại**; dùng Whisper base.en cho câu quan trọng |
| Latency trên máy yếu | Tiered model sizes + "quality settings" |

---

## 11. CHI PHÍ (minh bạch)

- **Voice + 3D + STT + TTS + UI:** **$0** (chạy trong máy user).
- **Gemini API (bộ não):** trả theo token, **chỉ text** → rất nhỏ mỗi session (thường vài cent, thậm chí rẻ hơn Claude vì `gemini-3.5-flash-lite` giá $0.30/$2.50 mỗi 1M token input/output). Dùng `gemini-3.5-flash-lite` cho hội thoại, `gemini-3.6-flash` cho báo cáo cuối.
- **Proxy + Hosting:** Cloudflare Workers/Pages **free tier** → gần như $0 cho cá nhân.
- **Chế độ $0 tuyệt đối (tùy chọn):** thay bộ não bằng WebLLM in-browser — đánh đổi chất lượng.

---

## 12. THIẾT LẬP CLAUDE & CLAUDE CODE CHO DỰ ÁN (phần "cài skill")

> **Làm rõ trước:** "Skill" của Claude **không** cài cố định vào bản thân model một lần rồi mạnh mãi. Skill là các **file hướng dẫn (SKILL.md) nạp-theo-nhu-cầu**: Claude tự đọc khi task liên quan, hoặc bạn gọi bằng `/tên-skill`. Điều thực sự giúp "Claude + Claude Code làm việc tốt hơn cho dự án này" là **cấu hình repo đúng cách** dưới đây. Đây là những primitive chính thức của Claude Code: **CLAUDE.md, Skills, Subagents, Slash commands, Hooks, MCP servers** (Plugins = gói gộp các thứ này).

### 12.1 `CLAUDE.md` (hiến pháp của repo) — QUAN TRỌNG NHẤT
File này Claude đọc **mỗi phiên**. Đã tạo sẵn bản khởi đầu kèm theo (`CLAUDE.md`). Đặt ở gốc repo.

### 12.2 Skills nên tạo (đặt ở `.claude/skills/<tên>/SKILL.md`)
- **`r3f-3d`**: quy ước dựng Three.js/React-Three-Fiber, tối ưu GLB, lip-sync viseme, audio-reactive.
- **`ielts-rubric`**: mô tả 4 tiêu chí band descriptors + JSON schema chấm điểm (mục 4.5) để Gemini luôn chấm nhất quán.
- **`ui-design-system`**: design tokens (màu, spacing, typography), quy ước Tailwind + Framer Motion + glassmorphism.
- **`speech-pipeline`**: cách tích hợp Kokoro/HeadTTS + Moonshine/Whisper + Web Worker.
- Ngoài ra, **skill `frontend-design` có sẵn** của Claude rất hợp phần UI — cứ để Claude dùng khi thiết kế giao diện.

> **Thiết kế = code, không cài công cụ thiết kế ngoài.** Toàn bộ nhu cầu hình ảnh/hiệu ứng của dự án (icon, illustration, 3D, shader) được Claude Code viết trực tiếp bằng SVG/Tailwind/Three.js/GLSL thông qua skill `r3f-3d` + `ui-design-system` + skill `frontend-design` có sẵn — không cần cài thêm skill "Claude Design" hay tương tự nào từ cộng đồng. Xem mục 6.1.

### 12.3 Subagents nên tạo (đặt ở `.claude/agents/<tên>.md`)
Subagent chạy trong **context window riêng**, không làm "bẩn" hội thoại chính — hợp cho việc lớn/song song:
- **`frontend-designer`**: chuyên UI/UX + animation.
- **`3d-graphics`**: chuyên Three.js/R3F, shader, lip-sync.
- **`code-reviewer`**: review sau mỗi phase.
- **`test-writer`**: viết test cho metrics engine & scoring parser.

### 12.4 MCP servers (kết nối bạn đang có)
- **Không dùng Canva** cho dự án này — mọi asset thiết kế là code do Claude Code viết trực tiếp (xem mục 6.1). Chỉ cân nhắc Canva nếu có nhu cầu ngoài phạm vi app (vd. thumbnail marketing) và được yêu cầu tại thời điểm đó.
- **Google Drive**: lưu/đọc tài liệu, đề bài, bản plan này (tài liệu, không phải asset thiết kế).
- (Tùy chọn) MCP trình duyệt/test để Claude tự kiểm thử UI.

### 12.5 Model & effort trong Claude Code
- **Sonnet** làm "daily driver" (code, UI, đa số việc).
- **Opus** cho phần cần suy luận sâu (thiết kế kiến trúc, xử lý bug khó, tinh chỉnh prompt chấm điểm).
- Bật effort cao khi giải quyết vấn đề phức tạp.

### 12.6 (Tùy chọn) Hooks & Slash commands
- Hook format/lint tự động sau khi sửa file.
- Slash command `/new-phase` để bắt đầu 1 phase theo lộ trình mục 8.

---

## 13. CÂU LỆNH KHỞI ĐỘNG GỢI Ý CHO CLAUDE CODE

> Sau khi `git init` và đặt `CLAUDE.md` vào gốc repo, có thể mở đầu bằng:

```
Đọc CLAUDE.md và file IELTS_Speaking_AI_Plan.md. Bắt đầu Phase 0:
scaffold Vite + React + TS + Tailwind, tạo cấu trúc thư mục theo plan,
tạo các skill trong .claude/skills/ (r3f-3d, ielts-rubric, ui-design-system,
speech-pipeline) và subagents trong .claude/agents/ (frontend-designer,
3d-graphics, code-reviewer, test-writer). Commit khi xong Phase 0.
```

---

## 14. TÓM TẮT NHANH

- **Stack miễn phí, in-browser:** avatar procedural Three.js/R3F (không mesh ngoài) · HeadTTS/Kokoro (giọng) · Moonshine+Whisper (nghe) · **Gemini API** (bộ não, đổi từ Claude API 2026-07-22 — mục 1.2) · Three.js audio-reactive (hiệu ứng) · XState (state machine).
- **Chi phí:** voice/3D = $0; Gemini API = vài cent/session (text).
- **Bảo mật:** proxy Cloudflare Worker giữ key.
- **Kiến trúc local-first**, mở rộng lên product bằng Supabase mà không đập đi làm lại.
- **Chất lượng UX (sau review, mục 1.1):** streaming + progressive TTS để giảm khoảng lặng giữa lượt hội thoại; visual mặc định "Calm", "Cinematic" là tùy chọn; desktop-first; barge-in để sau MVP.
- **Thiết kế = code**, không dùng công cụ ngoài (Canva/Figma/ảnh stock) — xem mục 6.1.
- **Claude Code setup:** CLAUDE.md + 4 skills + 4 subagents + Sonnet/Opus + MCP Google Drive (tài liệu).

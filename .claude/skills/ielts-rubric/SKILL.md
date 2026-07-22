---
name: ielts-rubric
description: Use when implementing or touching the IELTS Speaking scoring logic — the Claude scoring-mode prompt, the metrics engine (WPM, fillers, pauses, vocab diversity), the scoring JSON schema/zod validation, or anything rendering band scores/feedback in the UI. Ensures scoring stays consistent with the official 4-criteria rubric.
---

# IELTS Speaking — quy tắc chấm điểm nhất quán

## 4 tiêu chí chính thức (band 0–9, làm tròn 0.5)
1. **Fluency & Coherence (FC)** — tốc độ nói tự nhiên, liên kết ý, dùng discourse markers hợp lý, không quá nhiều ngập ngừng/lặp.
2. **Lexical Resource (LR)** — độ đa dạng từ vựng, dùng từ chính xác theo ngữ cảnh, idiomatic language, paraphrase khi thiếu từ.
3. **Grammatical Range & Accuracy (GRA)** — đa dạng cấu trúc câu (đơn/ghép/phức), độ chính xác ngữ pháp, tần suất lỗi.
4. **Pronunciation (P)** — ⚠️ chấm từ transcript + audio metrics là **gần đúng**, không phải phân tích phoneme thật. Luôn gắn nhãn `"note": "approx from transcript+audio"` trong output, không bao giờ trình bày như điểm chính xác tuyệt đối.

`overall_band` = trung bình cộng 4 tiêu chí, làm tròn đến 0.5 gần nhất.

## Metrics client-side (bằng chứng cho Claude chấm, không phải để tự chấm)
Tính từ transcript + word timestamps của STT:
- `words_per_minute` — proxy cho fluency.
- `filler_count` — đếm "um", "uh", "like", "you know"...
- `avg_pause_ms`, `long_pause_count` — từ khoảng trống giữa các timestamp.
- `vocab_diversity` — type–token ratio.
- `sentence_length_variation`.

Các metrics này **luôn được gửi kèm transcript** trong request scoring — không để Claude chấm "cảm tính" chỉ từ text thô.

## JSON schema đầu ra (Scoring mode) — bắt buộc đúng shape này
```json
{
  "overall_band": 6.5,
  "criteria": {
    "fluency_coherence": { "band": 6, "evidence": "", "issues": [], "tips": [] },
    "lexical_resource": { "band": 7, "evidence": "", "issues": [], "tips": [] },
    "grammatical_range_accuracy": { "band": 6, "evidence": "", "issues": [], "tips": [] },
    "pronunciation": { "band": 6, "note": "approx from transcript+audio", "issues": [], "tips": [] }
  },
  "metrics": { "words_per_minute": 118, "filler_count": 9, "avg_pause_ms": 850, "vocab_diversity": 0.42 },
  "corrections": [{ "original": "", "corrected": "", "explanation": "" }],
  "vocabulary_upgrades": [{ "used": "good", "upgrade": "compelling", "example": "" }],
  "model_answer": "A band 8 sample answer to the same question…",
  "actionable_next_steps": [""]
}
```
- Validate response bằng **zod** trước khi render — không bao giờ render JSON chưa qua validate.
- Ép Claude trả **CHỈ JSON**, không markdown/code fence, không lời mở đầu — parse trực tiếp.
- Nếu user chọn feedback tiếng Việt: `evidence`/`issues`/`tips`/`explanation` có thể tiếng Việt, nhưng `model_answer` luôn giữ tiếng Anh.

## Hai chế độ của Claude — đừng lẫn lộn
- **Conversation mode**: đóng vai examiner, KHÔNG sửa lỗi giữa chừng, hỏi ngắn gọn, đúng flow Part 1/2/3 và thời gian chuẩn.
- **Scoring mode**: chỉ chạy sau mỗi Part/cả session, nhận transcript+metrics, trả JSON theo schema trên. Hai system prompt này phải tách biệt, không dùng chung 1 prompt cho cả hai việc.

## Cấu trúc bài thi cần mô phỏng đúng timing
- Part 1: 4–5 phút, Q&A ngắn chủ đề quen thuộc.
- Part 2: cue card, 1 phút chuẩn bị, nói 1–2 phút, có follow-up.
- Part 3: 4–5 phút, thảo luận trừu tượng liên quan Part 2.

## Vị trí code
Logic scoring + metrics engine đặt trong `src/features/scoring/`; zod schema nên định nghĩa một lần và tái dùng cho cả validate response lẫn type inference (TypeScript) — không tạo type trùng lặp tay bằng interface riêng.

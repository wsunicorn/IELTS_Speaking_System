---
name: ui-design-system
description: Use when building or styling any React/DOM UI in this project — panels, buttons, subtitles, timers, score screens, settings. Covers Tailwind + shadcn/ui token conventions, the "modern exam room" visual concept, glassmorphism rules, Framer Motion micro-interactions, and accessibility requirements.
---

# UI Design System — "phòng thi hiện đại"

## Concept
Không gian tối, gradient sâu, đèn viền, avatar được chiếu sáng như studio — cảm giác cinematic nhưng tập trung, không lòe loẹt. App mặc định **dark theme** (`<html class="dark">`), không có toggle sáng/tối trừ khi được yêu cầu thêm.

## Token & styling
- Dùng token màu chuẩn của shadcn/ui đã cấu hình trong `src/index.css` (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, v.v.) — không tự chế màu hex rời rạc trong component.
- Component có sẵn: `src/components/ui/` (shadcn). Thêm component mới bằng `npx shadcn@latest add <name>` thay vì tự viết lại từ đầu Radix primitives.
- Bo góc, spacing, radius dùng theo `--radius-*` đã định nghĩa trong theme — giữ nhất quán toàn app.

## Glassmorphism (cho panel nổi: điểm số, settings, cue card)
- `bg-card/60 backdrop-blur-xl border border-border/50` là điểm khởi đầu hợp lý — tinh chỉnh theo từng panel, không lạm dụng blur nặng gây giật máy yếu.
- Panel nổi trên nền audio-reactive cần đủ tương phản để đọc được subtitle/text — ưu tiên đọc nhanh hơn hiệu ứng.

## Framer Motion — micro-interactions
- Nút mic: ripple + waveform real-time khi đang nghe.
- Chuyển Part (1→2→3): transition mượt (fade/slide), không giật.
- Điểm số: count-up animation cho band number + radar chart cho 4 tiêu chí khi vào màn kết quả.
- Mọi animation trang trí phải tôn trọng `prefers-reduced-motion` (tắt/giảm hẳn khi user bật); animation mang thông tin (vd. thay đổi trạng thái mic) vẫn giữ nhưng rút ngắn duration.

## Trạng thái rõ ràng
UI phải phản ánh đúng state machine `idle | listening | thinking | speaking` — không suy luận trạng thái từ nhiều nguồn khác nhau trong component, luôn đọc từ state machine trung tâm.

## Accessibility (bắt buộc, không tùy chọn)
- Subtitle luôn có sẵn (bật/tắt được, không mặc định ẩn hẳn khỏi user không nghe được).
- Contrast đủ chuẩn WCAG AA trên nền tối.
- Toàn bộ tương tác chính (mic, chuyển part, xem điểm) phải dùng được bằng bàn phím.

## Vị trí code
Component dùng chung đặt ở `src/components/ui/` (shadcn) hoặc `src/components/` cho composite. Component đặc thù một feature (vd. cue-card timer) colocate trong `src/features/<feature>/`, không đặt lẫn vào `components/ui/`.

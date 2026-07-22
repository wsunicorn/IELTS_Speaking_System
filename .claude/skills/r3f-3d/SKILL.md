---
name: r3f-3d
description: Use when building or modifying the 3D avatar layer — TalkingHead integration, Ready Player Me GLB loading, viseme lip-sync wiring, the audio-reactive background canvas, or any Three.js/React-Three-Fiber code in this project. Covers the 3-layer render architecture, GLB optimization, and performance rules for the 3D scene.
---

# R3F / Three.js — quy ước dựng cảnh 3D

## Kiến trúc 3 lớp (bắt buộc — xem CLAUDE.md)
1. **Background canvas** — audio-reactive shader/particles, phản ứng theo `AnalyserNode` của giọng examiner (màu lạnh) hoặc user (màu ấm).
2. **Avatar canvas** — TalkingHead (met4citizen) render GLB của Ready Player Me, ở giữa.
3. **UI overlay (DOM)** — React thường, không phải Three.js.

**Không bao giờ gộp 2 scene Three.js làm một.** Mỗi canvas có `<Canvas>` R3F riêng hoặc TalkingHead tự quản lý renderer riêng — tránh xung đột render loop, lighting, camera.

## TalkingHead + Ready Player Me
- Avatar GLB tải từ Ready Player Me (`.glb`), dùng chuẩn Oculus visemes (TalkingHead hỗ trợ sẵn).
- Lip-sync ăn trực tiếp viseme + word timestamps do HeadTTS/Kokoro xuất ra — không tự tính viseme bằng tay.
- Idle animation nhẹ (breathing, blink, micro head-move) khi ở trạng thái `idle`/`listening`; chuyển animation theo state machine `idle | listening | thinking | speaking`.
- Ánh sáng kiểu studio: 1 key light, 1 fill light nhẹ, tránh light phẳng gây avatar trông giả.

## Audio-reactive background
- Dùng Web Audio `AnalyserNode` lấy amplitude/frequency real-time — không polling bằng setInterval tách rời audio clock.
- Shader/particle phản ứng nên là GLSL viết tay hoặc leaf-shader nhỏ; tránh phụ thuộc nặng ngoài three.js core + R3F.
- Giới hạn DPR (`Math.min(window.devicePixelRatio, 2)`) trên máy yếu; tạm dừng render loop khi tab ẩn (`document.visibilityState`).

## Hiệu suất & GLB
- Nén GLB bằng Draco hoặc meshopt trước khi đưa vào `public/` hoặc CDN.
- Giới hạn poly count và texture resolution cho avatar (ưu tiên mượt hơn chi tiết).
- Lazy-load model 3D (dynamic import) — không đưa vào bundle chính.
- Tôn trọng `prefers-reduced-motion`: giảm/tắt animation trang trí (particles, camera drift), giữ lại lip-sync vì đó là nội dung, không phải trang trí.

## Vị trí code
Đặt logic 3D trong `src/features/avatar/` (TalkingHead + RPM) và phần audio-reactive trong `src/features/avatar/` hoặc một feature riêng nếu tách biệt đủ lớn — không rải code Three.js vào `src/components/ui/`.

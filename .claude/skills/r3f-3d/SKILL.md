---
name: r3f-3d
description: Use when building or modifying the 3D avatar layer — the procedural examiner bust (geometry, materials, idle animation), approximate mouth-sync driven by TTS timing data, the audio-reactive background canvas, or any Three.js/React-Three-Fiber code in this project. Covers the 3-layer render architecture and performance rules for the 3D scene.
---

# R3F / Three.js — quy ước dựng cảnh 3D

## Nguồn asset: 100% code, không có ngoại lệ
Avatar, ánh sáng, animation, camera work, particle, shader — tất cả viết bằng code (Three.js/R3F/GLSL), không dùng mesh/GLB từ nguồn ngoài (không Ready Player Me, không mesh mua/tải sẵn nào). Avatar giám khảo là **hình khối cách điệu (stylized)** tự dựng bằng primitives (sphere/box/capsule...) + material, không phải mesh người thật đã rig. Xem lý do và đánh đổi ở plan mục 6.1.

## Kiến trúc 3 lớp (bắt buộc — xem CLAUDE.md)
1. **Background canvas** — audio-reactive shader/particles, phản ứng theo `AnalyserNode` của giọng examiner (màu lạnh) hoặc user (màu ấm).
2. **Avatar canvas** — `ExaminerBust` procedural, ở giữa.
3. **UI overlay (DOM)** — React thường, không phải Three.js.

**Không bao giờ gộp 2 scene Three.js làm một.** Mỗi canvas có `<Canvas>` R3F riêng — tránh xung đột render loop, lighting, camera.

## Avatar procedural — quy ước dựng
- Dựng từ primitives đơn giản (đầu: sphere/rounded box hơi dẹt; mắt: disc/sphere nhỏ; miệng: plane/rounded box có thể scale theo trục Y; thân/vai: cone/cylinder cụt) — ưu tiên hình khối mượt, tối giản, tránh cố bắt chước khuôn mặt người thật (dễ rơi vào uncanny valley khi làm bằng primitives). Phong cách: trừu tượng-tinh tế hơn là hoạt hình trẻ con.
- Trang phục gợi ý "công sở" bằng màu sắc/hình khối đơn giản (vd. cổ áo blazer màu tối), không cần chi tiết vải/nếp gấp.
- **Khớp miệng xấp xỉ** ở Phase 2+: scale trục Y của mesh miệng theo audio amplitude (Web Audio `AnalyserNode` trên track TTS) hoặc theo word-timestamp do HeadTTS xuất ra — không có blendshape viseme thật vì không có rig. Nói rõ trong UI/docs đây là xấp xỉ nếu liên quan đến việc trình bày cho user.
- Idle animation nhẹ khi ở trạng thái `idle`/`listening`: breathing (scale/position dao động nhỏ ở thân), blink (scale mắt theo chu kỳ ngẫu nhiên 2-6s), head sway rất nhẹ (rotation dao động biên độ nhỏ). Chuyển animation theo state machine XState `idle | listening | thinking | speaking`.
- Ánh sáng kiểu studio: 1 key light, 1 fill light nhẹ, có thể thêm rim light để tách avatar khỏi nền tối — tránh light phẳng gây avatar trông dẹt/giả.

## Audio-reactive background
- Dùng Web Audio `AnalyserNode` lấy amplitude/frequency real-time — không polling bằng setInterval tách rời audio clock.
- Shader/particle phản ứng nên là GLSL viết tay hoặc leaf-shader nhỏ; tránh phụ thuộc nặng ngoài three.js core + R3F.
- Mặc định mức **Calm** (biên độ/tần suất chuyển động thấp), mức **Cinematic** là tùy chọn Settings — xem `ui-design-system` skill.
- Giới hạn DPR (`Math.min(window.devicePixelRatio, 2)`) trên máy yếu; tạm dừng render loop khi tab ẩn (`document.visibilityState`).

## Hiệu suất
- Hình học procedural nên dùng geometry đơn giản, số lượng mesh/segment thấp — không cần ngân sách poly như mesh nhập khẩu, nhưng vẫn tránh tạo geometry mới mỗi frame trong `useFrame` (dùng ref, không alloc lại).
- Lazy-load scene 3D (dynamic import) — không đưa Three.js vào bundle chính nếu route/feature chưa cần.
- Tôn trọng `prefers-reduced-motion`: giảm/tắt animation trang trí (particles, camera drift, head sway), giữ lại chuyển động miệng khi nói vì đó là nội dung (subtitle vẫn luôn có sẵn song song), không phải trang trí.

## Vị trí code
Đặt logic 3D trong `src/features/avatar/` (component `ExaminerBust`, hooks `useIdleAnimation`, `useMouthSync`, setup ánh sáng) và phần audio-reactive trong cùng feature hoặc tách riêng nếu đủ lớn — không rải code Three.js vào `src/components/ui/`.

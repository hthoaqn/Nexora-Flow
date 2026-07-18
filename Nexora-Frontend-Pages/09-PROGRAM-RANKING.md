# Trang screening và xếp hạng

## Route

`/programs/:programId/ranking`

## API

- `POST /api/programs/{programId}/screening-runs`
- `GET /api/screening-runs/{runId}`
- `POST /api/screening-runs/{runId}/retry`
- `GET /api/programs/{programId}/results`

## Chạy screening

- Chọn hồ sơ đã confirmed hoặc yêu cầu Backend chạy toàn bộ hồ sơ đủ điều kiện.
- Gửi `applicationIds` và reason: `profile_updated`, `rubric_updated`, `reviewer_requested`, `model_changed`.
- Khóa CTA sau lần bấm đầu để tránh tạo run trùng.

## Run progress

- Trạng thái QUEUED, PROCESSING, COMPLETED, FAILED.
- Progress, message, attempt, result IDs và errors.
- Poll có khoảng nghỉ hợp lý và dừng ở trạng thái cuối.
- Chỉ retry run FAILED hoặc stale khi Backend cho phép.
- Nếu COMPLETED nhưng `errors` không rỗng, hiển thị “Hoàn thành một phần”.

## Bảng ranking

- Startup name.
- Eligible.
- AI score, reviewer score, final score.
- Final score source.
- Confidence.
- Classification.
- Application completeness.
- Requires verification.
- CTA mở result detail.

## Filter và pagination

- `minScore`, `eligible`, `limit`, `cursor`.
- Đổi filter reset cursor.
- Dùng `finalScore` Backend trả; không tự tính hoặc sort theo field khác rồi gọi là ranking chính thức.

## Nghiệm thu

- Score và confidence tách riêng.
- Hard-filter fail không tự chuyển REJECTED.
- Run lỗi một phần không bị che giấu.
- Double-click không tạo nhiều request phía client.


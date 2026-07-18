# Trang chi tiết và xác nhận hồ sơ

## Route

`/applications/:applicationId`

## API

- `GET /api/applications/{applicationId}`
- `PATCH /api/applications/{applicationId}/confirm`
- `PATCH /api/applications/{applicationId}/workspace`
- `PATCH /api/applications/{applicationId}/consent`
- `GET /api/applications/{applicationId}/screening-results`

## Mục tiêu

Cho reviewer kiểm tra nguồn dữ liệu, xác nhận profile chuẩn, ghi chú nội bộ và xem lịch sử screening.

## Khu vực nội dung

### 1. Header và provenance

- Startup name, status, program, source.
- File metadata, duplicate warning.
- Extraction provider/model/prompt/duration/error.
- Profile version, confirmed time và latest result.

### 2. Ba lớp dữ liệu

- Submitted profile: thường rỗng trong file-only MVP.
- AI profile: value, confidence, evidence quote/page.
- Confirmed profile: form dữ liệu chuẩn để screening.

Không điền dữ liệu submitted giả. Không biến AI value thành confirmed nếu chưa có thao tác con người.

### 3. Confirmation

- Hiển thị required fields.
- Chặn confirm khi thiếu.
- Country/foundedYear optional.
- Sau confirm reload detail, list và summary.

### 4. Workspace nội bộ

- Assigned reviewer IDs.
- Internal notes.
- Lưu độc lập với confirmed profile.
- Không bao giờ đưa notes ra public.

### 5. Consent

- Matching opt-in, policy version và thời điểm cập nhật.
- Consent độc lập với confirmation và decision.

### 6. Screening history

- Danh sách result theo thời gian.
- Reason, score source, classification, model/rubric version.
- CTA mở result cụ thể.

## Trạng thái đặc biệt

- Extraction failed: hiển thị lỗi và hướng dẫn upload lại; không tạo nút retry giả.
- Missing required fields: không cho screening.
- 404 tenant-safe: không tiết lộ hồ sơ tồn tại ở organization khác.

## Nghiệm thu

- Evidence mở được theo field.
- AI và confirmed phân biệt rõ.
- Internal notes không xuất hiện public.
- Lịch sử result không bị thay bằng latest result duy nhất.


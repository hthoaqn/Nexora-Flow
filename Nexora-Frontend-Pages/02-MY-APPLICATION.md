# Trang theo dõi và xác nhận hồ sơ của applicant

## Route

`/my-application/:applicationId`

## Mục tiêu

Cho applicant xem trạng thái extraction, kiểm tra dữ liệu AI, sửa profile chuẩn và quản lý consent.

## API

- `GET /api/public/applications/{applicationId}`
- `PATCH /api/public/applications/{applicationId}/confirm`
- `PATCH /api/public/applications/{applicationId}/consent`

Mọi request gửi `X-Application-Token`. Nếu session không còn token, hiển thị ô nhập token ngay trên trang.

## Nội dung trang

### Trạng thái

- Application ID dạng rút gọn.
- Tên file, trạng thái, thời gian tạo/cập nhật.
- Extraction provider, thời gian xử lý và lỗi nếu có.

### Dữ liệu AI

- Mỗi field hiển thị value, confidence, evidence quote và page nếu có.
- Trường thiếu được đánh dấu rõ.
- Không coi confidence là score.

### Form xác nhận

- Cho sửa và gửi `confirmedProfile`.
- Required fields lấy từ chương trình.
- Chặn gửi nếu profile rỗng hoặc thiếu trường bắt buộc.
- Country và foundedYear là optional; không tự suy đoán.

### Consent

- Hiển thị trạng thái opt-in, policy version và lần cập nhật gần nhất.
- Bật/tắt độc lập với xác nhận profile.

## Sau thao tác

- Sau confirm: reload application, profile version và status.
- Sau consent: chỉ reload consent-related data.
- Giữ form khi request lỗi.

## Không được hiển thị

- Score, ranking, reviewer, internal notes, rawInput.
- Screening result nội bộ hoặc quyết định nội bộ.
- Matching, investor, message hoặc startup portal.

## Nghiệm thu

- Token sai nhận 401 và không lộ dữ liệu.
- AI profile và confirmed profile phân biệt rõ.
- Applicant xác nhận được required fields.
- Public response không chứa dữ liệu hồ sơ khác.


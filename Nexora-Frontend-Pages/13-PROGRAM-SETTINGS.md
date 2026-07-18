# Trang chỉnh sửa chương trình

## Route

`/programs/:programId/settings`

## Người dùng

Owner.

## API

- `GET /api/programs/{programId}`
- `PATCH /api/programs/{programId}`

## Nội dung

Dùng cùng cấu trúc form với trang tạo:

- Name, objective, description.
- Industries, stages, locations.
- Deadline, expected selections, status.
- Hard filters và required fields.
- Rubric type, version, completeness mode.
- Criteria, weights, anchors, included/excluded signals.
- Classification bands, stage configurations và fallback.

## Hành vi cập nhật

- Chỉ gửi field thay đổi.
- Hiển thị program version hiện tại.
- Cảnh báo thay profile requirements hoặc rubric có thể yêu cầu rerun screening.
- Sau thay rubric, CTA hợp lệ ở ranking dùng reason `rubric_updated`.
- Sau lưu reload program, overview và program list.

## Validation

- Giống trang tạo chương trình.
- Tổng weight bằng 100.
- Anchor phủ 0–100, không hở/chồng.
- Stage-based có configuration hợp lệ.
- Không submit khi dữ liệu invalid.

## Không xây

- Xóa chương trình.
- Rotate/revoke submission token.
- Member permission cho riêng program.
- Matching/library configuration.

## Nghiệm thu

- Reviewer không sửa được.
- Lỗi 409/422 không làm mất form.
- Program version và rubric version hiển thị rõ.
- Thay rubric không tự sửa kết quả screening cũ.


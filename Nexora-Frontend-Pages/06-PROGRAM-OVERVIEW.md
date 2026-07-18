# Trang tổng quan chương trình

## Route

`/programs/:programId/overview`

## API

- `GET /api/programs/{programId}`
- `GET /api/programs/{programId}/summary`

## Mục tiêu

Cho owner/reviewer nắm trạng thái chương trình và đi nhanh tới các quy trình chính.

## Nội dung trang

### Header chương trình

- Name, status, objective, deadline.
- Program version và rubric version.
- CTA settings chỉ dành cho owner.

### Summary

- Total applications.
- Status counts.
- Total screening results.
- Verified opt-in profiles.

Summary phải lấy từ endpoint summary, không tự cộng từ một page application.

### Public submission

- Link chứa submission token chỉ hiện cho người dùng nội bộ.
- Nút sao chép có xác nhận trực quan.
- Không gửi token vào analytics/log.
- Không hiển thị nút rotate vì Backend chưa hỗ trợ.

### Điều hướng nghiệp vụ

- Applications và reviewer upload.
- Run screening/ranking.
- Compare.
- Audit và CSV export.
- Program settings.

## Trạng thái

- Program 404: quay về list an toàn.
- Summary lỗi nhưng program tải được: hiển thị partial error, không khóa toàn trang.
- DRAFT/CLOSED/ARCHIVED: CTA public upload phải phản ánh trạng thái.

## Nghiệm thu

- Summary không bị sai do pagination.
- Quyền owner/reviewer hiển thị đúng.
- Không có moderation, matching hoặc library readiness.


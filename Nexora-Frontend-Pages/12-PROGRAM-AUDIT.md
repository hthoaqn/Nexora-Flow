# Trang audit và export

## Route

`/programs/:programId/audit`

## API

- `GET /api/programs/{programId}/audit-events`
- `GET /api/programs/{programId}/export`

## Audit events

- Timestamp.
- Action được chuyển thành nhãn dễ hiểu.
- Actor ID dạng rút gọn.
- Application reference nếu có.
- Metadata an toàn, có thể mở chi tiết.
- Cursor pagination.

Không hiển thị raw deck, token, secret, stack trace hoặc internal content không cần thiết.

## Filter/search

- Nếu Backend chưa hỗ trợ filter, chỉ cho lọc dữ liệu đã tải và ghi rõ phạm vi.
- Không giả là tìm kiếm toàn bộ lịch sử.
- Đổi program phải xóa audit cache cũ.

## CSV export

- Một CTA “Xuất CSV”.
- Hiển thị loading, thành công và lỗi download.
- Dùng filename từ response nếu an toàn.
- Không quảng bá Excel, PDF hoặc JSON export khi Backend chưa hỗ trợ.

## Empty và lỗi

- Empty: chưa có activity event.
- 403/404: không lộ program khác tenant.
- Export lỗi: không ảnh hưởng audit list.

## Nghiệm thu

- Cursor hoạt động.
- Audit cập nhật sau confirm, screening, override, verification và decision.
- CSV không chứa rawInput, applicant token hoặc internal deck content.


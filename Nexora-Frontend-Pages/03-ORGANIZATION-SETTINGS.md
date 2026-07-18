# Trang thông tin tổ chức

## Route

`/settings/organization`

## Người dùng

- Owner: xem và chỉnh sửa.
- Reviewer: chỉ xem.

## API

- `GET /api/organizations/me`
- `PUT /api/organizations/me`

## Nội dung trang

- Tên tổ chức.
- Website.
- Mô tả.
- User ID, email và role ở chế độ chỉ đọc.
- Nút lưu chỉ hiện/hoạt động với owner.

## Hành vi

- Validate tên 2–200 ký tự.
- Website tối đa 500 ký tự.
- Mô tả tối đa 2.000 ký tự.
- Sau lưu cập nhật organization context và vô hiệu cache liên quan.
- Nếu reviewer cố sửa, Frontend chặn trước và vẫn xử lý đúng 403 từ Backend.

## Empty và lỗi

- Organization chưa có dữ liệu: hiển thị form trống cho owner.
- 401/403: hiển thị trạng thái quyền.
- 422: gắn lỗi đúng field.
- 5xx: giữ nguyên input người dùng.

## Không xây

- Member list, invite user, sửa role.
- Billing hoặc subscription.
- Organization switcher nếu chưa có Backend hỗ trợ.

## Nghiệm thu

- Owner lưu được thông tin.
- Reviewer không thấy CTA lưu.
- Không hiển thị Supabase secret hoặc metadata xác thực nhạy cảm.


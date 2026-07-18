# Trang danh sách chương trình

## Route

`/programs`

## Mục tiêu

Cho người dùng nội bộ xem các chương trình thuộc organization và mở workspace tương ứng.

## API

`GET /api/programs?limit={limit}&cursor={cursor}`

## Nội dung trang

- Tên chương trình.
- Trạng thái DRAFT, OPEN, CLOSED hoặc ARCHIVED.
- Deadline.
- Expected selections.
- Program version và thời gian cập nhật.
- CTA mở overview.
- CTA tạo chương trình chỉ dành cho owner.

## Phân trang

- Dùng `items`, `nextCursor`, `hasMore`.
- Không tải toàn bộ để giả server search.
- Nếu có search/filter phía client, ghi rõ chỉ tìm trong dữ liệu đã tải.

## Trạng thái

- Loading: skeleton hàng, không hiển thị tổng 0 giả.
- Empty: owner thấy CTA tạo chương trình; reviewer thấy thông báo chưa có chương trình.
- Error: cho tải lại.
- 403/404: không giữ dữ liệu tenant cũ.

## Nghiệm thu

- Chỉ hiển thị chương trình đúng tenant.
- Cursor hoạt động và không lặp record.
- Reviewer không thấy CTA tạo.
- Không có trang/library/matching shortcut.


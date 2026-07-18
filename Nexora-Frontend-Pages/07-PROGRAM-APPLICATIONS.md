# Trang hàng đợi hồ sơ

## Route

`/programs/:programId/applications`

## API

- `GET /api/programs/{programId}/applications`
- `POST /api/programs/{programId}/applications/upload`

## Query hỗ trợ

- `status`
- `industry`
- `stage`
- `missingData`
- `limit`, `cursor`

## Nội dung danh sách

- Startup name hoặc “Chưa xác định”.
- File name và source.
- Status.
- Industry và stage.
- Missing-data indicator.
- Profile version và updated time.
- Duplicate warning từ file metadata.
- CTA mở `/applications/:applicationId`.

## Upload nội bộ

- PDF, DOCX, PNG, JPG, WebP.
- Tối đa 5 file, 15 MB/file, 50 MB/request.
- Gửi từng request tuần tự; không tạo nhiều batch song song.
- Hiển thị partial success theo từng file.

## Hành vi filter

- Đổi filter phải reset cursor.
- URL có thể giữ filter không nhạy cảm.
- Không để dữ liệu tenant/program cũ xuất hiện khi đổi context.

## Trạng thái

- Empty theo từng filter và empty toàn program phải khác nhau.
- Extraction lỗi vẫn có thể xuất hiện dưới trạng thái NEEDS_REVIEW; hiển thị cảnh báo.
- Backend chưa có retry extraction: CTA hợp lệ là upload lại file.

## Nghiệm thu

- List không chứa rawInput hoặc applicant token.
- Cursor và filter hoạt động cùng nhau.
- Upload lỗi không làm mất file thành công.
- Không có bulk delete.


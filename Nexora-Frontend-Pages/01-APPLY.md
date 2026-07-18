# Trang nộp hồ sơ công khai

## Route

`/apply/:submissionToken`

## Mục tiêu

Cho startup xem thông tin chương trình và upload một hoặc nhiều pitch deck mà không cần tài khoản.

## API

- `GET /api/public/programs/{submissionToken}`
- `POST /api/public/programs/{submissionToken}/applications/upload`

## Nội dung trang

### Thông tin chương trình

- Tên, mục tiêu và mô tả.
- Ngành ưu tiên, stage chấp nhận, địa điểm.
- Deadline, expected selections và required fields.
- Giải thích ngắn quy trình AI extraction → human confirmation → human review.

### Upload

- Kéo-thả hoặc chọn PDF, DOCX, PNG, JPG, WebP.
- Tối đa 5 file, 15 MB/file, 50 MB/request.
- Danh sách file gồm tên, loại, dung lượng, trạng thái và nút bỏ file trước khi gửi.
- Consent cơ hội tương lai mặc định tắt.
- Chặn submit khi sai định dạng, quá số lượng hoặc quá dung lượng.

### Kết quả

- Hiển thị `accepted`, `failed` và kết quả riêng từng file.
- File thành công có `applicationId`, trạng thái và CTA theo dõi hồ sơ.
- File lỗi giữ nguyên để người dùng thử lại.
- Duplicate phải được hiển thị như cảnh báo, không gọi là lỗi nếu Backend vẫn nhận.

## Applicant token

- Token chỉ được Backend trả một lần.
- Lưu theo `applicationId` trong `sessionStorage`.
- Cho sao chép thủ công một lần và cảnh báo không có API khôi phục token.
- Không đưa token vào URL, analytics, log hoặc error monitoring.

## Trạng thái đặc biệt

- 404: link không hợp lệ hoặc chương trình không mở.
- 410: hết hạn, khóa upload.
- 413/422: chỉ rõ file hoặc điều kiện bị vi phạm.
- 429: hiển thị yêu cầu chờ.
- Partial success: không xóa kết quả file thành công.

## Nghiệm thu

- Không cần tài khoản startup.
- Consent mặc định false.
- Giới hạn file được kiểm tra trước request.
- Applicant token không xuất hiện trong URL.
- Không hiển thị ranking, score, reviewer hoặc dữ liệu nội bộ.


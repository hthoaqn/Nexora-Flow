# Trang so sánh hồ sơ

## Route

`/programs/:programId/compare`

## API

`POST /api/programs/{programId}/compare`

## Mục tiêu

Cho reviewer chọn và so sánh từ 2 đến 5 hồ sơ trong cùng chương trình.

## Khu vực chọn hồ sơ

- Chỉ chọn application thuộc program hiện tại.
- Chặn dưới 2 hoặc trên 5.
- Hiển thị startup name, status và latest score khi có.
- Không tự gửi request mỗi lần tick; có CTA “So sánh”.

## Bảng so sánh

- Confirmed profile chính.
- Eligible và hard-filter results.
- AI/reviewer/final score và score source.
- Confidence, classification và completeness.
- Criteria raw/weighted score.
- Missing data, conflicts và verification status.
- Link tới application detail và result detail.

## Trường hợp thiếu result

- Hiển thị “Chưa screening”.
- Không thay bằng score 0.
- Không loại hồ sơ khỏi bảng nếu Backend trả application hợp lệ nhưng result rỗng.

## Quy tắc

- Không tự tính tổng điểm ở Frontend.
- Không biến compare thành quyết định tự động.
- Không hiển thị dữ liệu khác tenant/program.

## Nghiệm thu

- Backend từ chối danh sách không đúng 2–5 được hiển thị rõ.
- Thứ tự hồ sơ giữ theo lựa chọn người dùng.
- Hồ sơ chưa có result không bị hiểu là yếu nhất.


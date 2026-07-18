# Quy tắc chung cho tất cả trang Nexora

## Bối cảnh sản phẩm

Nexora Intake phục vụ owner và reviewer của chương trình startup. AI chỉ hỗ trợ trích xuất và screening; con người xác nhận dữ liệu và đưa ra quyết định cuối cùng.

## Quy tắc dữ liệu bắt buộc

- Dùng API Backend, không tạo dữ liệu giả trong production.
- Mọi request private phải có bearer token do lớp xác thực hiện có cung cấp.
- Cache phải tách theo `organizationId` và `programId`.
- Không tin filter từ client để phân quyền; Backend quyết định tenant access.
- Không ghi applicant token, submission token, raw deck hoặc internal notes vào analytics/log.
- Logout hoặc đổi organization phải xóa toàn bộ tenant cache và dữ liệu nhạy cảm.

## Quy tắc AI và điểm

- `aiScore`: điểm AI ban đầu.
- `reviewerScore`: điểm reviewer override, có thể rỗng.
- `finalScore`: điểm dùng để ranking do Backend trả.
- `confidence`: độ tin cậy dữ liệu, không phải điểm chất lượng.
- `eligible`: kết quả hard filter và required fields, không phải quyết định nhận/từ chối.
- `classification`: nhãn hỗ trợ review, không phải quyết định.
- `advisorySignals.decisionImpact` luôn là `none`.
- Không tự tính lại, cộng hoặc trừ bất kỳ điểm nào ở Frontend.

## Trạng thái chung

Mỗi trang phải có:

- Loading bằng skeleton hoặc progress thật; không dùng số 0 giả khi đang tải.
- Empty state giải thích nguyên nhân và CTA hợp lệ.
- Error state giữ dữ liệu người dùng đã nhập.
- Permission state cho 401/403.
- Partial success cho upload hoặc screening có một phần lỗi.
- Retry chỉ áp dụng cho thao tác an toàn hoặc được Backend hỗ trợ.

## Mapping lỗi

| HTTP | Hành vi |
| ---: | --- |
| 401 | Báo phiên không hợp lệ hoặc yêu cầu applicant token |
| 403 | Báo thiếu quyền |
| 404 | Không tồn tại hoặc không thuộc tenant |
| 409 | Reload dữ liệu vì transition/retry không hợp lệ |
| 410 | Chương trình đã hết hạn |
| 413 | Hiển thị giới hạn file/request |
| 422 | Gắn lỗi vào field hoặc request |
| 429 | Yêu cầu chờ, không retry liên tục |
| 5xx | Giữ input và cho thử lại có kiểm soát |

## Những chức năng không được dựng giả

- Partner matching, investor connection, startup portal.
- Moderation queue và public startup library.
- Member invitation hoặc role management.
- Notification, email, calendar, CRM, billing.
- Xóa hồ sơ, retry extraction, rotate submission token.
- AI tự động ACCEPTED hoặc REJECTED.


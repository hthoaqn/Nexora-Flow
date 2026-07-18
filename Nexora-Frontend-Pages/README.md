# Nexora Frontend — Đặc tả từng trang

Thư mục này nằm ngoài source code Nexora và dùng để giao từng trang riêng cho AI thiết kế hoặc lập trình Frontend. Mỗi file Markdown tương ứng đúng một route chức năng và có thể được đọc độc lập.

## Danh sách trang

| STT | Route | File |
| ---: | --- | --- |
| 1 | `/apply/:submissionToken` | [01-APPLY.md](01-APPLY.md) |
| 2 | `/my-application/:applicationId` | [02-MY-APPLICATION.md](02-MY-APPLICATION.md) |
| 3 | `/settings/organization` | [03-ORGANIZATION-SETTINGS.md](03-ORGANIZATION-SETTINGS.md) |
| 4 | `/programs` | [04-PROGRAMS-LIST.md](04-PROGRAMS-LIST.md) |
| 5 | `/programs/new` | [05-PROGRAM-CREATE.md](05-PROGRAM-CREATE.md) |
| 6 | `/programs/:programId/overview` | [06-PROGRAM-OVERVIEW.md](06-PROGRAM-OVERVIEW.md) |
| 7 | `/programs/:programId/applications` | [07-PROGRAM-APPLICATIONS.md](07-PROGRAM-APPLICATIONS.md) |
| 8 | `/applications/:applicationId` | [08-APPLICATION-DETAIL.md](08-APPLICATION-DETAIL.md) |
| 9 | `/programs/:programId/ranking` | [09-PROGRAM-RANKING.md](09-PROGRAM-RANKING.md) |
| 10 | `/applications/:applicationId/results/:resultId` | [10-SCREENING-RESULT.md](10-SCREENING-RESULT.md) |
| 11 | `/programs/:programId/compare` | [11-PROGRAM-COMPARE.md](11-PROGRAM-COMPARE.md) |
| 12 | `/programs/:programId/audit` | [12-PROGRAM-AUDIT.md](12-PROGRAM-AUDIT.md) |
| 13 | `/programs/:programId/settings` | [13-PROGRAM-SETTINGS.md](13-PROGRAM-SETTINGS.md) |

Đọc [00-QUY-TAC-CHUNG.md](00-QUY-TAC-CHUNG.md) trước khi tạo bất kỳ trang nào.

## Phạm vi

Đây là Nexora Intake phase 1: nhận pitch deck, AI trích xuất, con người xác nhận profile, screening có bằng chứng, ranking, so sánh và quyết định của reviewer.

Không có trang đăng nhập trong bộ tài liệu này. Không tạo partner matching, startup portal, moderation, notification, email/calendar, billing, member management, library readiness, xóa hồ sơ hoặc retry extraction vì Backend hiện tại chưa hỗ trợ đầy đủ.


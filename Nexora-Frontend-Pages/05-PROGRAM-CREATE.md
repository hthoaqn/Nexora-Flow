# Trang tạo chương trình

## Route

`/programs/new`

## Người dùng

Owner.

## API

`POST /api/programs`

## Các nhóm dữ liệu

### Cơ bản

- Name, objective, description.
- Priority industries, accepted stages, locations.
- Deadline, expected selections, status.

### Điều kiện

- Hard filters: allowed industries, stages, locations.
- Required fields.

### Rubric

- Rubric ID và semantic version.
- `single_rubric` hoặc `stage_based`.
- `included` hoặc `separate` completeness mode.
- Criteria: ID, name, description, weight.
- Scoring anchors phủ 0–100.
- Included signals và excluded signals.
- Classification bands.
- Stage configurations và fallback stage nếu dùng stage-based.

## Validation

- Tổng weight của các tiêu chí được chấm bằng 100.
- Anchor không hở, không chồng, bắt đầu 0 và kết thúc 100.
- `separate`: completeness weight bằng 0, phần còn lại tổng 100.
- Stage-based phải có stage configuration hợp lệ.
- Deadline phải hợp lệ.
- Không submit khi form còn lỗi.

## Sau khi tạo

- Chuyển sang `/programs/:programId/overview`.
- Hiển thị public submission link ở overview, không đưa token vào analytics.
- Invalidate program list.

## Nghiệm thu

- Payload dùng đúng camelCase contract.
- Lỗi 422 gắn đúng field/rubric section.
- Reviewer bị chặn.
- Không tự tạo default giả khác với Backend.


# Trang chi tiết kết quả screening

## Route

`/applications/:applicationId/results/:resultId`

## API

- `GET /api/screening-results/{resultId}`
- `PATCH /api/screening-results/{resultId}/review-score`
- `PATCH /api/screening-results/{resultId}/evidence/{evidenceId}`

## Thứ tự nội dung

### 1. Tóm tắt

- Eligible, classification.
- AI score, reviewer score, final score và source.
- Confidence và application completeness.
- Requires verification và decision-support-only.

### 2. Cảnh báo

- Hard-filter failures.
- Conflicts.
- Missing data.
- Invalid evidence.
- Double-counting warnings.

### 3. Criteria

Mỗi criterion hiển thị:

- Name, description, included/excluded signals.
- AI raw score, reviewer raw score, weight, weighted score.
- Selected anchor và reason.
- Data status và data-status reason.
- Confidence và confidence breakdown.
- Missing data, conflicts, inferences.

### 4. Evidence

- Exact quote, page, field, validity và evidence strength.
- Reviewer có thể verify evidence hợp lệ và phải nhập reason.
- Verification có thể đổi confidence nhưng không đổi AI raw score.

### 5. Reviewer override

- Chỉ sửa reviewer raw score theo criterion.
- Bắt buộc reason.
- Giữ nguyên AI score, reason và evidence.
- Sau lưu reload result, ranking, compare và audit.

### 6. Advisory signals

- Funding benchmark.
- Pitch coverage.
- Strategy routing.

Hiển thị tách riêng với nhãn “Tham khảo — không ảnh hưởng điểm hoặc quyết định”. Nếu unavailable thì hiển thị lý do, không tạo dữ liệu giả.

### 7. Provenance

- Rubric, prompt, algorithm, model version.
- Profile version, input hash, reason và scored time.

## Nghiệm thu

- Không trộn score và confidence.
- Advisory không thay đổi ranking/eligibility/classification.
- Override và evidence verification có audit.
- AI fields vẫn giữ nguyên sau reviewer override.


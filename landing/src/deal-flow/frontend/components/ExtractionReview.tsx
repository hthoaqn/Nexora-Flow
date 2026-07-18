// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExtractionResultDTO, StartupProfileDTO } from '../../types';
import { Check, X, Edit3, Trash2, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';
import { usePortalI18n } from '../i18n';
import { fieldLabel } from './CompareChanges';

interface ExtractionReviewProps {
  currentProfile: StartupProfileDTO | null;
  extractionDraft: ExtractionResultDTO;
  onUpdateFieldStatus: (fieldName: string, status: 'accepted' | 'edited' | 'rejected', editedValue?: any) => void;
  onMergeAllAccepted: () => void;
  onDismissAll: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  startupName: 'Tên Startup',
  website: 'Website',
  contactEmail: 'Email liên hệ',
  phoneNumber: 'Số điện thoại',
  industries: 'Lĩnh vực',
  technologies: 'Công nghệ cốt lõi',
  markets: 'Thị trường hoạt động',
  stage: 'Giai đoạn',
  description: 'Mô tả ngắn',
  problemStatement: 'Vấn đề cần giải quyết',
  solutionDescription: 'Giải pháp',
  fundingNeed: 'Nhu cầu gọi vốn',
  currency: 'Loại tiền tệ',
};

export default function ExtractionReview({
  currentProfile,
  extractionDraft,
  onUpdateFieldStatus,
  onMergeAllAccepted,
  onDismissAll,
}: ExtractionReviewProps) {
  const { lang } = usePortalI18n();
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const TYPE_BADGES: Record<string, string> = {
    company_name: tx('Tên Doanh nghiệp', 'Company name'),
    tagline: 'Tagline',
    description: tx('Mô tả', 'Description'),
    website: 'Website',
    email: 'Email',
    phone: tx('Điện thoại', 'Phone'),
    industry: tx('Lĩnh vực', 'Industry'),
    technology: tx('Công nghệ', 'Technology'),
    market: tx('Thị trường', 'Market'),
    startup_stage: tx('Giai đoạn', 'Stage'),
    funding: tx('Gọi vốn', 'Funding'),
    valuation: tx('Định giá', 'Valuation'),
    revenue: tx('Doanh thu', 'Revenue'),
    traction: 'Traction',
    customer: tx('Khách hàng', 'Customer'),
    business_model: tx('Mô hình kinh doanh', 'Business model'),
    problem: tx('Vấn đề', 'Problem'),
    solution: tx('Giải pháp', 'Solution'),
    founder: tx('Sáng lập viên', 'Founder'),
    team: tx('Đội ngũ', 'Team'),
    location: tx('Địa điểm', 'Location'),
    social: tx('Mạng xã hội', 'Social'),
    patent: tx('Bằng sáng chế', 'Patent'),
    award: tx('Giải thưởng', 'Award'),
    partnership: tx('Hợp tác', 'Partnership'),
    timeline: tx('Lịch trình', 'Timeline'),
    roadmap: 'Roadmap',
    metric: tx('Chỉ số', 'Metric'),
    other: tx('Khác', 'Other')
  };

  const handleStartEdit = (field: string, val: any) => {
    setEditingField(field);
    setEditValue(Array.isArray(val) ? val.join(', ') : String(val || ''));
  };

  const handleSaveEdit = (f: any) => {
    let finalVal: any = editValue;
    const mappedKey = f.mappedField || f.field;
    if (['industries', 'technologies', 'markets', 'partnershipNeeds'].includes(mappedKey)) {
      finalVal = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (mappedKey === 'fundingNeed' || mappedKey === 'traction.monthlyRevenue') {
      finalVal = Number(editValue) || null;
    }
    onUpdateFieldStatus(f.field, 'edited', finalVal);
    setEditingField(null);
  };

  const handleAcceptAllValid = () => {
    extractionDraft.fields.forEach((f) => {
      if (f.status === 'pending') {
        onUpdateFieldStatus(f.field, 'accepted');
      }
    });
  };

  const handleRejectAll = () => {
    extractionDraft.fields.forEach((f) => {
      onUpdateFieldStatus(f.field, 'rejected');
    });
  };

  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 0.9) return 'bg-primary/10 text-primary border-primary/30';
    if (conf >= 0.7) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-rose-50 text-rose-800 border-rose-200';
  };

  const formatDisplayValue = (field: string, val: any) => {
    if (val === undefined || val === null || val === '') return tx('Không phát hiện', 'Not detected');
    if (Array.isArray(val)) return val.join(', ');
    if (field === 'fundingNeed' || field === 'funding') return `${Number(val).toLocaleString()} USD/VND`;
    return String(val);
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-lg font-bold text-foreground font-heading">{tx('Kết quả phân tích & trích xuất dữ liệu AI', 'AI analysis & extraction results')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {tx('Chế độ trích xuất:', 'Extraction mode:')} <strong className="capitalize text-foreground">{extractionDraft.mode === 'real' ? tx('Xử lý thật', 'Live processing') : tx('Bản demo minh họa', 'Illustrative demo')}</strong>. {tx('Hãy xem xét và chọn lựa trước khi cập nhật vào hồ sơ nháp.', 'Review and pick fields before merging into your draft.')}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleAcceptAllValid}
            className="px-3.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/15 transition-colors"
          >
            {tx('Chấp nhận tất cả', 'Accept all')}
          </button>
          <button
            onClick={handleRejectAll}
            className="px-3.5 py-1.5 text-xs font-semibold bg-background text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            {tx('Từ chối tất cả', 'Reject all')}
          </button>
        </div>
      </div>

      {extractionDraft.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-bold">{tx('Cảnh báo phân tích:', 'Analysis warnings:')}</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            {extractionDraft.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Grid of Fields */}
      <div className="space-y-4">
        {extractionDraft.fields.map((f) => {
          const isEditing = editingField === f.field;
          const label = f.label || fieldLabel(f.mappedField || f.field, lang);
          const mappedKey = f.mappedField || f.field;
          const currentVal = currentProfile && mappedKey !== 'other' ? currentProfile[mappedKey as keyof StartupProfileDTO] : null;

          return (
            <div
              key={f.field}
              className={`border rounded-xl p-4 transition-all ${
                f.status === 'accepted' || f.status === 'edited'
                  ? 'border-primary/30 bg-primary/5'
                  : f.status === 'rejected'
                  ? 'border-border bg-background opacity-60'
                  : 'border-border hover:border-border'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info Area */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</span>
                    {f.type && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-medium">
                        {TYPE_BADGES[f.type] || f.type}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getConfidenceBadgeColor(
                        f.confidence
                      )}`}
                    >
                      {tx('Độ tin cậy:', 'Confidence:')} {Math.round(f.confidence * 100)}%
                    </span>
                    {f.status !== 'pending' && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          f.status === 'accepted'
                            ? 'text-primary'
                            : f.status === 'edited'
                            ? 'text-blue-600'
                            : 'text-rose-500'
                        }`}
                      >
                        • {f.status === 'accepted' ? tx('Đã duyệt', 'Approved') : f.status === 'edited' ? tx('Đã sửa & duyệt', 'Edited & approved') : tx('Đã bỏ qua', 'Skipped')}
                      </span>
                    )}
                  </div>

                  {/* Editable Proposed Value */}
                  {isEditing ? (
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={tx('Nhập giá trị đã chỉnh sửa...', 'Enter the edited value…')}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(f)}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground border border-border hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-foreground font-medium">
                      <span className="text-sm break-words">
                        {formatDisplayValue(mappedKey, f.value)}
                      </span>
                    </div>
                  )}

                  {/* Context Page & Text */}
                  {f.sourceText && (
                    <p className="text-xs text-muted-foreground italic">
                      {tx('Nguồn trích xuất:', 'Source:')} &ldquo;{f.sourceText}&rdquo; {f.sourcePage ? tx(`(Trang ${f.sourcePage})`, `(Page ${f.sourcePage})`) : ''}
                    </p>
                  )}

                  {/* Comparison with current confirmed profile */}
                  {currentProfile && mappedKey !== 'other' && (
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                      <span className="font-semibold">{tx('Giá trị hiện tại:', 'Current value:')}</span>
                      <span className="truncate max-w-xs italic">{formatDisplayValue(mappedKey, currentVal)}</span>
                    </div>
                  )}
                </div>

                {/* Operations */}
                {!isEditing && (
                  <div className="flex items-center space-x-1.5 self-start md:self-center shrink-0">
                    <button
                      onClick={() => onUpdateFieldStatus(f.field, 'accepted')}
                      disabled={f.status === 'accepted'}
                      title={tx('Chấp nhận trường này', 'Accept this field')}
                      className="p-1.5 rounded-lg border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Check className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(f.field, f.value)}
                      title={tx('Sửa và chấp nhận', 'Edit and accept')}
                      className="p-1.5 rounded-lg border border-border hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    >
                      <Edit3 className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => onUpdateFieldStatus(f.field, 'rejected')}
                      disabled={f.status === 'rejected'}
                      title={tx('Bỏ qua trường này', 'Skip this field')}
                      className="p-1.5 rounded-lg border border-border hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
        <button
          onClick={onDismissAll}
          className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-background border border-border rounded-lg transition-colors"
        >
          {tx('Hủy bỏ tất cả kết quả', 'Discard all results')}
        </button>
        <button
          onClick={onMergeAllAccepted}
          className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
        >
          <ArrowRight className="h-4.5 w-4.5" />
          <span>{tx('Áp dụng các trường đã duyệt vào hồ sơ nháp', 'Apply approved fields to the draft')}</span>
        </button>
      </div>
    </div>
  );
}

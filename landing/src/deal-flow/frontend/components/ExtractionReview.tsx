// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExtractionResultDTO, StartupProfileDTO } from '../../types';
import { Check, X, Edit3, Trash2, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';

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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const TYPE_BADGES: Record<string, string> = {
    company_name: 'Tên Doanh nghiệp',
    tagline: 'Tagline',
    description: 'Mô tả',
    website: 'Website',
    email: 'Email',
    phone: 'Điện thoại',
    industry: 'Lĩnh vực',
    technology: 'Công nghệ',
    market: 'Thị trường',
    startup_stage: 'Giai đoạn',
    funding: 'Gọi vốn',
    valuation: 'Định giá',
    revenue: 'Doanh thu',
    traction: 'Traction',
    customer: 'Khách hàng',
    business_model: 'Mô hình kinh doanh',
    problem: 'Vấn đề',
    solution: 'Giải pháp',
    founder: 'Sáng lập viên',
    team: 'Đội ngũ',
    location: 'Địa điểm',
    social: 'Mạng xã hội',
    patent: 'Bằng sáng chế',
    award: 'Giải thưởng',
    partnership: 'Hợp tác',
    timeline: 'Lịch trình',
    roadmap: 'Roadmap',
    metric: 'Chỉ số',
    other: 'Khác'
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
    if (conf >= 0.9) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (conf >= 0.7) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-rose-50 text-rose-800 border-rose-200';
  };

  const formatDisplayValue = (field: string, val: any) => {
    if (val === undefined || val === null || val === '') return 'Không phát hiện';
    if (Array.isArray(val)) return val.join(', ');
    if (field === 'fundingNeed' || field === 'funding') return `${Number(val).toLocaleString()} USD/VND`;
    return String(val);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-emerald-600 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-900 font-display">Kết quả phân tích &amp; trích xuất dữ liệu AI</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Chế độ trích xuất: <strong className="capitalize text-slate-700">{extractionDraft.mode === 'real' ? 'Xử lý thật' : 'Bản demo minh họa'}</strong>. Hãy xem xét và chọn lựa trước khi cập nhật vào hồ sơ nháp.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleAcceptAllValid}
            className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Chấp nhận tất cả
          </button>
          <button
            onClick={handleRejectAll}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Từ chối tất cả
          </button>
        </div>
      </div>

      {extractionDraft.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-bold">Cảnh báo phân tích:</p>
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
          const label = f.label || FIELD_LABELS[f.mappedField || ''] || FIELD_LABELS[f.field] || f.field;
          const mappedKey = f.mappedField || f.field;
          const currentVal = currentProfile && mappedKey !== 'other' ? currentProfile[mappedKey as keyof StartupProfileDTO] : null;

          return (
            <div
              key={f.field}
              className={`border rounded-xl p-4 transition-all ${
                f.status === 'accepted' || f.status === 'edited'
                  ? 'border-emerald-200 bg-emerald-50/5'
                  : f.status === 'rejected'
                  ? 'border-slate-200 bg-slate-50 opacity-60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info Area */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</span>
                    {f.type && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                        {TYPE_BADGES[f.type] || f.type}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getConfidenceBadgeColor(
                        f.confidence
                      )}`}
                    >
                      Độ tin cậy: {Math.round(f.confidence * 100)}%
                    </span>
                    {f.status !== 'pending' && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          f.status === 'accepted'
                            ? 'text-emerald-600'
                            : f.status === 'edited'
                            ? 'text-blue-600'
                            : 'text-rose-500'
                        }`}
                      >
                        • {f.status === 'accepted' ? 'Đã duyệt' : f.status === 'edited' ? 'Đã sửa & duyệt' : 'Đã bỏ qua'}
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
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Nhập giá trị đã chỉnh sửa..."
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(f)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-slate-900 font-medium">
                      <span className="text-sm break-words">
                        {formatDisplayValue(mappedKey, f.value)}
                      </span>
                    </div>
                  )}

                  {/* Context Page & Text */}
                  {f.sourceText && (
                    <p className="text-xs text-slate-400 italic">
                      Nguồn trích xuất: &ldquo;{f.sourceText}&rdquo; {f.sourcePage ? `(Trang ${f.sourcePage})` : ''}
                    </p>
                  )}

                  {/* Comparison with current confirmed profile */}
                  {currentProfile && mappedKey !== 'other' && (
                    <div className="flex items-center space-x-2 text-xs text-slate-500 pt-1 border-t border-slate-100 mt-2">
                      <span className="font-semibold">Giá trị hiện tại:</span>
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
                      title="Chấp nhận trường này"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Check className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(f.field, f.value)}
                      title="Sửa và chấp nhận"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    >
                      <Edit3 className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => onUpdateFieldStatus(f.field, 'rejected')}
                      disabled={f.status === 'rejected'}
                      title="Bỏ qua trường này"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
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

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
        <button
          onClick={onDismissAll}
          className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          Hủy bỏ tất cả kết quả
        </button>
        <button
          onClick={onMergeAllAccepted}
          className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
        >
          <ArrowRight className="h-4.5 w-4.5" />
          <span>Áp dụng các trường đã duyệt vào hồ sơ nháp</span>
        </button>
      </div>
    </div>
  );
}

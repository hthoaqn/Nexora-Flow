// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { StartupProfileDTO } from '../../types';
import { Check, AlertTriangle } from 'lucide-react';

interface CompareChangesProps {
  currentProfile: StartupProfileDTO | null;
  draftProfile: StartupProfileDTO;
  selectedFields: string[];
  onChangeSelection: (fields: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

interface DifferenceItem {
  field: string;
  label: string;
  currentValue: string;
  proposedValue: string;
}

export const FIELD_LABELS: Record<string, string> = {
  startupName: 'Tên Startup',
  website: 'Website',
  contactEmail: 'Email liên hệ',
  phoneNumber: 'Số điện thoại',
  foundingYear: 'Năm thành lập',
  address: 'Địa chỉ',
  country: 'Quốc gia',
  stage: 'Giai đoạn phát triển',
  businessModel: 'Mô hình kinh doanh',
  description: 'Mô tả ngắn',
  problemStatement: 'Vấn đề đang giải quyết',
  solutionDescription: 'Giải pháp',
  productDescription: 'Mô tả sản phẩm',
  fundingNeed: 'Nhu cầu gọi vốn',
  currency: 'Loại tiền tệ',
  industries: 'Lĩnh vực hoạt động',
  technologies: 'Công nghệ cốt lõi',
  markets: 'Thị trường hoạt động',
  targetCustomers: 'Khách hàng mục tiêu',
  partnershipNeeds: 'Hình thức hợp tác cần tìm',
  teamCapabilities: 'Năng lực cốt lõi của đội ngũ',
};

export default function CompareChanges({
  currentProfile,
  draftProfile,
  selectedFields,
  onChangeSelection,
  onConfirm,
  onCancel,
  isSaving,
}: CompareChangesProps) {
  const [differences, setDifferences] = useState<DifferenceItem[]>([]);

  useEffect(() => {
    const list: DifferenceItem[] = [];

    Object.keys(FIELD_LABELS).forEach((key) => {
      const currentVal = currentProfile ? currentProfile[key as keyof StartupProfileDTO] : undefined;
      const draftVal = draftProfile[key as keyof StartupProfileDTO];

      // Format arrays/primitives for visual reading
      const formatVal = (v: any) => {
        if (v === undefined || v === null || v === '') return 'Chưa cung cấp';
        if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : 'Chưa cung cấp';
        if (key === 'fundingNeed') return `${Number(v).toLocaleString()} ${draftProfile.currency}`;
        return String(v);
      };

      const currStr = formatVal(currentVal);
      const draftStr = formatVal(draftVal);

      if (currStr !== draftStr) {
        list.push({
          field: key,
          label: FIELD_LABELS[key],
          currentValue: currStr,
          proposedValue: draftStr,
        });
      }
    });

    setDifferences(list);

    // Default select all changed fields on first load if none selected
    if (selectedFields.length === 0 && list.length > 0) {
      onChangeSelection(list.map((d) => d.field));
    }
  }, [currentProfile, draftProfile]);

  const handleToggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      onChangeSelection(selectedFields.filter((f) => f !== field));
    } else {
      onChangeSelection([...selectedFields, field]);
    }
  };

  const handleSelectAll = () => {
    onChangeSelection(differences.map((d) => d.field));
  };

  const handleDeselectAll = () => {
    onChangeSelection([]);
  };

  if (differences.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-8 border border-slate-200 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
          <Check className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900">Không có sự thay đổi dữ liệu</h4>
          <p className="text-sm text-slate-500 mt-1">Dữ liệu hồ sơ nháp hiện tại hoàn toàn trùng khớp với hồ sơ chính thức trong cơ sở dữ liệu.</p>
        </div>
        <div className="flex justify-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm space-y-6 p-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900 font-display">So sánh và phê duyệt thay đổi</h3>
        <p className="text-sm text-slate-500 mt-1">
          Hệ thống phát hiện {differences.length} trường có sự khác biệt. Chọn các trường bạn muốn ghi nhận vào hồ sơ chính thức để cập nhật cơ sở dữ liệu.
        </p>
      </div>

      {/* Select All Actions */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 text-sm">
        <span className="font-medium text-slate-600">Đã chọn: {selectedFields.length} / {differences.length} trường thay đổi</span>
        <div className="space-x-4">
          <button onClick={handleSelectAll} className="text-emerald-600 font-semibold hover:text-emerald-700 hover:underline">Chọn tất cả</button>
          <button onClick={handleDeselectAll} className="text-slate-500 font-semibold hover:text-slate-600 hover:underline">Bỏ chọn tất cả</button>
        </div>
      </div>

      {/* Comparisons List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase font-bold bg-slate-50/50">
              <th className="py-3 px-4 w-12">Áp dụng</th>
              <th className="py-3 px-4 w-40">Tên trường</th>
              <th className="py-3 px-4">Dữ liệu hiện tại (Confirmed)</th>
              <th className="py-3 px-4 bg-emerald-50/30 text-emerald-900">Đề xuất mới (Draft)</th>
            </tr>
          </thead>
          <tbody>
            {differences.map((item) => {
              const isChecked = selectedFields.includes(item.field);
              return (
                <tr
                  key={item.field}
                  onClick={() => handleToggleField(item.field)}
                  className={`border-b border-slate-100 text-sm hover:bg-slate-50/50 cursor-pointer transition-colors ${
                    isChecked ? 'bg-emerald-50/5' : ''
                  }`}
                >
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // click on row handles toggle
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-700">{item.label}</td>
                  <td className="py-4 px-4 text-slate-500 line-through truncate max-w-xs">{item.currentValue}</td>
                  <td className="py-4 px-4 font-medium text-slate-900 bg-emerald-50/10 max-w-xs">
                    {item.proposedValue}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 text-xs text-amber-800 flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-normal">
          <strong>Lưu ý quan trọng:</strong> Khi bạn bấm nút xác nhận, các trường được tích sẽ trực tiếp ghi đè lên dữ liệu hồ sơ chính thức trong Supabase, tạo ra một phiên bản khôi phục mới trong lịch sử phiên bản. Các trường không tích sẽ giữ nguyên giá trị cũ.
        </p>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
        >
          Hủy bỏ nháp
        </button>
        <button
          onClick={onConfirm}
          disabled={selectedFields.length === 0 || isSaving}
          className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-sm transition-colors flex items-center space-x-2"
        >
          {isSaving ? 'Đang lưu trữ...' : 'Đồng ý cập nhật các trường đã chọn'}
        </button>
      </div>
    </div>
  );
}

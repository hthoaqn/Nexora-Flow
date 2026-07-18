// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { PartnerProfileDTO } from '../../types';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Building2,
  Globe,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

export default function Partners() {
  const [partners, setPartners] = useState<PartnerProfileDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(5);

  // Filters state
  const [search, setSearch] = useState('');
  const [orgType, setOrgType] = useState('');

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await api.get('/partners', {
        params: {
          page,
          limit,
          search,
          organizationType: orgType,
        },
      });

      if (res.data && res.data.success) {
        setPartners(res.data.data.items);
        setTotal(res.data.data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [page, orgType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPartners();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-slate-500" />
            <span>Danh bạ đối tác & Doanh nghiệp lớn</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu thông tin chính thức của các doanh nghiệp, cơ quan chính phủ và các quỹ đầu tư mạo hiểm trong hệ sinh thái
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-20 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
            placeholder="Tìm theo tên doanh nghiệp, địa bàn..."
          />
          <button
            type="submit"
            className="absolute right-2 top-1.5 px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={orgType}
            onChange={(e) => {
              setOrgType(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600 w-full md:w-48"
          >
            <option value="">Tất cả loại hình</option>
            <option value="CORPORATE">Doanh nghiệp lớn</option>
            <option value="VENTURE_CAPITAL">Quỹ Đầu tư (VC)</option>
            <option value="INCUBATOR">Vườn ươm / Accelerators</option>
            <option value="GOVERNMENT_AGENCY">Cơ quan nhà nước</option>
          </select>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : partners.length > 0 ? (
        <div className="space-y-4">
          {partners.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-start justify-between gap-6"
            >
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-slate-900 font-display">{p.organizationName}</h3>
                      {p.isDemo && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Dữ liệu mô phỏng
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase mt-0.5">
                      {p.organizationType.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-500 leading-relaxed">{p.description}</p>

                {/* Tags lists */}
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">Thị trường: <strong>{p.preferredMarkets?.slice(0, 2).join(', ') || 'N/A'}</strong></span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-500">Mảng quan tâm: <strong>{(p.interestedIndustries || []).slice(0, 3).join(', ')}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination buttons */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-6">
            <span className="text-xs text-slate-500 font-semibold">
              Hiển thị {partners.length} / {total} doanh nghiệp
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>

              <span className="text-xs font-bold text-slate-700">Trang {page} / {totalPages}</span>

              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-3">
          <HelpCircle className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-slate-600 font-semibold">Không tìm thấy doanh nghiệp nào</p>
          <p className="text-sm text-slate-400">
            Không khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại. Vui lòng làm sạch từ khóa hoặc đổi loại hình.
          </p>
        </div>
      )}
    </div>
  );
}

// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useStartupStore } from '../store/useStartupStore';
import { MatchResultDTO } from '../../types';
import { toast } from 'sonner';
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Award,
  Layers,
  ArrowUpRight,
  User,
  ExternalLink,
  MessageSquare,
  Send,
  X,
  Plus,
} from 'lucide-react';

export default function Matches() {
  const { confirmedProfile, isDirty } = useStartupStore();

  const [matches, setMatches] = useState<MatchResultDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [orgType, setOrgType] = useState('');
  const [partnershipType, setPartnershipType] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'name' | 'employees' | 'growth'>('score');
  const [minScore, setMinScore] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Connection drawer modal state
  const [connectingMatch, setConnectingMatch] = useState<MatchResultDTO | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [sendingConnection, setSendingConnection] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/startup/matches');
      if (res.data && res.data.success) {
        setMatches(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateMatches = async () => {
    if (!confirmedProfile) {
      toast.error('Bạn cần xác nhận hồ sơ trước khi chạy so khớp.');
      return;
    }
    setRecalculating(true);
    const toastId = toast.loading('Đang chạy thuật toán so khớp đối tác...');
    try {
      const res = await api.post('/startup/matches/run', { confirmedProfile });
      if (res.data && res.data.success) {
        toast.success('Đã tính toán lại so khớp thành công!');
        setMatches(res.data.data);
      }
    } catch (e: any) {
      console.error(e);
      const errData = e.response?.data;
      const errorCode = errData?.error?.code;
      const errorMessage = errData?.message;
      const errorDetails = errData?.error?.details;

      if (errorCode === 'PROFILE_NOT_CONFIRMED') {
        toast.error('Hồ sơ chưa xác nhận: Bạn cần thiết lập thông tin và bấm "Xác nhận và tạo hồ sơ" trước khi chạy so khớp.');
      } else if (errorCode === 'PROFILE_INCOMPLETE_FOR_MATCHING') {
        toast.error(errorMessage || errorDetails || 'Hồ sơ còn thiếu một số trường thông tin quan trọng bắt buộc để so khớp.');
      } else if (errorCode === 'NO_ACTIVE_PARTNERS') {
        toast.error('Hiện không có đối tác doanh nghiệp hay quỹ đầu tư nào đang hoạt động để thực hiện so khớp.');
      } else {
        toast.error(errorMessage || 'Hệ thống gặp lỗi không mong muốn khi tính toán so khớp đối tác.');
      }
    } finally {
      setRecalculating(false);
      toast.dismiss(toastId);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleOpenConnect = (m: MatchResultDTO) => {
    setConnectingMatch(m);
    setIntroMessage(
      `Kính chào ban lãnh đạo ${m.partner.organizationName},\n\nChúng tôi là ${confirmedProfile?.startupName || 'Startup'}, nhận thấy có sự trùng khớp rất lớn (${m.totalScore}%) về mục tiêu và lĩnh vực hoạt động trong chương trình Deal-Flow Matchmaker.\n\nChúng tôi rất mong muốn được thảo luận chi tiết về cơ hội hợp tác.`
    );
  };

  const handleSendConnection = async () => {
    if (!connectingMatch) return;
    if (!introMessage.trim()) {
      toast.error('Vui lòng soạn thảo nội dung tin nhắn giới thiệu.');
      return;
    }

    setSendingConnection(true);
    try {
      const res = await api.post('/startup/connections', {
        partnerId: connectingMatch.partner.id,
        matchId: connectingMatch.id,
        matchScore: connectingMatch.totalScore,
        message: introMessage,
      });

      if (res.data && res.data.success) {
        if (connectingMatch.partner.isDemo) {
          toast.success(`Yêu cầu kết nối thử nghiệm đã được ghi nhận thành công trong môi trường mô phỏng tới ${connectingMatch.partner.organizationName}!`);
        } else {
          toast.success(`Đã gửi yêu cầu kết nối thành công tới ${connectingMatch.partner.organizationName}!`);
        }
        setConnectingMatch(null);
        // Refresh matches info
        fetchMatches();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingConnection(false);
    }
  };

  // Filter local results
  const filteredMatches = matches.filter((m) => {
    if (!m.partner) return false;
    const matchesSearch =
      m.partner.organizationName.toLowerCase().includes(search.toLowerCase()) ||
      (m.partner.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.partner.interestedIndustries || []).some((i) => i.toLowerCase().includes(search.toLowerCase())) ||
      (m.partner.interestedTechnologies || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesType = !orgType || m.partner.organizationType === orgType;

    const matchesPartnership =
      !partnershipType || (m.partner.partnershipTypes || []).includes(partnershipType);

    const matchesMinScore = m.totalScore >= minScore;

    return matchesSearch && matchesType && matchesPartnership && matchesMinScore;
  });

  // Sort results
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (sortBy === 'score') {
      return b.totalScore - a.totalScore;
    }
    if (sortBy === 'newest') {
      const dateA = new Date(a.partner.createdAt || 0).getTime();
      const dateB = new Date(b.partner.createdAt || 0).getTime();
      return dateB - dateA;
    }
    if (sortBy === 'name') {
      return a.partner.organizationName.localeCompare(b.partner.organizationName);
    }
    if (sortBy === 'employees') {
      return (b.partner.employeeCount || 0) - (a.partner.employeeCount || 0);
    }
    if (sortBy === 'growth') {
      return (b.partner.growthRate || 0) - (a.partner.growthRate || 0);
    }
    return 0;
  });

  // Paginate results
  const pageSize = 5;
  const totalItems = sortedMatches.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedMatches = sortedMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  return (
    <div className="space-y-8">
      {/* Header and Sync Alerts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-emerald-600 animate-pulse" />
            <span>Đối tác so khớp phù hợp nhất</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách đối tác doanh nghiệp và quỹ đầu tư phù hợp, sắp xếp theo điểm số tương thích
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRecalculateMatches}
            disabled={recalculating}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
          >
            {recalculating ? 'Đang so khớp...' : 'Cập nhật so khớp'}
          </button>
          <button
            onClick={fetchMatches}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Làm mới danh sách
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Cảnh báo bộ lọc:</strong> Bạn có thay đổi chưa xác nhận ở trang hồ sơ. Kết quả so khớp hiện tại đang sử dụng thông tin từ hồ sơ chính thức lưu trong database. Vui lòng bấm lưu hồ sơ để cập nhật kết quả so khớp chính xác nhất.
        </div>
      )}

      {/* Search and filter toolbar */}
      <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
              placeholder="Tìm theo tên đối tác, lĩnh vực, công nghệ..."
            />
          </div>

          <div>
            <select
              value={orgType}
              onChange={(e) => { setOrgType(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600 shadow-sm"
            >
              <option value="">Tất cả loại hình đối tác</option>
              <option value="corporation">Doanh nghiệp lớn</option>
              <option value="investment_fund">Quỹ Đầu tư mạo hiểm (VC)</option>
              <option value="innovation_organization">Tổ chức đổi mới sáng tạo</option>
              <option value="research_institution">Viện nghiên cứu / Trường ĐH</option>
            </select>
          </div>

          <div>
            <select
              value={partnershipType}
              onChange={(e) => { setPartnershipType(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600 shadow-sm"
            >
              <option value="">Tất cả hình thức hợp tác</option>
              <option value="investment">Hỗ trợ đầu tư vốn</option>
              <option value="pilot">Chương trình thí điểm (Pilot)</option>
              <option value="distribution">Hợp tác phân phối kênh bán</option>
              <option value="technology_partnership">Hợp tác công nghệ</option>
              <option value="customer_acquisition">Tiếp cận khách hàng mới</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sắp xếp kết quả</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600 shadow-sm"
            >
              <option value="score">Điểm phù hợp cao nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="name">Tên A-Z</option>
              <option value="employees">Quy mô lớn nhất (Nhân sự)</option>
              <option value="growth">Tăng trưởng cao nhất (%)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm matching tối thiểu</label>
            <select
              value={minScore}
              onChange={(e) => { setMinScore(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600 shadow-sm"
            >
              <option value={0}>Tất cả điểm số</option>
              <option value={20}>Từ 20 điểm trở lên</option>
              <option value={40}>Từ 40 điểm trở lên</option>
              <option value={60}>Từ 60 điểm trở lên (Phù hợp)</option>
              <option value={80}>Từ 80 điểm trở lên (Rất phù hợp)</option>
            </select>
          </div>

          <div className="flex items-end justify-end text-xs text-slate-400 self-center pb-1">
            Hiển thị <strong className="text-slate-700 mx-1">{totalItems}</strong> kết quả so khớp
          </div>
        </div>
      </div>

      {/* Loading list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : paginatedMatches.length > 0 ? (
        <div className="space-y-6">
          {paginatedMatches.map((m) => {
            const matchedTech = (m.partner?.interestedTechnologies || []).filter(t => 
              (confirmedProfile?.technologies || []).some(st => st.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(st.toLowerCase()))
            );
            const matchedPart = (m.partner?.partnershipTypes || []).filter(p => 
              (confirmedProfile?.partnershipNeeds || []).some(sp => sp.toLowerCase() === p.toLowerCase())
            );
            return (
              <div
                key={m.partner?.id || m.id}
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 hover:border-slate-300 transition-all space-y-6"
              >
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                      <span>{m.partner.organizationName}</span>
                      {(m.partner.isDemo || m.partnerIsDemo || m.partner_is_demo) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Dữ liệu mô phỏng
                        </span>
                      )}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {m.partner.organizationType.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500">{m.partner.description}</p>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider self-center mr-1">
                      Lĩnh vực cần tìm:
                    </span>
                    {(m.partner.interestedIndustries || []).map((ind) => (
                      <span key={ind} className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score breakdown metrics badge */}
                <div className="text-right shrink-0">
                  <div className={`inline-flex items-center space-x-1 px-4 py-2 rounded-xl border font-bold text-lg font-display ${getScoreColor(m.totalScore)}`}>
                    <Award className="h-5 w-5" />
                    <span>{m.totalScore} / 100 điểm</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Độ tương thích hệ thống</p>
                </div>
              </div>

              {/* Expansion Grid: Breakdown of Weights */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Lĩnh vực (25%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).industry || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Công nghệ (15%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).technology || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Giai đoạn (15%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).stage || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Hợp tác (15%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).partnership || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Gọi vốn (10%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).funding || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Thị trường (10%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).market || 0) * 100)}/100</span>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Năng lực (10%)
                  </span>
                  <span className="text-sm font-bold text-slate-900">{Math.round(((m.scoreBreakdown || m.breakdown || {}).capability || 0) * 100)}/100</span>
                </div>
              </div>

              {/* Match Highlights / Common Items */}
              <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Trùng công nghệ: <strong>{matchedTech.join(', ') || 'Không trùng'}</strong></span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Hình thức: <strong>{matchedPart.join(', ') || 'Không trùng'}</strong></span>
                  </div>
                </div>

                {/* Send request action */}
                <button
                  onClick={() => handleOpenConnect(m)}
                  className="inline-flex items-center space-x-1.5 px-4.5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-sm cursor-pointer transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Gửi yêu cầu kết nối</span>
                </button>
              </div>
            </div>
          )})}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Trang trước
              </button>
              <div className="text-xs text-slate-500">
                Trang <strong className="text-slate-800">{currentPage}</strong> / {totalPages}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Trang sau
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-3">
          <HelpCircle className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-slate-600 font-semibold">Không có kết quả so khớp phù hợp</p>
          <p className="text-sm text-slate-400">Vui lòng điều chỉnh lại bộ lọc tìm kiếm hoặc cập nhật thêm các trường kỹ năng trong Hồ sơ để mở rộng cơ hội tìm thấy đối tác.</p>
        </div>
      )}

      {/* CONNECT DRAWER OVERLAY */}
      {connectingMatch && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-6 overflow-y-auto z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display">Gửi lời mời kết nối tới {connectingMatch.partner.organizationName}</h3>
                <p className="text-xs text-slate-500 mt-1">Yêu cầu của bạn sẽ được chuyển thẳng đến hòm thư Deal-Flow của đại diện đối tác.</p>
              </div>
              <button
                onClick={() => setConnectingMatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Người nhận</label>
                <input
                  type="text"
                  disabled
                  value={`${connectingMatch.partner.contactEmail || 'Đại diện đối tác'} (${connectingMatch.partner.organizationName})`}
                  className="mt-1.5 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Lời nhắn giới thiệu của bạn *</label>
                <textarea
                  rows={8}
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  className="mt-1.5 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Viết lời nhắn giới thiệu ngắn gọn, thể hiện lý do tại sao hai bên nên làm việc với nhau..."
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Khuyến khích giữ lời nhắn dưới 500 ký tự để có tỷ lệ phản hồi cao nhất.</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setConnectingMatch(null)}
                className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSendConnection}
                disabled={sendingConnection}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-sm cursor-pointer disabled:bg-slate-200"
              >
                <Send className="h-4 w-4" />
                <span>{sendingConnection ? 'Đang gửi...' : 'Xác nhận gửi thư'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

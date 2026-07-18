// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { api } from '../api';
import { useStartupStore } from '../store/useStartupStore';
import { useAuthStore } from '../store/useAuthStore';
import { StartupDashboardDTO } from '../../types';
import {
  Sparkles,
  Link2,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Award,
  Building,
  HelpCircle,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isDirty, confirmedProfile, setConfirmedProfile } = useStartupStore();

  const [data, setData] = useState<StartupDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/startup/dashboard');
      if (res.data && res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  const loadConfirmedProfile = async () => {
    try {
      const res = await api.get('/startup/profile');
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load confirmed profile', e);
    }
  };

  useEffect(() => {
    fetchDashboard();
    loadConfirmedProfile();
  }, [isDirty]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  const completionColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Xin chào, {user?.fullName}!
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Bảng điều khiển kết nối Deal-Flow của <strong className="text-slate-700">{confirmedProfile?.startupName || 'Startup chưa thiết lập'}</strong>
          </p>
        </div>

        <RouterLink
          to="/setup"
          className="inline-flex items-center space-x-2 bg-emerald-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors self-start md:self-center"
        >
          <span>Thiết lập hồ sơ</span>
          <ArrowRight className="h-4.5 w-4.5" />
        </RouterLink>
      </div>

      {/* Warning Unsaved Changes */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">Bạn đang có dữ liệu thay đổi cục bộ chưa xác nhận!</p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              Kết quả so khớp tự động (Matching) hiện tại đang chạy dựa trên <strong>Hồ sơ chính thức đã xác nhận gần nhất trong database</strong>. Vui lòng vào trang thiết lập hồ sơ và bấm <strong>&ldquo;Đồng ý cập nhật&rdquo;</strong> để lưu dữ liệu nháp của bạn.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Độ hoàn thiện hồ sơ</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 font-display">{data?.profileCompletion}%</span>
            <span className="text-xs text-slate-500 font-medium">Chính thức</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${completionColor(data?.profileCompletion || 0)}`}
              style={{ width: `${data?.profileCompletion || 0}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng số đối tác phù hợp</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 font-display">{data?.totalMatches}</span>
            <RouterLink to="/matches" className="text-xs text-emerald-600 font-semibold hover:underline">
              Xem chi tiết
            </RouterLink>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2">Doanh nghiệp và quỹ đầu tư hoạt động</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">So khớp điểm cao (≥80)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 font-display text-emerald-600 font-display">
              {data?.highMatchCount}
            </span>
            <Award className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2">Có độ tương thích cực kỳ tiềm năng</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Yêu cầu kết nối</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 font-display">{data?.pendingConnections}</span>
            <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Đang đợi
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2">Đã chấp nhận: {data?.acceptedConnections} đối tác</p>
        </div>
      </div>

      {/* Two Columns Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Missing fields / Recommendations */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 lg:col-span-1">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">Cải thiện hồ sơ</h3>
            <p className="text-xs text-slate-500 mt-1">Bổ sung các trường sau để gia tăng độ tin cậy của thuật toán so khớp</p>
          </div>

          {data?.missingFields && data.missingFields.length > 0 ? (
            <div className="space-y-3">
              {data.missingFields.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-start space-x-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-700 capitalize">{f.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="text-slate-500 mt-0.5">Nhà đầu tư thường tìm kiếm thông tin này trước tiên.</p>
                  </div>
                </div>
              ))}
              {data.missingFields.length > 5 && (
                <p className="text-xs text-slate-400 text-center italic">Và {data.missingFields.length - 5} trường khác nữa...</p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-2 bg-emerald-50/20 border border-emerald-100 rounded-xl">
              <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-emerald-800">Tuyệt vời!</p>
              <p className="text-xs text-emerald-600">Hồ sơ chính thức của bạn đã điền đầy đủ tất cả các thông tin cốt lõi.</p>
            </div>
          )}
        </div>

        {/* Right Col: Recent Matches & Connections */}
        <div className="lg:col-span-2 space-y-8">
          {/* Matches segment */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Đối tác tiềm năng nổi bật</h3>
                <p className="text-xs text-slate-500 mt-0.5">So khớp tự động dựa trên hồ sơ chính thức gần nhất</p>
              </div>
              <RouterLink to="/matches" className="text-xs font-semibold text-emerald-600 hover:underline flex items-center space-x-1">
                <span>So khớp tất cả</span>
                <ArrowRight className="h-3 w-3" />
              </RouterLink>
            </div>

            {data?.recentMatches && data.recentMatches.length > 0 ? (
              <div className="space-y-3.5">
                {data.recentMatches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border-b border-slate-100 pb-3.5 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{m.partner?.organizationName || 'Đối tác doanh nghiệp'}</p>
                        {(m.partner?.isDemo || m.partnerIsDemo || m.partner_is_demo) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Dữ liệu mô phỏng
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {m.partner?.organizationType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="inline-block text-sm font-bold text-emerald-600 font-display bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        {m.totalScore} điểm
                      </span>
                      <p className="text-[10px] text-slate-400">Độ khớp</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <Sparkles className="h-6 w-6 text-slate-400 mx-auto" />
                <div className="text-xs text-slate-500">
                  <p className="font-semibold">Chưa chạy so khớp</p>
                  <p className="mt-0.5">Bấm nút bên dưới để khởi chạy phân tích matching với dữ liệu doanh nghiệp.</p>
                </div>
                <button
                  onClick={() => navigate('/matches')}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Bắt đầu Matching
                </button>
              </div>
            )}
          </div>

          {/* Connections segment */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Kết nối gần đây</h3>
                <p className="text-xs text-slate-500 mt-0.5">Yêu cầu giới thiệu giới hạn từ phía của bạn</p>
              </div>
              <RouterLink to="/connections" className="text-xs font-semibold text-emerald-600 hover:underline flex items-center space-x-1">
                <span>Quản lý kết nối</span>
                <ArrowRight className="h-3 w-3" />
              </RouterLink>
            </div>

            {data?.recentConnections && data.recentConnections.length > 0 ? (
              <div className="space-y-3.5">
                {data.recentConnections.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-slate-100 pb-3.5 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{c.partnerName}</p>
                        {(c.isDemo || c.is_demo) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Dữ liệu mô phỏng
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-sm">{c.message}</p>
                    </div>

                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Đang đợi
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 italic">
                Bạn chưa gửi yêu cầu kết nối nào. Tìm kiếm các đối tác phù hợp và nhấn "Gửi yêu cầu kết nối".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

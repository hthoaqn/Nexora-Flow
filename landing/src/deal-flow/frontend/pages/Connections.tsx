// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ConnectionRequestDTO } from '../../types';
import { toast } from 'sonner';
import {
  Link2,
  Mail,
  User,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Trash2,
  Phone,
  ArrowUpRight,
  Gamepad2,
} from 'lucide-react';

export default function Connections() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<ConnectionRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await api.get('/startup/connections');
      if (res.data && res.data.success) {
        setConnections(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleCancelConnection = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn rút lại yêu cầu kết nối này không?')) return;

    try {
      const res = await api.delete(`/startup/connections/${id}`);
      if (res.data && res.data.success) {
        toast.success('Đã rút lại lời mời kết nối.');
        fetchConnections();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Đã đồng ý kết nối
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Từ chối kết nối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Chờ phản hồi
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display flex items-center space-x-2">
            <Link2 className="h-6 w-6 text-slate-500" />
            <span>Kết nối đối tác của tôi</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi tiến trình phê duyệt, trao đổi tài liệu, và trực tiếp trao đổi qua email/Zalo/Điện thoại
          </p>
        </div>

        <button
          onClick={fetchConnections}
          className="px-4 py-2 text-sm font-semibold border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          Tải lại danh sách
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : connections.length > 0 ? (
        <div className="space-y-6">
          {connections.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 hover:border-slate-300 transition-all space-y-6"
            >
              {/* Connection Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900 font-display">{c.partnerName}</h3>
                    {(c.isDemo || c.is_demo) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Dữ liệu mô phỏng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Gửi lúc: {new Date(c.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>

                {getStatusBadge(c.status)}
              </div>

              {/* Message Details */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                &ldquo;{c.message}&rdquo;
              </div>

              {/* Direct Contacts Info (Only if accepted) */}
              {c.status === 'ACCEPTED' && c.partner && (
                <div className="bg-emerald-50/25 border border-emerald-100 rounded-xl p-5 space-y-4">
                  <h4 className="text-sm font-bold text-emerald-900">Thông tin liên hệ trực tiếp của đại diện đối tác</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <User className="h-4.5 w-4.5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-500">Họ và tên</p>
                        <p className="font-bold text-slate-900 mt-0.5">{c.partner.contactPerson || 'Chưa cung cấp'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700">
                      <Mail className="h-4.5 w-4.5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-500">Email công việc</p>
                        <p className="font-bold text-slate-900 mt-0.5">{c.partner.contactEmail || 'Chưa cung cấp'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700">
                      <Phone className="h-4.5 w-4.5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-500">Số điện thoại / Zalo</p>
                        <p className="font-bold text-slate-900 mt-0.5">{c.partner.phoneNumber || 'Chưa cung cấp'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row actions */}
              <div className="flex justify-end border-t border-slate-100 pt-4">
                {c.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancelConnection(c.id)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-lg text-slate-500 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Rút lại yêu cầu</span>
                  </button>
                )}
                {c.status === 'ACCEPTED' && (
                  <button
                    onClick={() => {
                      // Trigger new simulation creation or redirect to sandbox with preset partner
                      api.post('/startup/sandbox/create', { partnerId: c.partnerId })
                        .then(() => {
                          toast.success(`Mở AI Sandbox mô phỏng thử thách với ${c.partnerName}!`);
                          navigate('/sandbox');
                        })
                        .catch((err) => {
                          console.error(err);
                          navigate('/sandbox');
                        });
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>Khởi chạy AI Sandbox</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-3">
          <HelpCircle className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-slate-600 font-semibold">Chưa gửi yêu cầu kết nối nào</p>
          <p className="text-sm text-slate-400">
            Bạn chưa thực hiện bất kỳ lượt giới thiệu hay xin kết nối nào. Hãy vào mục "Tìm đối tác" để khởi chạy so khớp điểm và xin kết nối ngay!
          </p>
        </div>
      )}
    </div>
  );
}

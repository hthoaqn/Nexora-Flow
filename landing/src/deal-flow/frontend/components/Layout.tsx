// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useStartupStore } from '../store/useStartupStore';
import {
  LayoutDashboard,
  UserRound,
  Sparkles,
  Link2,
  BookOpen,
  LogOut,
  Building,
  AlertCircle,
  CheckCircle,
  Gamepad2,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, clearAuth } = useAuthStore();
  const { confirmedProfile, localDraft, isDirty } = useStartupStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login'); // basename=/portal → /portal/login
  };

  const navItems = [
    { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/setup', label: 'Hồ sơ Startup', icon: UserRound },
    { to: '/matches', label: 'Tìm đối tác', icon: Sparkles },
    { to: '/connections', label: 'Kết nối của tôi', icon: Link2 },
    { to: '/sandbox', label: 'AI Sandbox', icon: Gamepad2 },
    { to: '/partners', label: 'Danh bạ đối tác', icon: BookOpen },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground antialiased">
      {/* Sidebar — tuned to Nexora landing tokens */}
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-border bg-card text-muted-foreground">
        <div>
          <div className="flex items-center gap-3 border-b border-border p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              NF
            </div>
            <div>
              <h1 className="font-heading text-sm font-bold leading-none text-foreground">
                Nexora Flow
              </h1>
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Startup portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile Summary & Logout */}
        <div className="space-y-4 border-t border-border p-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted font-semibold text-foreground">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{user?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 sm:px-8">
          <div className="flex items-center gap-2">
            <Building className="size-5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {confirmedProfile?.startupName || 'Startup chưa đặt tên'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Sync Warning Badges */}
            {isDirty && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Thay đổi chưa lưu cục bộ
              </span>
            )}
            {confirmedProfile ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Hồ sơ chính thức
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Chưa tạo hồ sơ chính thức
              </span>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

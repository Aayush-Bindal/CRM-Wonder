'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import {
  ShieldCheck,
  UserCheck,
  ChevronDown,
  LogOut,
} from 'lucide-react';

export default function Navbar() {
  const {
    currentUser,
    logout,
  } = useCRM();

  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <header className="sticky top-0 z-40 bg-[#ffffff] border-b border-[#e8e8e8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#ff682c]" />
            <span className="font-mono text-xs tracking-widest uppercase text-[#828282]">
              CRM
            </span>
            <span className="text-base font-semibold tracking-tight text-[#202020]">
              WONDER
            </span>
          </div>

          {/* Role Pill Indicator */}
          {currentUser && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-full border ${
                isAdmin
                  ? 'bg-[#efefef] text-[#202020] border-[#d4d4d4]'
                  : 'bg-[#fff7f4] text-[#ff682c] border-[#ffd8cc]'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-3 h-3 text-[#202020]" />
              ) : (
                <UserCheck className="w-3 h-3 text-[#ff682c]" />
              )}
              <span className="text-[10px] sm:text-xs">{isAdmin ? 'ADMIN' : 'SALES REP'}</span>
            </span>
          )}
        </div>

        {/* User Account Menu: On phone, just profile avatar; on desktop, avatar with full name */}
        {currentUser && (
          <div className="relative">
            <button
              id="nav-user-profile-menu-btn"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center sm:gap-2 p-0.5 sm:px-2.5 sm:py-1 bg-[#efefef] hover:bg-[#e4e4e4] transition-colors rounded-full text-xs text-[#202020] border border-[#e0e0e0]"
              aria-label="User profile menu"
            >
              <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-[#202020] text-white flex items-center justify-center text-xs sm:text-[10px] font-mono font-medium shrink-0">
                {currentUser.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <span className="hidden sm:inline font-medium max-w-[130px] truncate text-xs">
                {currentUser.full_name}
              </span>
              <ChevronDown className="hidden sm:inline w-3 h-3 text-[#828282] shrink-0" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-60 bg-white border border-[#e8e8e8] rounded-xl shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-2 py-2 border-b border-[#e8e8e8] mb-1">
                  <p className="text-[10px] text-[#828282] font-mono uppercase tracking-wider">Account Details</p>
                  <p className="text-sm font-semibold text-[#202020] truncate">
                    {currentUser.full_name}
                  </p>
                  <p className="text-xs text-[#4d4d4d] truncate">{currentUser.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#efefef] text-[#202020] border border-[#e0e0e0]">
                      Role: {currentUser.role === 'Admin' ? 'Administrator' : 'Sales Representative'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    id="logout-btn"
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-2 py-2 text-xs text-red-600 hover:bg-red-50 rounded flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

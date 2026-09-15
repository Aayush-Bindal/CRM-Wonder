'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

export default function AuthModal() {
  const { loginWithEmail, loginAs, profiles } = useCRM();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const success = loginWithEmail(email);
      if (!success) {
        setError('No account found with this email. Please check your credentials or contact your administrator.');
      }
      setLoading(false);
    }, 300);
  };

  const adminAccount = profiles.find((p) => p.role === 'Admin');
  const repAccounts = profiles.filter((p) => p.role === 'Sales_Rep');

  return (
    <div className="min-h-screen bg-[#ffffff] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Minimalist Logo Mark */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-3 h-3 bg-[#ff682c]" />
          <span className="font-mono text-xs tracking-widest uppercase text-[#828282]">
            CRM
          </span>
          <span className="text-xl font-bold tracking-tight text-[#202020]">
            WONDER
          </span>
        </div>

        <h1 className="text-center text-2xl font-normal text-[#202020] tracking-tight">
          Sales Representative Portal
        </h1>
        <p className="mt-1 text-center text-sm text-[#4d4d4d]">
          Minimalist, high-speed mobile real estate CRM
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-[#efefef] p-6 sm:p-8 rounded-lg border border-[#e8e8e8]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-mono uppercase tracking-wider text-[#4d4d4d] mb-1"
              >
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#828282] absolute left-3 top-3" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@luxuryliving.com"
                  className="w-full bg-[#ffffff] border border-[#e8e8e8] pl-9 pr-3 py-2.5 text-sm text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-mono uppercase tracking-wider text-[#4d4d4d] mb-1"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#828282] absolute left-3 top-3" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#ffffff] border border-[#e8e8e8] pl-9 pr-3 py-2.5 text-sm text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>
            </div>

            <button
              id="submit-login-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#202020] text-white py-2.5 px-4 text-sm font-medium hover:bg-black transition-colors flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security & Access Notice */}
          <div className="mt-5 pt-4 border-t border-[#e0e0e0] text-center">
            <p className="text-xs text-[#828282]">
              Need an account or help logging in?
              <br />
              Please contact your organization administrator.
            </p>
          </div>

          {/* Quick Sign In Profiles */}
          <div className="mt-5 pt-4 border-t border-[#e0e0e0]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#828282] mb-2 text-center">
              Quick Sign In (Select Account)
            </p>
            <div className="space-y-1.5">
              {adminAccount && (
                <button
                  id="quick-login-admin"
                  type="button"
                  onClick={() => loginAs(adminAccount.id)}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-[#f5f5f5] text-xs border border-[#e8e8e8] rounded flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#202020]" />
                    <span className="font-medium text-[#202020]">
                      {adminAccount.full_name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#ff682c] font-semibold">
                    ADMIN
                  </span>
                </button>
              )}

              {repAccounts.slice(0, 2).map((rep) => (
                <button
                  key={rep.id}
                  id={`quick-login-${rep.id}`}
                  type="button"
                  onClick={() => loginAs(rep.id)}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-[#f5f5f5] text-xs border border-[#e8e8e8] rounded flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-[#ff682c]" />
                    <span className="font-medium text-[#202020]">
                      {rep.full_name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#828282]">
                    SALES REP
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCRM } from '@/lib/crmContext';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const { login, authNotice } = useCRM();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(identifier, password);
    if (!result.success) {
      setError(result.error || 'Unable to sign in. Please check your credentials.');
    }
    setPassword('');
    setLoading(false);
  };

  return (
    <div className="flex flex-1 flex-col bg-[#ffffff]">
      {/* The sign-in card is centred in the space above the footer that the root
          layout mounts, so it sits on the floor of the page rather than under the
          card. */}
      <main className="flex flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
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

              {!error && authNotice && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800 rounded flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{authNotice}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-mono uppercase tracking-wider text-[#4d4d4d] mb-1"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#828282] absolute left-3 top-3" />
                  <input
                    id="login-identifier"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@gmail.com"
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
                    maxLength={72}
                    autoComplete="current-password"
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
          </div>

          {/* Incorporates both documents by reference at the point of signing in,
              so acceptance is not implied only by a link in the footer. */}
          <p className="mt-5 text-center text-xs leading-relaxed text-[#828282]">
            By signing in you agree to our{' '}
            <Link
              href="/terms"
              className="text-[#4d4d4d] underline underline-offset-2 transition-colors hover:text-[#202020]"
            >
              Terms of Use
            </Link>{' '}
            and acknowledge our{' '}
            <Link
              href="/privacy"
              className="text-[#4d4d4d] underline underline-offset-2 transition-colors hover:text-[#202020]"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

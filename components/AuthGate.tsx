'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/lib/crmContext';

const emptySubscribe = () => () => {};

// Decides which of the two screens a visitor gets, and is the only place that
// does.
//
// `/` is the CRM and `/login` is the way in, but the session both depend on is
// restored on the client — so for one round trip after the first paint neither
// page knows which side of the gate the visitor is on. Rendering the page's own
// screen during that window is what put the sign-in form in front of a
// signed-in visitor on every visit. The gate holds a neutral boot state until
// the check has settled, then hands the visitor to the other page if this one
// is not theirs.
export default function AuthGate({
  require,
  children,
}: {
  require: 'session' | 'guest';
  children: React.ReactNode;
}) {
  const { currentUser, isSupabaseConfigured, isLoading } = useCRM();
  const router = useRouter();
  // The server cannot see a client-side session, so the markup it sends is the
  // boot state; waiting for mount keeps the first client render in agreement.
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const needsSession = require === 'session';
  const satisfied = needsSession ? Boolean(currentUser) : !currentUser;
  const settled = isMounted && !isLoading;

  useEffect(() => {
    if (!settled || !isSupabaseConfigured || satisfied) return;
    router.replace(needsSession ? '/login' : '/');
  }, [settled, isSupabaseConfigured, satisfied, needsSession, router]);

  if (!settled) return <BootState />;

  // No client means no sessions to check, so there is nothing to gate on. Say
  // so here rather than behind a form that cannot possibly work.
  if (!isSupabaseConfigured) return <UnconfiguredState />;

  // The redirect above is scheduled but not yet applied: this page still must
  // not render the screen it does not own.
  if (!satisfied) return <BootState />;

  return <>{children}</>;
}

// What the visitor sees while the session is being restored: not the CRM and
// not the sign-in form, so neither can be mistaken for the answer.
function BootState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <div className="flex items-center gap-2 font-mono text-xs text-[#828282]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff682c] animate-pulse" />
        <span>WONDER CRM</span>
      </div>
    </div>
  );
}

function UnconfiguredState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white px-4">
      <div className="max-w-md w-full bg-[#efefef] border border-[#e8e8e8] rounded-lg p-6 text-center">
        <p className="text-sm font-medium text-[#202020] mb-1">Supabase is not configured</p>
        <p className="text-xs text-[#4d4d4d]">
          Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your{' '}
          <code className="font-mono">.env</code> file and restart the dev server.
        </p>
      </div>
    </div>
  );
}

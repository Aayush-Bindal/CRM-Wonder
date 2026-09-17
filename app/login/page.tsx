'use client';

import { CRMProvider } from '@/lib/crmContext';
import AuthGate from '@/components/AuthGate';
import LoginScreen from '@/components/LoginScreen';

// The way in. AuthGate keeps it off the screen of anyone who already has a
// session, so signing in twice is not a state this page can be in.
export default function LoginPage() {
  return (
    <CRMProvider>
      <AuthGate require="guest">
        <LoginScreen />
      </AuthGate>
    </CRMProvider>
  );
}

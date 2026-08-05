import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext, type BillingStatus } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { GUEST_SESSION, GUEST_USER } from '@shared/localGuest';

const LOCAL_BILLING_STATUS: BillingStatus = {
  user: { hasTrialed: false },
  subscription: {
    level: 'pro',
    status: 'active',
    currentPeriodEnd: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  },
  tokens: {
    free: 1_000_000,
    subscription: 1_000_000,
    purchased: 1_000_000,
    total: 3_000_000,
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure guest profile row exists in the local store.
    void supabase
      .from('profiles')
      .select('id')
      .eq('user_id', GUEST_USER.id)
      .maybeSingle()
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));
  }, []);

  const { data: billing } = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: async (): Promise<BillingStatus> => LOCAL_BILLING_STATUS,
    staleTime: Infinity,
  });

  const noop = async () => {};

  return (
    <AuthContext.Provider
      value={{
        session: GUEST_SESSION,
        user: GUEST_USER,
        billing: billing ?? LOCAL_BILLING_STATUS,
        isLoading,
        signIn: noop,
        signUp: noop,
        signInWithMagicLink: noop,
        verifyOtp: noop,
        signOut: noop,
        resetPassword: noop,
        updatePassword: noop,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
